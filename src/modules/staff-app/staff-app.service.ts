import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { verifyMSG91WidgetToken } from '../../utils/msg91';
import { blacklistToken, extractJti, hashToken, refreshTokenMatches, isJwtError, isTokenBlacklisted } from '../../services/token.service';
import logger from '../../utils/logger';
import { createStaffAccessToken, createStaffRefreshToken, verifyStaffToken } from './staff-app.token';
import { eventBus } from '../../utils/eventBus';
import { isBookingExpired, notPastPendingWhere, presentStaffBooking, BOOKING_EXPIRED_MESSAGE } from '../domestic-staff/domestic-staff.service';

const publicStaff = (staff: any) => ({
  id: staff.id, name: staff.name, phone: staff.phone, staffType: staff.staffType,
  photoUrl: staff.photoUrl, isVerified: staff.isVerified, availabilityStatus: staff.availabilityStatus,
  isCurrentlyWorking: staff.isCurrentlyWorking, lastCheckIn: staff.lastCheckIn, lastCheckOut: staff.lastCheckOut,
  society: staff.society,
});

// Staff only need to know which home: never the flat's owner name/phone/email or
// owner/tenant user ids, which a bare `include: { flat }` returns.
const STAFF_FLAT_INCLUDE = {
  flat: { select: { id: true, flatNumber: true, floor: true, block: { select: { name: true } } } },
} as const;

export class StaffAppService {
  async verifyOtp(widgetToken: string) {
    const phone = await verifyMSG91WidgetToken(widgetToken);
    const staff = await prisma.domesticStaff.findUnique({ where: { phone }, include: { society: { select: { id: true, name: true, isActive: true } } } });
    if (!staff) throw new AppError('No staff profile is registered with this mobile number.', 404);
    if (!staff.isActive) throw new AppError('Your staff profile is inactive. Contact the society admin.', 403);
    if (!staff.isVerified) throw new AppError('Your profile is waiting for society verification.', 403);
    if (!staff.society.isActive) throw new AppError('Society is currently inactive.', 403);
    const account = await prisma.staffAccount.upsert({
      where: { domesticStaffId: staff.id },
      update: { phone, isActive: true, lastLogin: new Date() },
      create: { domesticStaffId: staff.id, phone, lastLogin: new Date() },
    });
    const accessToken = createStaffAccessToken(account.id, staff.id, staff.societyId);
    const refreshToken = createStaffRefreshToken(account.id, staff.id, staff.societyId);
    // Only a SHA-256 hash of the refresh token is stored
    await prisma.staffAccount.update({ where: { id: account.id }, data: { refreshToken: hashToken(refreshToken), lastTokenRefresh: new Date() } });
    return { accessToken, refreshToken, staff: publicStaff(staff), appType: 'STAFF_APP' };
  }

  async refresh(refreshToken: string) {
    let decoded;
    try {
      decoded = verifyStaffToken(refreshToken, 'refresh');
    } catch (error) {
      if (isJwtError(error)) throw new AppError('Invalid staff session. Please login again.', 401);
      throw error;
    }
    if (await isTokenBlacklisted(decoded.jti)) throw new AppError('Invalid staff session. Please login again.', 401);
    const account = await prisma.staffAccount.findUnique({ where: { id: decoded.staffAccountId }, include: { domesticStaff: { include: { society: { select: { id: true, name: true, isActive: true } } } } } });
    if (!account || !account.isActive || !account.domesticStaff.isActive) throw new AppError('Invalid staff session. Please login again.', 401);
    if (!refreshTokenMatches(refreshToken, account.refreshToken)) {
      // Signed by us but not the current token: an already-rotated token is being
      // replayed (or the session was ended). Treat as theft — end the session.
      if (account.refreshToken) {
        await prisma.staffAccount.updateMany({ where: { id: account.id, refreshToken: account.refreshToken }, data: { refreshToken: null } });
        logger.warn({ staffAccountId: account.id }, 'Staff refresh token reuse detected — session revoked');
      }
      throw new AppError('Invalid staff session. Please login again.', 401);
    }
    if (!account.domesticStaff.society.isActive) throw new AppError('Society is currently inactive.', 403);
    const accessToken = createStaffAccessToken(account.id, account.domesticStaffId, account.domesticStaff.societyId);
    const nextRefresh = createStaffRefreshToken(account.id, account.domesticStaffId, account.domesticStaff.societyId);
    // Compare-and-swap on the old hash so two concurrent refreshes can't both rotate
    const swapped = await prisma.staffAccount.updateMany({ where: { id: account.id, refreshToken: account.refreshToken }, data: { refreshToken: hashToken(nextRefresh), lastTokenRefresh: new Date() } });
    if (swapped.count === 0) throw new AppError('Invalid staff session. Please login again.', 401);
    return { accessToken, refreshToken: nextRefresh, staff: publicStaff(account.domesticStaff) };
  }

  /**
   * Revoke the session. Works with a valid access token (accountId known) or with
   * just the refresh token (access token expired) — either is enough to end it.
   */
  async logout(accountId: string | null, accessToken?: string, refreshToken?: string) {
    if (accessToken) {
      const decoded = extractJti(accessToken);
      if (decoded.jti && decoded.exp) await blacklistToken(decoded.jti, Math.max(1, decoded.exp - Math.floor(Date.now() / 1000)));
    }
    let targetAccountId = accountId;
    if (refreshToken) {
      try {
        const decoded = verifyStaffToken(refreshToken, 'refresh');
        if (!targetAccountId) targetAccountId = decoded.staffAccountId;
        if (decoded.exp) await blacklistToken(decoded.jti, Math.max(1, decoded.exp - Math.floor(Date.now() / 1000)));
      } catch {
        // Invalid/expired refresh token: nothing to revoke with it
      }
    }
    if (!targetAccountId) throw new AppError('A valid access or refresh token is required to logout', 401);
    await prisma.staffAccount.update({ where: { id: targetAccountId }, data: { refreshToken: null, fcmToken: null } });
  }

  async dashboard(staffId: string) {
    const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const [staff, assignments, bookings, attendance] = await Promise.all([
      prisma.domesticStaff.findUniqueOrThrow({ where: { id: staffId }, include: { society: { select: { id: true, name: true } } } }),
      prisma.staffFlatAssignment.findMany({ where: { domesticStaffId: staffId, isActive: true }, include: STAFF_FLAT_INCLUDE, orderBy: { workStartTime: 'asc' } }),
      prisma.staffBooking.findMany({ where: { domesticStaffId: staffId, bookingDate: { gte: start, lte: end }, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }, include: STAFF_FLAT_INCLUDE, orderBy: { startTime: 'asc' } }),
      prisma.staffAttendance.findFirst({ where: { domesticStaffId: staffId, checkOutTime: null }, orderBy: { checkInTime: 'desc' } }),
    ]);
    // Same-day requests whose start has passed can't be accepted — keep them off the dashboard too
    const activeBookings = bookings.filter((booking) => booking.status !== 'PENDING' || !isBookingExpired(booking));
    return { staff: publicStaff(staff), assignments, bookings: activeBookings, activeAttendance: attendance };
  }

  assignments(staffId: string) { return prisma.staffFlatAssignment.findMany({ where: { domesticStaffId: staffId, isActive: true }, include: STAFF_FLAT_INCLUDE, orderBy: { workStartTime: 'asc' } }); }
  attendance(staffId: string, page: number) { return prisma.staffAttendance.findMany({ where: { domesticStaffId: staffId }, include: STAFF_FLAT_INCLUDE, orderBy: { checkInTime: 'desc' }, skip: (page - 1) * 20, take: 20 }); }
  // Unanswered requests whose start has passed can't be accepted — leave them out of the list
  async bookings(staffId: string) {
    const bookings = await prisma.staffBooking.findMany({ where: { domesticStaffId: staffId, ...notPastPendingWhere() }, include: STAFF_FLAT_INCLUDE, orderBy: [{ bookingDate: 'desc' }, { startTime: 'asc' }] });
    return bookings
      .filter((booking) => booking.status !== 'PENDING' || !isBookingExpired(booking))
      .map(presentStaffBooking);
  }

  async updateBooking(staffId: string, bookingId: string, action: 'accept' | 'reject', reason?: string) {
    const booking = await prisma.staffBooking.findFirst({
      where: { id: bookingId, domesticStaffId: staffId },
      include: { domesticStaff: { select: { name: true, staffType: true } } },
    });
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.status !== 'PENDING') throw new AppError('Booking is no longer pending', 400);
    if (isBookingExpired(booking)) throw new AppError(BOOKING_EXPIRED_MESSAGE, 400);
    const updated = await prisma.staffBooking.update({ where: { id: bookingId }, data: action === 'accept' ? { status: 'CONFIRMED', acceptedAt: new Date() } : { status: 'CANCELLED', rejectedAt: new Date(), rejectionReason: reason } });
    const event = {
      bookingId: booking.id,
      bookedById: booking.bookedById,
      staffName: booking.domesticStaff.name,
      staffType: booking.domesticStaff.staffType,
      societyId: booking.societyId,
    };
    if (action === 'accept') eventBus.emit('staff.booking-accepted', event);
    else eventBus.emit('staff.booking-rejected', { ...event, reason });
    // Staff decline is stored as CANCELLED + rejectedAt and reported as REJECTED
    return presentStaffBooking(updated);
  }
}
