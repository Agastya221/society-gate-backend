import { prisma } from '../../utils/Client';
import { AppError } from '../../utils/ResponseHandler';
import { verifyMSG91WidgetToken } from '../../utils/msg91';
import { blacklistToken, extractJti } from '../../services/token.service';
import { createStaffAccessToken, createStaffRefreshToken, verifyStaffToken } from './staff-app.token';
import { eventBus } from '../../utils/eventBus';

const publicStaff = (staff: any) => ({
  id: staff.id, name: staff.name, phone: staff.phone, staffType: staff.staffType,
  photoUrl: staff.photoUrl, isVerified: staff.isVerified, availabilityStatus: staff.availabilityStatus,
  isCurrentlyWorking: staff.isCurrentlyWorking, lastCheckIn: staff.lastCheckIn, lastCheckOut: staff.lastCheckOut,
  society: staff.society,
});

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
    await prisma.staffAccount.update({ where: { id: account.id }, data: { refreshToken, lastTokenRefresh: new Date() } });
    return { accessToken, refreshToken, staff: publicStaff(staff), appType: 'STAFF_APP' };
  }

  async refresh(refreshToken: string) {
    const decoded = verifyStaffToken(refreshToken, 'refresh');
    const account = await prisma.staffAccount.findUnique({ where: { id: decoded.staffAccountId }, include: { domesticStaff: { include: { society: { select: { id: true, name: true, isActive: true } } } } } });
    if (!account || !account.isActive || account.refreshToken !== refreshToken || !account.domesticStaff.isActive) throw new AppError('Invalid staff session. Please login again.', 401);
    const accessToken = createStaffAccessToken(account.id, account.domesticStaffId, account.domesticStaff.societyId);
    const nextRefresh = createStaffRefreshToken(account.id, account.domesticStaffId, account.domesticStaff.societyId);
    await prisma.staffAccount.update({ where: { id: account.id }, data: { refreshToken: nextRefresh, lastTokenRefresh: new Date() } });
    return { accessToken, refreshToken: nextRefresh, staff: publicStaff(account.domesticStaff) };
  }

  async logout(accountId: string, accessToken: string) {
    const decoded = extractJti(accessToken);
    if (decoded.jti && decoded.exp) await blacklistToken(decoded.jti, Math.max(1, decoded.exp - Math.floor(Date.now() / 1000)));
    await prisma.staffAccount.update({ where: { id: accountId }, data: { refreshToken: null, fcmToken: null } });
  }

  async dashboard(staffId: string) {
    const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const [staff, assignments, bookings, attendance] = await Promise.all([
      prisma.domesticStaff.findUniqueOrThrow({ where: { id: staffId }, include: { society: { select: { id: true, name: true } } } }),
      prisma.staffFlatAssignment.findMany({ where: { domesticStaffId: staffId, isActive: true }, include: { flat: { include: { block: { select: { name: true } } } } }, orderBy: { workStartTime: 'asc' } }),
      prisma.staffBooking.findMany({ where: { domesticStaffId: staffId, bookingDate: { gte: start, lte: end }, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }, include: { flat: { include: { block: { select: { name: true } } } } }, orderBy: { startTime: 'asc' } }),
      prisma.staffAttendance.findFirst({ where: { domesticStaffId: staffId, checkOutTime: null }, orderBy: { checkInTime: 'desc' } }),
    ]);
    return { staff: publicStaff(staff), assignments, bookings, activeAttendance: attendance };
  }

  assignments(staffId: string) { return prisma.staffFlatAssignment.findMany({ where: { domesticStaffId: staffId, isActive: true }, include: { flat: { include: { block: { select: { name: true } } } } }, orderBy: { workStartTime: 'asc' } }); }
  attendance(staffId: string, page: number) { return prisma.staffAttendance.findMany({ where: { domesticStaffId: staffId }, include: { flat: { include: { block: { select: { name: true } } } } }, orderBy: { checkInTime: 'desc' }, skip: (page - 1) * 20, take: 20 }); }
  bookings(staffId: string) { return prisma.staffBooking.findMany({ where: { domesticStaffId: staffId }, include: { flat: { include: { block: { select: { name: true } } } } }, orderBy: [{ bookingDate: 'desc' }, { startTime: 'asc' }] }); }

  async updateBooking(staffId: string, bookingId: string, action: 'accept' | 'reject', reason?: string) {
    const booking = await prisma.staffBooking.findFirst({
      where: { id: bookingId, domesticStaffId: staffId },
      include: { domesticStaff: { select: { name: true, staffType: true } } },
    });
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.status !== 'PENDING') throw new AppError('Booking is no longer pending', 400);
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
    return updated;
  }
}
