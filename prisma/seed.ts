import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const daysAgo = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() - days); return d;
};
const daysFromNow = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days); return d;
};
const hoursAgo = (hours: number) => {
  const d = new Date(); d.setHours(d.getHours() - hours); return d;
};

async function main() {
  console.log('🌱 Starting seed...\n');

  // ============================================
  // CLEAN DATABASE (new models first)
  // ============================================
  console.log('🧹 Cleaning...');
  await prisma.pollVote.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.societyDocument.deleteMany();
  await prisma.postComment.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.communityPost.deleteMany();
  await prisma.vendorLike.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.entryRequest.deleteMany();
  await prisma.staffReview.deleteMany();
  await prisma.staffBooking.deleteMany();
  await prisma.staffAttendance.deleteMany();
  await prisma.staffFlatAssignment.deleteMany();
  await prisma.domesticStaff.deleteMany();
  await prisma.amenityBooking.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.emergency.deleteMany();
  await prisma.visitorFrequency.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.gatePass.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.paymentReminder.deleteMany();
  await prisma.preApprovedUsage.deleteMany();
  await prisma.preApprovedVerification.deleteMany();
  await prisma.preApprovedMeta.deleteMany();
  await prisma.preApprovedSchedule.deleteMany();
  await prisma.preApprovedEntry.deleteMany();
  await prisma.guestEntryLog.deleteMany();
  await prisma.partySlot.deleteMany();
  await prisma.partyInvite.deleteMany();
  await prisma.guestInvite.deleteMany();
  await prisma.onboardingAuditLog.deleteMany();
  await prisma.residentDocument.deleteMany();
  await prisma.onboardingRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.block.deleteMany();
  await prisma.gatePoint.deleteMany();
  await prisma.society.deleteMany();
  console.log('✅ Cleaned\n');

  // ============================================
  // SOCIETY
  // ============================================
  console.log('🏢 Creating society...');
  const society = await prisma.society.create({
    data: {
      name: 'Greenfield Heights',
      address: 'Survey No. 28, Baner Road, Near Balewadi High Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      contactName: 'Agastya',
      contactPhone: '7484827530',
      contactEmail: 'admin@greenfieldheights.in',
      totalFlats: 96,
      monthlyFee: 4500,
      nextDueDate: daysFromNow(15),
      paymentStatus: 'PAID',
    },
  });
  console.log('✅ 1 society\n');

  // ============================================
  // GATE POINTS
  // ============================================
  console.log('🚪 Creating gate points...');
  const mainGate = await prisma.gatePoint.create({
    data: { name: 'Main Gate (North)', isActive: true, societyId: society.id },
  });
  await prisma.gatePoint.create({
    data: { name: 'Service Gate (South)', isActive: true, societyId: society.id },
  });
  console.log('✅ 2 gate points\n');

  // ============================================
  // BLOCKS
  // ============================================
  console.log('🏗️ Creating blocks...');
  const towerA = await prisma.block.create({
    data: { name: 'Tower A (Jasmine)', societyId: society.id, totalFloors: 8, description: 'East-facing 2BHK & 3BHK apartments' },
  });
  const towerB = await prisma.block.create({
    data: { name: 'Tower B (Orchid)', societyId: society.id, totalFloors: 8, description: 'West-facing premium 3BHK & 4BHK apartments' },
  });
  const towerC = await prisma.block.create({
    data: { name: 'Tower C (Lily)', societyId: society.id, totalFloors: 8, description: 'North-facing 2BHK compact units' },
  });
  console.log('✅ 3 blocks\n');

  // ============================================
  // FLATS (96 total — top 2 floors vacant per tower)
  // ============================================
  console.log('🏠 Creating flats...');
  const flats: any[] = [];
  for (const [block, prefix] of [[towerA, 'A'], [towerB, 'B'], [towerC, 'C']] as const) {
    for (let floor = 1; floor <= 8; floor++) {
      for (let unit = 1; unit <= 4; unit++) {
        const flat = await prisma.flat.create({
          data: {
            flatNumber: `${prefix}${floor}0${unit}`,
            floor: `${floor}`,
            blockId: (block as any).id,
            societyId: society.id,
            isOccupied: floor <= 6,
          },
        });
        flats.push(flat);
      }
    }
  }
  const flat = (num: string) => flats.find((f: any) => f.flatNumber === num);
  console.log(`✅ ${flats.length} flats\n`);

  // ============================================
  // USERS
  // ============================================
  console.log('👥 Creating users...');

  const superAdmin = await prisma.user.create({
    data: { name: 'Platform Admin', phone: '9999900000', email: 'superadmin@sgate.in', role: 'SUPER_ADMIN', isActive: true },
  });

  const admin = await prisma.user.create({
    data: { name: 'Agastya', phone: '7484827530', email: 'admin@greenfieldheights.in', role: 'ADMIN', societyId: society.id, isActive: true },
  });

  const guard1 = await prisma.user.create({
    data: { name: 'Rajendra Singh', phone: '9800000001', email: 'rajendra.singh@greenfieldheights.in', role: 'GUARD', societyId: society.id, isActive: true },
  });
  const guard2 = await prisma.user.create({
    data: { name: 'Sunil Yadav', phone: '9800000002', email: 'sunil.yadav@greenfieldheights.in', role: 'GUARD', societyId: society.id, isActive: true },
  });
  const guard3 = await prisma.user.create({
    data: { name: 'Bhola Prasad', phone: '9800000003', email: 'bhola.prasad@greenfieldheights.in', role: 'GUARD', societyId: society.id, isActive: true },
  });

  // Resident 1 — Amit Sharma, A101, IT professional (owner)
  const res1 = await prisma.user.create({
    data: { name: 'Amit Sharma', phone: '9811000001', email: 'amit.sharma@techcorp.in', role: 'RESIDENT', societyId: society.id, flatId: flat('A101').id, isOwner: true, isPrimaryResident: true, isActive: true },
  });
  await prisma.user.create({
    data: { name: 'Neha Sharma', phone: '9811000002', email: 'neha.sharma@designer.in', role: 'RESIDENT', societyId: society.id, flatId: flat('A101').id, isPrimaryResident: false, primaryResidentId: res1.id, familyRole: 'SPOUSE', isActive: true },
  });
  await prisma.user.create({
    data: { name: 'Aarav Sharma', phone: '9811000003', role: 'RESIDENT', societyId: society.id, flatId: flat('A101').id, isPrimaryResident: false, primaryResidentId: res1.id, familyRole: 'CHILD', isActive: true },
  });

  // Resident 2 — Dr. Sneha Kulkarni, A301, doctor (owner)
  const res2 = await prisma.user.create({
    data: { name: 'Dr. Sneha Kulkarni', phone: '9811000004', email: 'sneha.kulkarni@hospital.in', role: 'RESIDENT', societyId: society.id, flatId: flat('A301').id, isOwner: true, isPrimaryResident: true, isActive: true },
  });
  await prisma.user.create({
    data: { name: 'Ishaan Kulkarni', phone: '9811000005', role: 'RESIDENT', societyId: society.id, flatId: flat('A301').id, isPrimaryResident: false, primaryResidentId: res2.id, familyRole: 'CHILD', isActive: true },
  });

  // Resident 3 — Vikram Chauhan, B102, investment banker (tenant)
  const res3 = await prisma.user.create({
    data: { name: 'Vikram Chauhan', phone: '9811000006', email: 'vikram.chauhan@finance.in', role: 'RESIDENT', societyId: society.id, flatId: flat('B102').id, isPrimaryResident: true, isActive: true },
  });
  const res3Spouse = await prisma.user.create({
    data: { name: 'Ananya Chauhan', phone: '9811000007', email: 'ananya.chauhan@architect.in', role: 'RESIDENT', societyId: society.id, flatId: flat('B102').id, isPrimaryResident: false, primaryResidentId: res3.id, familyRole: 'SPOUSE', isActive: true },
  });

  // Resident 4 — Mohan Joshi, B401, retired couple (owner)
  const res4 = await prisma.user.create({
    data: { name: 'Mohan Joshi', phone: '9811000008', email: 'mohan.joshi@retired.in', role: 'RESIDENT', societyId: society.id, flatId: flat('B401').id, isOwner: true, isPrimaryResident: true, isActive: true },
  });
  const res4Spouse = await prisma.user.create({
    data: { name: 'Sunita Joshi', phone: '9811000009', role: 'RESIDENT', societyId: society.id, flatId: flat('B401').id, isPrimaryResident: false, primaryResidentId: res4.id, familyRole: 'SPOUSE', isActive: true },
  });

  // Resident 5 — Priya Desai, C201, startup founder (owner)
  const res5 = await prisma.user.create({
    data: { name: 'Priya Desai', phone: '9811000010', email: 'priya.desai@startup.in', role: 'RESIDENT', societyId: society.id, flatId: flat('C201').id, isOwner: true, isPrimaryResident: true, isActive: true },
  });

  // Resident 6 — Karthik Nair, C401, software engineer (owner)
  const res6 = await prisma.user.create({
    data: { name: 'Karthik Nair', phone: '9811000011', email: 'karthik.nair@techgiant.in', role: 'RESIDENT', societyId: society.id, flatId: flat('C401').id, isOwner: true, isPrimaryResident: true, isActive: true },
  });
  await prisma.user.create({
    data: { name: 'Divya Nair', phone: '9811000012', email: 'divya.nair@teacher.in', role: 'RESIDENT', societyId: society.id, flatId: flat('C401').id, isPrimaryResident: false, primaryResidentId: res6.id, familyRole: 'SPOUSE', isActive: true },
  });
  await prisma.user.create({
    data: { name: 'Ramesh Nair', phone: '9811000013', role: 'RESIDENT', societyId: society.id, flatId: flat('C401').id, isPrimaryResident: false, primaryResidentId: res6.id, familyRole: 'PARENT', isActive: true },
  });

  console.log('✅ 18 users (1 super admin, 1 admin, 3 guards, 13 residents)\n');

  // ============================================
  // ONBOARDING (all 6 primary residents approved)
  // ============================================
  console.log('📋 Creating onboarding records...');
  const residentBlockMap: Record<string, string> = {
    [res1.id]: towerA.id, [res2.id]: towerA.id,
    [res3.id]: towerB.id, [res4.id]: towerB.id,
    [res5.id]: towerC.id, [res6.id]: towerC.id,
  };
  for (const r of [res1, res2, res3, res4, res5, res6]) {
    await prisma.onboardingRequest.create({
      data: {
        userId: r.id,
        societyId: society.id,
        blockId: residentBlockMap[r.id],
        flatId: r.flatId!,
        residentType: r.isOwner ? 'OWNER' : 'TENANT',
        status: 'APPROVED',
        reviewedById: admin.id,
        reviewedAt: daysAgo(30),
      },
    });
  }
  console.log('✅ 6 onboarding requests\n');

  // ============================================
  // VEHICLES (with approval flow)
  // ============================================
  console.log('🚗 Creating vehicles...');
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12AB1234', vehicleType: 'Car', model: 'Hyundai Creta SX', color: 'Polar White',
      status: 'ACTIVE', parkingSlot: 'A-P1', stickerNumber: 'GH-2024-001',
      lastSeen: hoursAgo(3), userId: res1.id, flatId: flat('A101').id, societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12CD5678', vehicleType: 'Bike', model: 'Royal Enfield Classic 350', color: 'Stealth Black',
      status: 'ACTIVE', parkingSlot: 'A-B1', stickerNumber: 'GH-2024-002',
      lastSeen: daysAgo(1),
      userId: res1.id, flatId: flat('A101').id, societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH14EF9012', vehicleType: 'Car', model: 'Toyota Fortuner 4x4', color: 'Super White',
      status: 'ACTIVE', parkingSlot: 'A-P3', stickerNumber: 'GH-2024-003',
      lastSeen: daysAgo(1), userId: res2.id, flatId: flat('A301').id, societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12GH3456', vehicleType: 'Car', model: 'BMW X5 xDrive', color: 'Phytonic Blue',
      status: 'ACTIVE', parkingSlot: 'B-P1', stickerNumber: 'GH-2024-004',
      lastSeen: hoursAgo(6), userId: res3.id, flatId: flat('B102').id, societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12JK7890', vehicleType: 'Bike', model: 'Honda Activa 6G', color: 'Matte Grey',
      status: 'ACTIVE', parkingSlot: 'B-B2', stickerNumber: 'GH-2024-005',
      lastSeen: daysAgo(2),
      userId: res3Spouse.id, flatId: flat('B102').id, societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12LM2345', vehicleType: 'Car', model: 'Maruti Swift VDi', color: 'Pearl Arctic White',
      status: 'ACTIVE', parkingSlot: 'C-P1', stickerNumber: 'GH-2024-006',
      lastSeen: hoursAgo(1), userId: res5.id, flatId: flat('C201').id, societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH14NP6789', vehicleType: 'Car', model: 'Tata Nexon EV', color: 'Teal Blue',
      status: 'ACTIVE', parkingSlot: 'C-P4', stickerNumber: 'GH-2024-007',
      lastSeen: daysAgo(2), userId: res6.id, flatId: flat('C401').id, societyId: society.id,
    },
  });
  // New registration — pending approval
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12QR0011', vehicleType: 'Car', model: 'Maruti Baleno Alpha', color: 'Luxe Brown',
      status: 'PENDING',
      userId: res4.id, flatId: flat('B401').id, societyId: society.id,
    },
  });
  console.log('✅ 8 vehicles (7 active, 1 pending)\n');

  // ============================================
  // AMENITIES
  // ============================================
  console.log('🏊 Creating amenities...');
  const gym = await prisma.amenity.create({
    data: { name: 'Greenfield Fitness Studio', type: 'GYM', description: 'Fully-equipped gym with treadmills, ellipticals, cross-trainers and free weights. Personal trainer available 6-8 AM & 6-8 PM.', capacity: 25, pricePerHour: 0, maxBookingsPerUser: 2, isActive: true, societyId: society.id },
  });
  const pool = await prisma.amenity.create({
    data: { name: 'Aqua Pool', type: 'SWIMMING_POOL', description: 'Semi-Olympic size pool (25m x 12m) with kids pool. Lifeguard on duty 6 AM - 9 PM.', capacity: 40, pricePerHour: 250, maxBookingsPerUser: 3, isActive: true, societyId: society.id },
  });
  const clubhouse = await prisma.amenity.create({
    data: { name: 'Grand Banquet Hall', type: 'CLUBHOUSE', description: 'AC banquet hall with stage, sound system, and catering area. Capacity 150 guests.', capacity: 150, pricePerHour: 3000, maxBookingsPerUser: 2, isActive: true, societyId: society.id },
  });
  await prisma.amenity.create({
    data: { name: "Children's Play Zone", type: 'GARDEN', description: 'Safe outdoor play area with swings, slides, sandpit for kids aged 2-12.', capacity: 20, pricePerHour: 0, maxBookingsPerUser: 5, isActive: true, societyId: society.id },
  });
  const sportsCourt = await prisma.amenity.create({
    data: { name: 'Multi-Sport Court', type: 'SPORTS_COURT', description: 'Badminton, basketball, and tennis court with flood lights.', capacity: 10, pricePerHour: 200, maxBookingsPerUser: 3, isActive: true, societyId: society.id },
  });
  await prisma.amenity.create({
    data: { name: 'Rooftop Party Lounge', type: 'PARTY_HALL', description: 'Rooftop lounge with BBQ area, city views, and DJ console. Adults only.', capacity: 60, pricePerHour: 2000, maxBookingsPerUser: 1, isActive: true, societyId: society.id },
  });
  console.log('✅ 6 amenities\n');

  // ============================================
  // AMENITY BOOKINGS
  // ============================================
  console.log('📅 Creating amenity bookings...');
  await prisma.amenityBooking.create({ data: { amenityId: clubhouse.id, userId: res1.id, flatId: flat('A101').id, societyId: society.id, bookingDate: daysFromNow(5), startTime: '18:00', endTime: '23:00', status: 'CONFIRMED', purpose: "Son's 8th birthday party — 40 guests" } });
  await prisma.amenityBooking.create({ data: { amenityId: pool.id, userId: res2.id, flatId: flat('A301').id, societyId: society.id, bookingDate: daysFromNow(3), startTime: '16:00', endTime: '18:00', status: 'PENDING', purpose: 'Kids swimming practice' } });
  await prisma.amenityBooking.create({ data: { amenityId: gym.id, userId: res3.id, flatId: flat('B102').id, societyId: society.id, bookingDate: daysFromNow(1), startTime: '06:00', endTime: '07:30', status: 'CONFIRMED', purpose: 'Morning workout' } });
  await prisma.amenityBooking.create({ data: { amenityId: sportsCourt.id, userId: res5.id, flatId: flat('C201').id, societyId: society.id, bookingDate: daysFromNow(2), startTime: '18:00', endTime: '19:30', status: 'CONFIRMED', purpose: 'Badminton with friends' } });
  await prisma.amenityBooking.create({ data: { amenityId: clubhouse.id, userId: res4.id, flatId: flat('B401').id, societyId: society.id, bookingDate: daysAgo(10), startTime: '10:00', endTime: '14:00', status: 'COMPLETED', purpose: 'Silver jubilee anniversary celebration' } });
  await prisma.amenityBooking.create({ data: { amenityId: pool.id, userId: res6.id, flatId: flat('C401').id, societyId: society.id, bookingDate: daysFromNow(4), startTime: '17:00', endTime: '19:00', status: 'CANCELLED', purpose: 'Pool party — cancelled due to rain forecast' } });
  console.log('✅ 6 amenity bookings\n');

  // ============================================
  // DOMESTIC STAFF
  // ============================================
  console.log('👨‍🔧 Creating domestic staff...');
  const maid1 = await prisma.domesticStaff.create({
    data: { name: 'Lakshmi Devi', phone: '9820000001', staffType: 'MAID', qrToken: 'STAFF_MAID_001', isVerified: true, verifiedAt: daysAgo(180), verifiedBy: admin.id, isActive: true, rating: 4.7, totalReviews: 18, societyId: society.id, addedById: admin.id, experienceYears: 7, languages: ['Hindi', 'Marathi'] },
  });
  const cook1 = await prisma.domesticStaff.create({
    data: { name: 'Ramesh Yadav', phone: '9820000002', staffType: 'COOK', qrToken: 'STAFF_COOK_001', isVerified: true, verifiedAt: daysAgo(365), verifiedBy: admin.id, isActive: true, rating: 4.9, totalReviews: 14, societyId: society.id, addedById: admin.id, experienceYears: 12, languages: ['Hindi'] },
  });
  const driver1 = await prisma.domesticStaff.create({
    data: { name: 'Shankar Patil', phone: '9820000003', staffType: 'DRIVER', qrToken: 'STAFF_DRIVER_001', isVerified: true, verifiedAt: daysAgo(90), verifiedBy: admin.id, isActive: true, rating: 4.5, totalReviews: 7, societyId: society.id, addedById: admin.id, experienceYears: 15, languages: ['Hindi', 'Marathi', 'English'] },
  });
  const gardener1 = await prisma.domesticStaff.create({
    data: { name: 'Gopal Reddy', phone: '9820000004', staffType: 'GARDENER', qrToken: 'STAFF_GARDENER_001', isVerified: true, verifiedAt: daysAgo(250), verifiedBy: admin.id, isActive: true, rating: 4.6, totalReviews: 10, societyId: society.id, addedById: admin.id, experienceYears: 9, languages: ['Telugu', 'Hindi'] },
  });
  const nanny1 = await prisma.domesticStaff.create({
    data: { name: 'Savita Patil', phone: '9820000005', staffType: 'NANNY', qrToken: 'STAFF_NANNY_001', isVerified: true, verifiedAt: daysAgo(120), verifiedBy: admin.id, isActive: true, rating: 4.8, totalReviews: 11, societyId: society.id, addedById: admin.id, experienceYears: 5, languages: ['Hindi', 'Marathi'] },
  });
  const maid2 = await prisma.domesticStaff.create({
    data: { name: 'Kavita Singh', phone: '9820000006', staffType: 'MAID', qrToken: 'STAFF_MAID_002', isVerified: false, isActive: true, rating: 0, totalReviews: 0, societyId: society.id, addedById: res5.id, experienceYears: 2, languages: ['Hindi'] },
  });
  console.log('✅ 6 domestic staff\n');

  // ============================================
  // STAFF FLAT ASSIGNMENTS
  // ============================================
  console.log('🔗 Creating staff assignments...');
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: maid1.id, flatId: flat('A101').id, isActive: true, workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY', 'SATURDAY'], workStartTime: '08:00', workEndTime: '10:00', agreedRate: 3500, rateType: 'monthly' } });
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: maid1.id, flatId: flat('A301').id, isActive: true, workingDays: ['TUESDAY', 'THURSDAY', 'SUNDAY'], workStartTime: '10:30', workEndTime: '12:30', agreedRate: 3000, rateType: 'monthly' } });
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: maid1.id, flatId: flat('B401').id, isActive: true, workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], workStartTime: '13:00', workEndTime: '14:30', agreedRate: 2800, rateType: 'monthly' } });
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: cook1.id, flatId: flat('B102').id, isActive: true, workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], workStartTime: '17:00', workEndTime: '20:30', agreedRate: 12000, rateType: 'monthly' } });
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: driver1.id, flatId: flat('B102').id, isActive: true, workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], workStartTime: '08:00', workEndTime: '20:00', agreedRate: 18000, rateType: 'monthly' } });
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: gardener1.id, flatId: flat('B401').id, isActive: true, workingDays: ['TUESDAY', 'THURSDAY'], workStartTime: '07:00', workEndTime: '09:00', agreedRate: 2500, rateType: 'monthly' } });
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: nanny1.id, flatId: flat('A301').id, isActive: true, workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], workStartTime: '09:00', workEndTime: '17:00', agreedRate: 15000, rateType: 'monthly' } });
  await prisma.staffFlatAssignment.create({ data: { domesticStaffId: maid2.id, flatId: flat('C201').id, isActive: true, workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'], workStartTime: '09:00', workEndTime: '10:30', agreedRate: 2500, rateType: 'monthly' } });
  console.log('✅ 8 staff assignments\n');

  // ============================================
  // STAFF ATTENDANCE (last 30 days realistic pattern)
  // ============================================
  console.log('📋 Creating attendance...');
  // maid1 — 22 days in last 30 days (high attendance)
  for (let i = 1; i <= 30; i++) {
    if ([4, 7, 15, 20, 22, 25, 27, 29].includes(i)) continue; // absent these days
    await prisma.staffAttendance.create({
      data: { domesticStaffId: maid1.id, flatId: flat('A101').id, societyId: society.id, checkInTime: daysAgo(30 - i), checkOutTime: new Date(daysAgo(30 - i).getTime() + 2 * 60 * 60 * 1000) },
    });
  }
  // cook1 — 24 days
  for (let i = 1; i <= 30; i++) {
    if ([2, 9, 16, 23, 30, 6].includes(i)) continue;
    await prisma.staffAttendance.create({
      data: { domesticStaffId: cook1.id, flatId: flat('B102').id, societyId: society.id, checkInTime: daysAgo(30 - i), checkOutTime: new Date(daysAgo(30 - i).getTime() + 3.5 * 60 * 60 * 1000) },
    });
  }
  // nanny1 — currently checked in
  await prisma.staffAttendance.create({
    data: { domesticStaffId: nanny1.id, flatId: flat('A301').id, societyId: society.id, checkInTime: hoursAgo(6) },
  });
  await prisma.domesticStaff.update({ where: { id: nanny1.id }, data: { isCurrentlyWorking: true, currentFlatId: flat('A301').id, availabilityStatus: 'BUSY' } });
  console.log('✅ 46+ attendance records\n');

  // ============================================
  // STAFF REVIEWS
  // ============================================
  console.log('⭐ Creating staff reviews...');
  await prisma.staffReview.create({ data: { domesticStaffId: maid1.id, reviewerId: res1.id, flatId: flat('A101').id, rating: 5, review: 'Lakshmi is extremely punctual and thorough. Our home has never been cleaner!', workQuality: 5, punctuality: 5, behavior: 5 } });
  await prisma.staffReview.create({ data: { domesticStaffId: maid1.id, reviewerId: res2.id, flatId: flat('A301').id, rating: 4, review: 'Good worker. Sometimes 10-15 mins late but cleans very well.', workQuality: 5, punctuality: 3, behavior: 5 } });
  await prisma.staffReview.create({ data: { domesticStaffId: maid1.id, reviewerId: res4.id, flatId: flat('B401').id, rating: 5, review: 'Very reliable. Always comes on time. Excellent work.', workQuality: 5, punctuality: 5, behavior: 5 } });
  await prisma.staffReview.create({ data: { domesticStaffId: cook1.id, reviewerId: res3.id, flatId: flat('B102').id, rating: 5, review: 'Ramesh is an exceptional cook. Authentic North and South Indian cuisine.', workQuality: 5, punctuality: 5, behavior: 5 } });
  await prisma.staffReview.create({ data: { domesticStaffId: nanny1.id, reviewerId: res2.id, flatId: flat('A301').id, rating: 5, review: 'Savita is wonderful with kids. Ishaan loves her. Very caring.', workQuality: 5, punctuality: 5, behavior: 5 } });
  await prisma.staffReview.create({ data: { domesticStaffId: driver1.id, reviewerId: res3.id, flatId: flat('B102').id, rating: 4, review: 'Reliable driver, knows city well. Safe driving.', workQuality: 4, punctuality: 4, behavior: 5 } });
  console.log('✅ 6 staff reviews\n');

  // ============================================
  // STAFF BOOKINGS (on-demand)
  // ============================================
  console.log('📅 Creating staff bookings...');
  await prisma.staffBooking.create({ data: { domesticStaffId: maid1.id, bookedById: res5.id, flatId: flat('C201').id, societyId: society.id, bookingDate: daysFromNow(2), startTime: '10:00', endTime: '13:00', durationHours: 3, workType: 'Deep Cleaning', requirements: 'Full house deep clean including kitchen and bathrooms', estimatedCost: 800, status: 'CONFIRMED', acceptedAt: daysAgo(1) } });
  await prisma.staffBooking.create({ data: { domesticStaffId: cook1.id, bookedById: res4.id, flatId: flat('B401').id, societyId: society.id, bookingDate: daysFromNow(5), startTime: '11:00', endTime: '15:00', durationHours: 4, workType: 'Party Cooking', requirements: 'Cook for 20 people — anniversary dinner. Veg only.', estimatedCost: 3000, status: 'PENDING' } });
  console.log('✅ 2 staff bookings\n');

  // ============================================
  // GATE PASSES
  // ============================================
  console.log('🎫 Creating gate passes...');
  await prisma.gatePass.create({ data: { type: 'MATERIAL', title: 'Furniture Delivery', description: 'New sofa set from Pepperfry', vehicleNumber: 'MH12XX9876', qrToken: 'GP_GF_001', validFrom: new Date(), validUntil: daysFromNow(3), status: 'APPROVED', isUsed: false, flatId: flat('A101').id, societyId: society.id, requestedById: res1.id, approvedById: admin.id, approvedAt: new Date() } });
  await prisma.gatePass.create({ data: { type: 'MOVE_IN', title: 'New Tenant Moving In', description: 'Packers and movers — 1 truck + 1 tempo', vehicleNumber: 'MH14ZZ5432', qrToken: 'GP_GF_002', validFrom: daysFromNow(5), validUntil: daysFromNow(6), status: 'PENDING', isUsed: false, flatId: flat('A501').id, societyId: society.id, requestedById: res1.id } });
  console.log('✅ 2 gate passes\n');

  // ============================================
  // ENTRIES
  // ============================================
  console.log('🚪 Creating entries...');
  await prisma.entry.create({ data: { type: 'VISITOR', status: 'CHECKED_OUT', visitorName: 'Deepak Joshi', visitorPhone: '9840000001', visitorType: 'FRIEND', purpose: 'Weekend visit — college reunion dinner', checkInTime: daysAgo(2), checkOutTime: hoursAgo(46), flatId: flat('A101').id, societyId: society.id, gatePointId: mainGate.id, createdById: guard1.id, wasAutoApproved: false, approvedById: res1.id, approvedAt: daysAgo(2) } });
  await prisma.entry.create({ data: { type: 'DELIVERY', status: 'CHECKED_OUT', visitorName: 'Swiggy - Rahul', visitorPhone: '9840000002', purpose: 'Food delivery — Biryani Blues order', companyName: 'Swiggy', checkInTime: hoursAgo(3), checkOutTime: hoursAgo(2.9), flatId: flat('A101').id, societyId: society.id, gatePointId: mainGate.id, createdById: guard1.id, wasAutoApproved: true, autoApprovalReason: 'Auto-approved by delivery rule (8 AM - 11 PM)' } });
  await prisma.entry.create({ data: { type: 'DOMESTIC_STAFF', status: 'CHECKED_OUT', visitorName: 'Lakshmi Devi', visitorPhone: '9820000001', purpose: 'Regular cleaning work', checkInTime: hoursAgo(4), checkOutTime: hoursAgo(2), flatId: flat('A101').id, societyId: society.id, gatePointId: mainGate.id, createdById: guard1.id, wasAutoApproved: true, autoApprovalReason: 'Verified domestic staff — QR scanned', domesticStaffId: maid1.id } });
  await prisma.entry.create({ data: { type: 'DOMESTIC_STAFF', status: 'CHECKED_IN', visitorName: 'Ramesh Yadav', visitorPhone: '9820000002', purpose: 'Evening cooking', checkInTime: hoursAgo(1.5), flatId: flat('B102').id, societyId: society.id, gatePointId: mainGate.id, createdById: guard2.id, wasAutoApproved: true, autoApprovalReason: 'Verified domestic staff — QR scanned', domesticStaffId: cook1.id } });
  await prisma.entry.create({ data: { type: 'DELIVERY', status: 'CHECKED_OUT', visitorName: 'Amazon - Suresh', visitorPhone: '9840000003', purpose: 'Package delivery', companyName: 'Amazon', checkInTime: hoursAgo(26), checkOutTime: hoursAgo(25.9), flatId: flat('A301').id, societyId: society.id, gatePointId: mainGate.id, createdById: guard3.id, wasAutoApproved: true, autoApprovalReason: 'Expected delivery' } });
  await prisma.entry.create({ data: { type: 'VISITOR', status: 'CHECKED_OUT', visitorName: 'Kumar Plumbing', visitorPhone: '9840000004', visitorType: 'SERVICE_PROVIDER', purpose: 'Bathroom tap repair', checkInTime: hoursAgo(28), checkOutTime: hoursAgo(26.5), flatId: flat('B401').id, societyId: society.id, gatePointId: mainGate.id, createdById: guard1.id, wasAutoApproved: false, approvedById: res4.id, approvedAt: hoursAgo(28) } });
  await prisma.entry.create({ data: { type: 'CAB', status: 'CHECKED_OUT', visitorName: 'Uber Driver - Ravi', visitorPhone: '9840000006', vehicleNumber: 'MH12XY9999', purpose: 'Uber pickup — Priya Desai', checkInTime: hoursAgo(25), checkOutTime: hoursAgo(24.9), flatId: flat('C201').id, societyId: society.id, gatePointId: mainGate.id, createdById: guard1.id, wasAutoApproved: true, autoApprovalReason: 'Cab service' } });
  console.log('✅ 7 entries\n');

  // ============================================
  // ENTRY REQUESTS (pending at gate)
  // ============================================
  console.log('📸 Creating entry requests...');
  await prisma.entryRequest.create({ data: { type: 'DELIVERY', status: 'PENDING', visitorName: 'Zomato Delivery', visitorPhone: '9850000001', expiresAt: new Date(Date.now() + 15 * 60 * 1000), flatId: flat('A301').id, societyId: society.id, guardId: guard1.id } });
  await prisma.entryRequest.create({ data: { type: 'VISITOR', status: 'PENDING', visitorName: 'Amit Kumar', visitorPhone: '9850000002', expiresAt: new Date(Date.now() + 12 * 60 * 1000), flatId: flat('B102').id, societyId: society.id, guardId: guard2.id } });
  console.log('✅ 2 entry requests\n');

  // ============================================
  // NOTICES
  // ============================================
  console.log('📢 Creating notices...');
  await prisma.notice.create({ data: { title: 'Monthly Maintenance Due — April 2026', description: `Dear Residents,\n\nMonthly maintenance of ₹4,500 for April 2026 is due by 5th April.\n\nPayment Options:\n- UPI: greenfieldheights@sbi\n- Bank Transfer: A/C 9876543210, IFSC: SBIN0012345\n\nLate fee of ₹200 after 10th April.\n\n— Management Committee`, type: 'GENERAL', priority: 'HIGH', isActive: true, isPinned: true, isUrgent: true, publishAt: daysAgo(2), expiresAt: daysFromNow(12), societyId: society.id, createdById: admin.id, images: [], documents: [] } });
  await prisma.notice.create({ data: { title: 'Water Supply Disruption — 5th April', description: `Due to PMC pipeline maintenance:\n\nDate: 5th April 2026 (Sunday)\nTime: 10:00 AM to 3:00 PM\nAffected: All towers\n\nPlease store water in advance.\n\n— Maintenance Team`, type: 'MAINTENANCE', priority: 'HIGH', isActive: true, isPinned: true, isUrgent: true, publishAt: daysAgo(1), expiresAt: daysFromNow(5), societyId: society.id, createdById: admin.id, images: [], documents: [] } });
  await prisma.notice.create({ data: { title: 'Summer Camp Registration Open — Greenfield Kids Club', description: `Attention Parents!\n\nSummer Camp 2026 registration is now open.\n\nActivities: Swimming, Art, Coding, Dance, Yoga\nAge Group: 5-15 years\nDates: 15 April to 15 May 2026\nFee: ₹8,000 (all inclusive)\n\nRegister at admin office or WhatsApp 9820001111.\nLimited seats — first come first served!\n\n— Cultural Committee`, type: 'EVENT', priority: 'MEDIUM', isActive: true, isPinned: true, publishAt: daysAgo(3), expiresAt: daysFromNow(20), societyId: society.id, createdById: admin.id, images: [], documents: [] } });
  await prisma.notice.create({ data: { title: 'New Parking Policy — Effective 1st April', description: `New parking regulations:\n\n1. All vehicles MUST display society stickers\n2. Visitor parking limited to 3 hours\n3. No parking in fire lane — towing enforced\n4. Two-wheelers only in designated zones\n\nSticker registration: Admin office or online portal.\n\n— Security Committee`, type: 'GENERAL', priority: 'MEDIUM', isActive: true, publishAt: daysAgo(7), expiresAt: daysFromNow(30), societyId: society.id, createdById: admin.id, images: [], documents: [] } });
  await prisma.notice.create({ data: { title: 'Quarterly Pest Control — 8th April', description: `Tower A: 8th April, 9 AM - 12 PM\nTower B: 8th April, 2 PM - 5 PM\nTower C: 9th April, 9 AM - 12 PM\n\nKeep windows open, cover food, remove pets.\n\nContact: 9820001234 to reschedule.`, type: 'MAINTENANCE', priority: 'MEDIUM', isActive: true, publishAt: daysAgo(3), expiresAt: daysFromNow(15), societyId: society.id, createdById: admin.id, images: [], documents: [] } });
  await prisma.notice.create({ data: { title: 'Gym Upgrade Complete!', description: `New equipment added:\n✓ 2 Commercial Treadmills\n✓ Rowing Machine\n✓ Additional Free Weights\n✓ New Yoga Mats\n\nHours: 5:30 AM - 10:00 PM daily.\n\n— Amenities Committee`, type: 'GENERAL', priority: 'LOW', isActive: true, publishAt: daysAgo(4), societyId: society.id, createdById: admin.id, images: [], documents: [] } });
  console.log('✅ 6 notices\n');

  // ============================================
  // COMPLAINTS
  // ============================================
  console.log('📝 Creating complaints...');
  await prisma.complaint.create({ data: { title: 'Elevator #2 in Tower A Stuck', description: 'Elevator #2 has been malfunctioning for 3 days. Gets stuck between floors 5 and 6. Safety hazard for elderly residents.', category: 'MAINTENANCE', priority: 'HIGH', status: 'IN_PROGRESS', flatId: flat('A101').id, societyId: society.id, reportedById: res1.id, isAnonymous: false } });
  await prisma.complaint.create({ data: { title: 'Water Leakage from Overhead Tank', description: 'Continuous dripping from overhead tank near main gate. Slippery pavement — ongoing for a week.', category: 'WATER', priority: 'HIGH', status: 'RESOLVED', flatId: flat('A301').id, societyId: society.id, reportedById: res2.id, isAnonymous: false, resolvedAt: daysAgo(2) } });
  await prisma.complaint.create({ data: { title: 'Loud Music After 11 PM — B103', description: 'Neighbor in B103 plays loud music every weekend till 2 AM. Affecting children\'s sleep. No cooperation despite requests.', category: 'NOISE', priority: 'MEDIUM', status: 'OPEN', flatId: flat('B102').id, societyId: society.id, reportedById: res3.id, isAnonymous: false } });
  await prisma.complaint.create({ data: { title: 'Unauthorized Parking in My Slot', description: 'A white car (MH12XX1234) regularly parks in my designated slot A-P2. Had to park on street multiple times.', category: 'PARKING', priority: 'HIGH', status: 'OPEN', flatId: flat('A101').id, societyId: society.id, reportedById: res1.id, isAnonymous: false } });
  await prisma.complaint.create({ data: { title: 'Street Lights Not Working — Tower C Parking', description: '4 street lights near Tower C parking area out for 2 weeks. Safety concern especially for women after dark.', category: 'ELECTRICITY', priority: 'HIGH', status: 'IN_PROGRESS', flatId: flat('C201').id, societyId: society.id, reportedById: res5.id, isAnonymous: false } });
  await prisma.complaint.create({ data: { title: 'Construction Debris Near Tower B', description: 'Construction debris dumped near Tower B garbage area for 4-5 days. Bad smell and blocking walkway.', category: 'CLEANLINESS', priority: 'MEDIUM', status: 'OPEN', flatId: flat('C401').id, societyId: society.id, reportedById: res6.id, isAnonymous: false } });
  await prisma.complaint.create({ data: { title: 'Security Guard Misbehavior', description: 'One guard at main gate has been rude and delays entry approvals. Disrespectful to residents on multiple occasions.', category: 'SECURITY', priority: 'HIGH', status: 'OPEN', flatId: flat('A301').id, societyId: society.id, reportedById: res2.id, isAnonymous: true } });
  console.log('✅ 7 complaints\n');

  // ============================================
  // EMERGENCIES
  // ============================================
  console.log('🚨 Creating emergencies...');
  await prisma.emergency.create({ data: { type: 'FIRE', description: 'Kitchen fire in A101. Oil overheated. Controlled with extinguisher. No injuries. Fire brigade called as precaution.', status: 'RESOLVED', resolvedAt: daysAgo(15), flatId: flat('A101').id, societyId: society.id, reportedById: res1.id } });
  await prisma.emergency.create({ data: { type: 'MEDICAL', description: 'Mr. Mohan Joshi (B401) slipped in bathroom. Suspected hip injury. Transported to Ruby Hall Clinic. Surgery done, recovering well.', status: 'RESOLVED', resolvedAt: daysAgo(8), flatId: flat('B401').id, societyId: society.id, reportedById: res4Spouse.id } });
  console.log('✅ 2 emergencies\n');

  // ============================================
  // VENDORS (with ratings + likes)
  // ============================================
  console.log('🏪 Creating vendors...');
  const v1 = await prisma.vendor.create({ data: { name: 'Kumar Plumbing Services', category: 'PLUMBER', phone: '9860000001', email: 'info@kumarplumbing.com', description: 'Professional plumbing — pipe repairs, tap installation, drainage. 24/7 emergency. 15+ years experience.', isVerified: true, isActive: true, rating: 4.6, totalReviews: 23, likesCount: 8, workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], workingHours: '8:00 AM - 8:00 PM', societyId: society.id, addedById: admin.id } });
  const v2 = await prisma.vendor.create({ data: { name: 'Bright Spark Electricians', category: 'ELECTRICIAN', phone: '9860000002', email: 'contact@brightspark.in', description: 'Certified electricians — wiring, MCB, geyser/AC repairs, smart home. Emergency service available.', isVerified: true, isActive: true, rating: 4.8, totalReviews: 31, likesCount: 14, workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], workingHours: '9:00 AM - 7:00 PM', societyId: society.id, addedById: admin.id } });
  const v3 = await prisma.vendor.create({ data: { name: 'AC Care Technicians', category: 'APPLIANCE_REPAIR', phone: '9860000003', email: 'service@accare.com', description: 'AC installation, repair, gas refilling, AMC. All brands. Same-day service.', isVerified: true, isActive: true, rating: 4.5, totalReviews: 18, likesCount: 6, workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], workingHours: '9:00 AM - 6:00 PM', societyId: society.id, addedById: admin.id } });
  await prisma.vendor.create({ data: { name: 'QuickFix Carpenters', category: 'CARPENTER', phone: '9860000004', email: 'work@quickfix.com', description: 'Custom furniture, door/window repairs, modular kitchen. Free estimates.', isVerified: true, isActive: true, rating: 4.4, totalReviews: 12, likesCount: 4, workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], workingHours: '10:00 AM - 6:00 PM', societyId: society.id, addedById: admin.id } });
  await prisma.vendor.create({ data: { name: 'HomePaint Solutions', category: 'PAINTER', phone: '9860000005', email: 'paint@homepaint.in', description: 'Interior/exterior painting, texture work, waterproofing. Asian Paints authorized applicators.', isVerified: true, isActive: true, rating: 4.7, totalReviews: 9, likesCount: 11, workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], workingHours: '8:00 AM - 6:00 PM', societyId: society.id, addedById: res1.id } });
  await prisma.vendor.create({ data: { name: 'PestGuard Services', category: 'PEST_CONTROL', phone: '9860000006', email: 'info@pestguard.in', description: 'Eco-friendly pest control — cockroaches, termites, bedbugs, rodents. Safe for kids & pets. AMC available.', isVerified: true, isActive: true, rating: 4.3, totalReviews: 15, likesCount: 5, workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], workingHours: '8:00 AM - 5:00 PM', societyId: society.id, addedById: admin.id } });
  await prisma.vendor.create({ data: { name: 'CleanHome Pro', category: 'CLEANER', phone: '9860000007', email: 'book@cleanhome.in', description: 'Deep cleaning, sofa cleaning, bathroom sanitization, move-in/out cleaning. Trained staff.', isVerified: false, isActive: true, rating: 4.1, totalReviews: 7, likesCount: 2, workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], workingHours: '8:00 AM - 6:00 PM', societyId: society.id, addedById: res5.id } });
  await prisma.vendor.create({ data: { name: 'GreenThumb Landscaping', category: 'GARDENER', phone: '9860000008', email: 'hello@greenthumb.in', description: 'Garden maintenance, plant care, landscape design, terrace garden setup. Monthly plans available.', isVerified: true, isActive: true, rating: 4.9, totalReviews: 8, likesCount: 9, workingDays: ['MON', 'WED', 'FRI', 'SAT'], workingHours: '7:00 AM - 1:00 PM', societyId: society.id, addedById: admin.id } });

  // Vendor likes
  await prisma.vendorLike.createMany({ data: [
    { vendorId: v1.id, userId: res1.id },
    { vendorId: v1.id, userId: res2.id },
    { vendorId: v2.id, userId: res1.id },
    { vendorId: v2.id, userId: res3.id },
    { vendorId: v2.id, userId: res5.id },
    { vendorId: v3.id, userId: res4.id },
  ]});
  console.log('✅ 8 vendors + 6 likes\n');

  // ============================================
  // VISITOR FREQUENCY
  // ============================================
  console.log('👥 Creating visitor frequency...');
  await prisma.visitorFrequency.create({ data: { visitorName: 'Rohit Patil', visitorPhone: '9830000001', flatId: flat('A101').id, societyId: society.id, visitCount: 8, lastVisit: daysAgo(2) } });
  await prisma.visitorFrequency.create({ data: { visitorName: 'Lakshmi Devi', visitorPhone: '9820000001', flatId: flat('A101').id, societyId: society.id, visitCount: 45, lastVisit: hoursAgo(2) } });
  await prisma.visitorFrequency.create({ data: { visitorName: 'Ramesh Yadav', visitorPhone: '9820000002', flatId: flat('B102').id, societyId: society.id, visitCount: 38, lastVisit: hoursAgo(1.5) } });
  console.log('✅ 3 visitor frequency records\n');

  // ============================================
  // COMMUNITY POSTS
  // ============================================
  console.log('📣 Creating community posts...');
  const post1 = await prisma.communityPost.create({
    data: {
      title: 'Lost — Black Labrador puppy "Bruno" near Tower C',
      content: 'Our black lab puppy Bruno (6 months, collar with phone number) went missing yesterday evening near Tower C parking. He is very friendly. Please check your cameras or WhatsApp 9811000010 if you spot him. Offering reward.',
      category: 'LOST_FOUND',
      isAnonymous: false,
      authorId: res5.id,
      societyId: society.id,
      likesCount: 12,
      commentsCount: 3,
    },
  });

  const post2 = await prisma.communityPost.create({
    data: {
      title: 'CCTV blind spots near C-Block staircase — security concern',
      content: 'Noticed that the CCTV cameras near Tower C staircase (floor 3-4) have a significant blind spot. Anyone can enter undetected. Raising this as a security concern — request management to review camera placement.',
      category: 'ISSUE',
      isAnonymous: false,
      authorId: res6.id,
      societyId: society.id,
      isPinned: true,
      likesCount: 24,
      commentsCount: 5,
    },
  });

  const post3 = await prisma.communityPost.create({
    data: {
      title: 'Holi celebration was fantastic! Big thanks to cultural committee 🎨',
      content: 'Just wanted to appreciate the cultural committee for organizing such a vibrant Holi celebration. The arrangements, food, and music were all top-notch. Special thanks to Agastya and the volunteers. Let\'s keep this tradition going every year!',
      category: 'APPRECIATION',
      isAnonymous: false,
      authorId: res1.id,
      societyId: society.id,
      likesCount: 31,
      commentsCount: 7,
    },
  });

  const post4 = await prisma.communityPost.create({
    data: {
      title: 'Anyone interested in a morning walking group?',
      content: 'Planning to start a morning walking/jogging group around the society campus. Thinking 6:30 AM daily. Good for health and community bonding! Who\'s interested? Reply below.',
      category: 'GENERAL',
      isAnonymous: false,
      authorId: res2.id,
      societyId: society.id,
      likesCount: 18,
      commentsCount: 6,
    },
  });

  const post5 = await prisma.communityPost.create({
    data: {
      title: 'Selling: Barely used kitchen appliances — moving out',
      content: 'Moving to Bangalore next month. Selling: Philips Air Fryer (6 months old, ₹2500), Bosch Mixer (₹1800), Prestige Induction Cooker (₹1200). All in excellent condition. Whatsapp 9811000006.',
      category: 'FOR_SALE',
      isAnonymous: false,
      authorId: res3.id,
      societyId: society.id,
      likesCount: 4,
      commentsCount: 2,
    },
  });

  const post6 = await prisma.communityPost.create({
    data: {
      title: 'Suggestion: Can we get a dedicated EV charging station?',
      content: 'With more residents buying EVs (I recently got the Nexon EV), it would be great if the society could install 2-3 EV charging points in the parking area. Monthly subscription model could make it self-sustaining. Happy to coordinate with admin if needed.',
      category: 'QUESTION',
      isAnonymous: false,
      authorId: res6.id,
      societyId: society.id,
      likesCount: 22,
      commentsCount: 4,
    },
  });

  const post7 = await prisma.communityPost.create({
    data: {
      title: 'Water leakage from terrace — B-Block 4th floor corridor',
      content: 'There is a persistent water seepage from the terrace into the B-Block 4th floor corridor. The paint is peeling and the floor is slippery — safety hazard during rains. Reported to the office 2 weeks ago but no update. Requesting urgent maintenance.',
      category: 'MAINTENANCE',
      isAnonymous: false,
      authorId: res4.id,
      societyId: society.id,
      likesCount: 15,
      commentsCount: 3,
    },
  });

  const post8 = await prisma.communityPost.create({
    data: {
      title: 'Unknown vehicles parking near main gate — safety alert',
      content: 'For the past 3 days I have noticed 2 unregistered bikes parked near the main gate entrance late at night (after 11 PM). Guards seem unaware. Flagging this as a safety concern — can management ask guards to verify and log all overnight vehicles?',
      category: 'SAFETY',
      isAnonymous: true,
      authorId: res2.id,
      societyId: society.id,
      likesCount: 19,
      commentsCount: 2,
    },
  });

  // Post likes
  await prisma.postLike.createMany({ data: [
    { postId: post1.id, userId: res1.id },
    { postId: post1.id, userId: res2.id },
    { postId: post1.id, userId: res3.id },
    { postId: post2.id, userId: res1.id },
    { postId: post2.id, userId: res5.id },
    { postId: post3.id, userId: res2.id },
    { postId: post3.id, userId: res4.id },
    { postId: post4.id, userId: res1.id },
    { postId: post6.id, userId: res5.id },
    { postId: post7.id, userId: res1.id },
    { postId: post7.id, userId: res3.id },
    { postId: post8.id, userId: res4.id },
    { postId: post8.id, userId: res6.id },
  ]});

  // Post comments
  await prisma.postComment.createMany({ data: [
    { postId: post1.id, content: 'Shared in the Tower C residents group. Hope Bruno is found safe!', authorId: res4.id, societyId: society.id },
    { postId: post1.id, content: 'Saw a black dog near the service gate this morning. Could be him!', authorId: res3.id, societyId: society.id },
    { postId: post1.id, content: 'Putting up a notice on the board too. Hope he comes home soon.', authorId: res2.id, societyId: society.id },
    { postId: post2.id, content: 'Completely agree. Raised this with Agastya last week too. Needs immediate attention.', authorId: res1.id, societyId: society.id },
    { postId: post2.id, content: 'Will get a quote from the security camera vendor and share update by Friday.', authorId: admin.id, societyId: society.id },
    { postId: post3.id, content: 'Totally agree! Best Holi in years. The thandai was amazing 😄', authorId: res4.id, societyId: society.id },
    { postId: post3.id, content: 'Thanks everyone for participating! Already planning Diwali 🪔', authorId: admin.id, societyId: society.id },
    { postId: post4.id, content: 'Count me in! 6:30 AM works perfectly.', authorId: res1.id, societyId: society.id },
    { postId: post4.id, content: 'I\'m in too! Should we create a WhatsApp group?', authorId: res5.id, societyId: society.id },
    { postId: post6.id, content: 'Great idea! I\'d also contribute to the installation cost. Let\'s poll the residents.', authorId: res5.id, societyId: society.id },
    { postId: post6.id, content: 'Looking into the costs and feasibility. Will share a proposal with the committee.', authorId: admin.id, societyId: society.id },
    { postId: post7.id, content: 'Same issue on floor 3 too. Please escalate this urgently before monsoon.', authorId: res1.id, societyId: society.id },
    { postId: post7.id, content: 'Terrace waterproofing is scheduled for next month. Will prioritize B-Block.', authorId: admin.id, societyId: society.id },
    { postId: post7.id, content: 'Please put a wet floor sign in the meantime — it\'s really slippery.', authorId: res6.id, societyId: society.id },
    { postId: post8.id, content: 'Guards have been instructed to log all vehicles parked overnight. Thank you for flagging.', authorId: admin.id, societyId: society.id },
    { postId: post8.id, content: 'Good catch. We should also consider installing boom barriers at the entrance.', authorId: res5.id, societyId: society.id },
  ]});

  console.log('✅ 8 posts + 13 likes + 16 comments\n');

  // ============================================
  // SOCIETY DOCUMENTS
  // ============================================
  console.log('📄 Creating society documents...');
  await prisma.societyDocument.createMany({ data: [
    { name: 'Society Byelaws 2024', description: 'Registered byelaws of Greenfield Heights CHS', category: 'RULES_AND_BYLAWS', fileUrl: 'https://society-gate-documents.s3.ap-south-1.amazonaws.com/general/admin/byelaws-2024.pdf', fileKey: 'general/admin/byelaws-2024.pdf', fileName: 'byelaws-2024.pdf', fileSizeMB: 2.4, fileType: 'PDF', isAdminDoc: true, uploadedById: admin.id, societyId: society.id },
    { name: 'AGM Minutes — February 2026', description: 'Annual General Meeting minutes dated 15 Feb 2026', category: 'MEETING_MINUTES', fileUrl: 'https://society-gate-documents.s3.ap-south-1.amazonaws.com/general/admin/agm-feb-2026.pdf', fileKey: 'general/admin/agm-feb-2026.pdf', fileName: 'agm-feb-2026.pdf', fileSizeMB: 0.8, fileType: 'PDF', isAdminDoc: true, uploadedById: admin.id, societyId: society.id },
    { name: 'Annual Maintenance Budget FY 2025-26', description: 'Approved annual maintenance fund budget', category: 'FINANCIAL', fileUrl: 'https://society-gate-documents.s3.ap-south-1.amazonaws.com/general/admin/budget-fy26.pdf', fileKey: 'general/admin/budget-fy26.pdf', fileName: 'budget-fy26.pdf', fileSizeMB: 1.1, fileType: 'PDF', isAdminDoc: true, uploadedById: admin.id, societyId: society.id },
    { name: 'Parking Allotment Chart 2024', description: 'Official parking slot allocation for all residents', category: 'CIRCULAR', fileUrl: 'https://society-gate-documents.s3.ap-south-1.amazonaws.com/general/admin/parking-chart.pdf', fileKey: 'general/admin/parking-chart.pdf', fileName: 'parking-chart.pdf', fileSizeMB: 0.5, fileType: 'PDF', isAdminDoc: true, uploadedById: admin.id, societyId: society.id },
    { name: 'House Lease Agreement — A101', description: 'Personal copy of lease agreement', category: 'PERSONAL', fileUrl: 'https://society-gate-documents.s3.ap-south-1.amazonaws.com/general/res1/lease-a101.pdf', fileKey: 'general/res1/lease-a101.pdf', fileName: 'lease-a101.pdf', fileSizeMB: 1.8, fileType: 'PDF', isAdminDoc: false, uploadedById: res1.id, societyId: society.id },
    { name: 'Rental Agreement — B102', description: 'Registered rental agreement for B102', category: 'PERSONAL', fileUrl: 'https://society-gate-documents.s3.ap-south-1.amazonaws.com/general/res3/rental-b102.pdf', fileKey: 'general/res3/rental-b102.pdf', fileName: 'rental-b102.pdf', fileSizeMB: 2.1, fileType: 'PDF', isAdminDoc: false, uploadedById: res3.id, societyId: society.id },
  ]});
  console.log('✅ 6 documents (4 admin, 2 personal)\n');

  // ============================================
  // POLLS / ELECTIONS
  // ============================================
  console.log('🗳️ Creating polls...');

  // Poll 1 — Active: EV charging stations
  const poll1 = await prisma.poll.create({
    data: {
      title: 'Should we install EV charging stations in the parking area?',
      description: 'With increasing EV adoption, the committee is evaluating installing 4 EV charging points. Cost would be shared equally across all 96 flats (~₹2,500 one-time per flat). Vote to help us decide.',
      status: 'ACTIVE',
      isAnonymous: false,
      allowMultiple: false,
      votingEndsAt: daysFromNow(10),
      createdById: admin.id,
      societyId: society.id,
      options: {
        create: [
          { text: 'Yes — install 4 charging points, happy to contribute', votes: 31 },
          { text: 'Yes — but use society maintenance fund, no extra charge', votes: 14 },
          { text: 'No — not enough demand yet', votes: 7 },
          { text: 'Need more information before deciding', votes: 4 },
        ],
      },
    },
    include: { options: true },
  });

  // Poll 2 — Active: Night entry cutoff time
  const poll2 = await prisma.poll.create({
    data: {
      title: 'What should be the night entry cutoff for guests?',
      description: 'Currently guests are allowed entry until 11:30 PM. The security committee has proposed changing this. Please vote for your preferred time.',
      status: 'ACTIVE',
      isAnonymous: true,
      allowMultiple: false,
      votingEndsAt: daysFromNow(5),
      createdById: admin.id,
      societyId: society.id,
      options: {
        create: [
          { text: 'Keep current time — 11:30 PM', votes: 18 },
          { text: 'Move to 11:00 PM', votes: 22 },
          { text: 'Move to 10:30 PM', votes: 9 },
          { text: 'No restriction — 24/7 access', votes: 3 },
        ],
      },
    },
    include: { options: true },
  });

  // Poll 3 — Closed: New intercom system
  const poll3 = await prisma.poll.create({
    data: {
      title: 'Upgrade society intercom to video doorbell system?',
      description: 'Proposal to replace existing intercom with app-based video doorbells. Each flat gets one unit. Cost: ₹4,200 per flat from maintenance fund.',
      status: 'CLOSED',
      isAnonymous: false,
      allowMultiple: false,
      votingEndsAt: daysAgo(5),
      createdById: admin.id,
      societyId: society.id,
      options: {
        create: [
          { text: 'Yes — strongly approve', votes: 48 },
          { text: 'Yes — but reduce cost', votes: 21 },
          { text: 'No — current system is fine', votes: 12 },
          { text: 'Abstain', votes: 5 },
        ],
      },
    },
    include: { options: true },
  });

  // Add resident votes for poll1
  await prisma.pollVote.createMany({ data: [
    { pollId: poll1.id, optionId: poll1.options[0].id, votedById: res1.id },
    { pollId: poll1.id, optionId: poll1.options[0].id, votedById: res2.id },
    { pollId: poll1.id, optionId: poll1.options[1].id, votedById: res3.id },
    { pollId: poll1.id, optionId: poll1.options[2].id, votedById: res4.id },
    { pollId: poll1.id, optionId: poll1.options[0].id, votedById: res5.id },
  ]});

  // Add resident votes for poll2
  await prisma.pollVote.createMany({ data: [
    { pollId: poll2.id, optionId: poll2.options[1].id, votedById: res1.id },
    { pollId: poll2.id, optionId: poll2.options[1].id, votedById: res2.id },
    { pollId: poll2.id, optionId: poll2.options[0].id, votedById: res4.id },
  ]});

  // Votes for poll3 (closed)
  await prisma.pollVote.createMany({ data: [
    { pollId: poll3.id, optionId: poll3.options[0].id, votedById: res1.id },
    { pollId: poll3.id, optionId: poll3.options[0].id, votedById: res5.id },
    { pollId: poll3.id, optionId: poll3.options[1].id, votedById: res3.id },
    { pollId: poll3.id, optionId: poll3.options[2].id, votedById: res4.id },
    { pollId: poll3.id, optionId: poll3.options[0].id, votedById: res6.id },
  ]});

  console.log('✅ 3 polls (2 active, 1 closed) + votes\n');

  // ============================================
  // NOTIFICATIONS
  // ============================================
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({ data: [
    { type: 'SYSTEM', title: 'Welcome to Greenfield Heights', message: 'Your account has been activated. Explore the app!', userId: res1.id, societyId: society.id, isRead: true, readAt: daysAgo(60) },
    { type: 'ENTRY_REQUEST', title: 'Delivery at Gate', message: 'Zomato delivery waiting for approval at main gate.', userId: res2.id, societyId: society.id, isRead: false, referenceType: 'EntryRequest' },
    { type: 'ONBOARDING_STATUS', title: 'Booking Confirmed', message: 'Your banquet hall booking for April 5 has been confirmed.', userId: res1.id, societyId: society.id, isRead: true, readAt: daysAgo(1), referenceType: 'AmenityBooking' },
    { type: 'DELIVERY_REQUEST', title: 'Amazon Package', message: 'Your Amazon delivery is expected today between 2-4 PM.', userId: res1.id, societyId: society.id, isRead: false },
    { type: 'EMERGENCY_ALERT', title: 'Fire Incident Resolved', message: 'Kitchen fire in A-101 has been controlled. No injuries reported.', userId: admin.id, societyId: society.id, isRead: true, readAt: daysAgo(15) },
    { type: 'STAFF_CHECKIN', title: 'Staff Arrived', message: 'Lakshmi Devi (Maid) checked in at 8:05 AM.', userId: res1.id, societyId: society.id, isRead: true, readAt: hoursAgo(4) },
    { type: 'SYSTEM', title: 'New Poll: EV Charging Stations', message: 'A new poll has been created. Your vote matters!', userId: res5.id, societyId: society.id, isRead: false },
    { type: 'SYSTEM', title: 'Vehicle Registration Pending', message: 'Your vehicle MH12QR0011 is awaiting admin approval.', userId: res4.id, societyId: society.id, isRead: false },
  ]});
  console.log('✅ 8 notifications\n');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Seed completed successfully!\n');
  console.log('═══════════════════════════════════════════');
  console.log('         GREENFIELD HEIGHTS — PUNE');
  console.log('═══════════════════════════════════════════');
  console.log('  Society:          1 (Greenfield Heights)');
  console.log('  Gate Points:      2');
  console.log('  Blocks:           3 (Tower A, B, C)');
  console.log('  Flats:            96 (72 occupied)');
  console.log('  Users:            18');
  console.log('                    1 super admin');
  console.log('                    1 admin (Agastya)');
  console.log('                    3 guards');
  console.log('                    13 residents (6 families)');
  console.log('  Onboarding:       6 approved');
  console.log('  Vehicles:         8 (7 active, 1 pending)');
  console.log('  Amenities:        6');
  console.log('  Bookings:         6');
  console.log('  Domestic Staff:   6 (5 verified, 1 pending)');
  console.log('  Staff Assignments: 8');
  console.log('  Attendance:       46+ records (30-day history)');
  console.log('  Staff Reviews:    6');
  console.log('  Staff Bookings:   2');
  console.log('  Gate Passes:      2');
  console.log('  Entries:          7');
  console.log('  Entry Requests:   2 (pending at gate)');
  console.log('  Notices:          6');
  console.log('  Complaints:       7');
  console.log('  Emergencies:      2');
  console.log('  Vendors:          8 + 6 likes');
  console.log('  Community Posts:  8 + 13 likes + 16 comments');
  console.log('  Documents:        6 (4 admin, 2 personal)');
  console.log('  Polls:            3 (2 active, 1 closed) + votes');
  console.log('  Visitor Freq:     3');
  console.log('  Notifications:    8');
  console.log('═══════════════════════════════════════════');
  console.log('\n🔑 KEY LOGIN ACCOUNTS:');
  console.log('───────────────────────────────────────────');
  console.log('SUPER ADMIN:    9999900000');
  console.log('ADMIN:          7484827530  (Agastya)');
  console.log('GUARD:          9800000001  (Rajendra Singh)');
  console.log('───────────────────────────────────────────');
  console.log('RESIDENTS:');
  console.log('  9811000001  Amit Sharma      A101  (IT, owner)');
  console.log('  9811000004  Dr. Sneha Kulkarni A301 (Doctor, owner)');
  console.log('  9811000006  Vikram Chauhan   B102  (Finance, tenant)');
  console.log('  9811000008  Mohan Joshi      B401  (Retired, owner)');
  console.log('  9811000010  Priya Desai      C201  (Startup, owner)');
  console.log('  9811000011  Karthik Nair     C401  (SWE, owner)');
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
