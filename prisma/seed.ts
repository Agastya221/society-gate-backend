import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Helper functions
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const hoursAgo = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
};

async function main() {
  console.log('🌱 Starting realistic database seed...\n');

  // ============================================
  // CLEAN DATABASE
  // ============================================
  console.log('🧹 Cleaning...');
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
  await prisma.preApproval.deleteMany();
  await prisma.gatePass.deleteMany();
  await prisma.expectedDelivery.deleteMany();
  await prisma.deliveryAutoApproveRule.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.paymentReminder.deleteMany();
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
  // SOCIETY — Greenfield Heights, Pune
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
  // BLOCKS — 3 towers
  // ============================================
  console.log('🏗️ Creating blocks...');
  const towerA = await prisma.block.create({
    data: {
      name: 'Tower A (Jasmine)',
      societyId: society.id,
      totalFloors: 8,
      description: 'East-facing 2BHK & 3BHK apartments',
    },
  });

  const towerB = await prisma.block.create({
    data: {
      name: 'Tower B (Orchid)',
      societyId: society.id,
      totalFloors: 8,
      description: 'West-facing premium 3BHK & 4BHK apartments',
    },
  });

  const towerC = await prisma.block.create({
    data: {
      name: 'Tower C (Lily)',
      societyId: society.id,
      totalFloors: 8,
      description: 'North-facing 2BHK compact units',
    },
  });
  console.log('✅ 3 blocks\n');

  // ============================================
  // FLATS — 32 per tower = 96 total
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
            isOccupied: floor <= 6, // top 2 floors vacant
          },
        });
        flats.push(flat);
      }
    }
  }
  console.log(`✅ ${flats.length} flats\n`);

  // Helper: get flat by number
  const flat = (num: string) => flats.find((f: any) => f.flatNumber === num);

  // ============================================
  // USERS
  // ============================================
  console.log('👥 Creating users...');

  // --- SUPER ADMIN (platform level) ---
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Platform Admin',
      phone: '9999900000',
      email: 'superadmin@sgate.in',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // --- YOU — Society Admin ---
  const admin = await prisma.user.create({
    data: {
      name: 'Agastya',
      phone: '7484827530',
      email: 'admin@greenfieldheights.in',
      role: 'ADMIN',
      societyId: society.id,
      isActive: true,
    },
  });

  // --- GUARDS ---
  const guard1 = await prisma.user.create({
    data: {
      name: 'Rajendra Singh',
      phone: '9800000001',
      role: 'GUARD',
      societyId: society.id,
      isActive: true,
    },
  });

  const guard2 = await prisma.user.create({
    data: {
      name: 'Sunil Yadav',
      phone: '9800000002',
      role: 'GUARD',
      societyId: society.id,
      isActive: true,
    },
  });

  const guard3 = await prisma.user.create({
    data: {
      name: 'Bhola Prasad',
      phone: '9800000003',
      role: 'GUARD',
      societyId: society.id,
      isActive: true,
    },
  });

  // --- RESIDENT FAMILIES ---

  // Family 1 — A101 (IT professional + spouse + child)
  const res1 = await prisma.user.create({
    data: {
      name: 'Amit Sharma',
      phone: '9811000001',
      email: 'amit.sharma@techcorp.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('A101').id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Neha Sharma',
      phone: '9811000002',
      email: 'neha.sharma@designer.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('A101').id,
      isPrimaryResident: false,
      primaryResidentId: res1.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Aarav Sharma',
      phone: '9811000003',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('A101').id,
      isPrimaryResident: false,
      primaryResidentId: res1.id,
      familyRole: 'CHILD',
      isActive: true,
    },
  });

  // Family 2 — A301 (Doctor, single parent + kid)
  const res2 = await prisma.user.create({
    data: {
      name: 'Dr. Sneha Kulkarni',
      phone: '9811000004',
      email: 'sneha.kulkarni@hospital.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('A301').id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Ishaan Kulkarni',
      phone: '9811000005',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('A301').id,
      isPrimaryResident: false,
      primaryResidentId: res2.id,
      familyRole: 'CHILD',
      isActive: true,
    },
  });

  // Family 3 — B102 (Tenant couple, investment banker)
  const res3 = await prisma.user.create({
    data: {
      name: 'Vikram Chauhan',
      phone: '9811000006',
      email: 'vikram.chauhan@finance.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('B102').id,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const res3Spouse = await prisma.user.create({
    data: {
      name: 'Ananya Chauhan',
      phone: '9811000007',
      email: 'ananya.chauhan@architect.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('B102').id,
      isPrimaryResident: false,
      primaryResidentId: res3.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  // Family 4 — B401 (Retired couple)
  const res4 = await prisma.user.create({
    data: {
      name: 'Mohan Joshi',
      phone: '9811000008',
      email: 'mohan.joshi@retired.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('B401').id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const res4Spouse = await prisma.user.create({
    data: {
      name: 'Sunita Joshi',
      phone: '9811000009',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('B401').id,
      isPrimaryResident: false,
      primaryResidentId: res4.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  // Family 5 — C201 (Young professional, lives alone)
  const res5 = await prisma.user.create({
    data: {
      name: 'Priya Desai',
      phone: '9811000010',
      email: 'priya.desai@startup.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('C201').id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  // Family 6 — C401 (Software engineer + spouse + parent)
  const res6 = await prisma.user.create({
    data: {
      name: 'Karthik Nair',
      phone: '9811000011',
      email: 'karthik.nair@techgiant.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('C401').id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Divya Nair',
      phone: '9811000012',
      email: 'divya.nair@teacher.in',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('C401').id,
      isPrimaryResident: false,
      primaryResidentId: res6.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Ramesh Nair',
      phone: '9811000013',
      role: 'RESIDENT',
      societyId: society.id,
      flatId: flat('C401').id,
      isPrimaryResident: false,
      primaryResidentId: res6.id,
      familyRole: 'PARENT',
      isActive: true,
    },
  });

  console.log('✅ 18 users (1 super admin, 1 admin, 3 guards, 13 residents)\n');

  // ============================================
  // ONBOARDING REQUESTS (approved residents)
  // ============================================
  console.log('📋 Creating onboarding records...');
  for (const r of [res1, res2, res3, res4, res5, res6]) {
    await prisma.onboardingRequest.create({
      data: {
        userId: r.id,
        societyId: society.id,
        blockId: towerA.id,
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
  // VEHICLES
  // ============================================
  console.log('🚗 Creating vehicles...');
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12AB1234',
      vehicleType: 'Car',
      model: 'Hyundai Creta SX',
      color: 'Polar White',
      isActive: true,
      userId: res1.id,
      flatId: flat('A101').id,
      societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12CD5678',
      vehicleType: 'Bike',
      model: 'Royal Enfield Classic 350',
      color: 'Stealth Black',
      isActive: true,
      userId: res1.id,
      flatId: flat('A101').id,
      societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH14EF9012',
      vehicleType: 'Car',
      model: 'Toyota Fortuner 4x4',
      color: 'Super White',
      isActive: true,
      userId: res2.id,
      flatId: flat('A301').id,
      societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12GH3456',
      vehicleType: 'Car',
      model: 'BMW X5 xDrive',
      color: 'Phytonic Blue',
      isActive: true,
      userId: res3.id,
      flatId: flat('B102').id,
      societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12JK7890',
      vehicleType: 'Bike',
      model: 'Honda Activa 6G',
      color: 'Matte Grey',
      isActive: true,
      userId: res3Spouse.id,
      flatId: flat('B102').id,
      societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH12LM2345',
      vehicleType: 'Car',
      model: 'Maruti Swift VDi',
      color: 'Pearl Arctic White',
      isActive: true,
      userId: res5.id,
      flatId: flat('C201').id,
      societyId: society.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH14NP6789',
      vehicleType: 'Car',
      model: 'Tata Nexon EV',
      color: 'Teal Blue',
      isActive: true,
      userId: res6.id,
      flatId: flat('C401').id,
      societyId: society.id,
    },
  });
  console.log('✅ 7 vehicles\n');

  // ============================================
  // AMENITIES
  // ============================================
  console.log('🏊 Creating amenities...');
  const gym = await prisma.amenity.create({
    data: {
      name: 'Greenfield Fitness Studio',
      type: 'GYM',
      description: 'Fully-equipped gym with treadmills, ellipticals, cross-trainers and free weights. Personal trainer available 6-8 AM & 6-8 PM.',
      capacity: 25,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society.id,
    },
  });

  const pool = await prisma.amenity.create({
    data: {
      name: 'Aqua Pool',
      type: 'SWIMMING_POOL',
      description: 'Semi-Olympic size pool (25m x 12m) with kids pool. Lifeguard on duty 6 AM - 9 PM.',
      capacity: 40,
      pricePerHour: 250,
      maxBookingsPerUser: 3,
      isActive: true,
      societyId: society.id,
    },
  });

  const clubhouse = await prisma.amenity.create({
    data: {
      name: 'Grand Banquet Hall',
      type: 'CLUBHOUSE',
      description: 'AC banquet hall with stage, sound system, and catering area. Capacity 150 guests. Perfect for weddings and parties.',
      capacity: 150,
      pricePerHour: 3000,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society.id,
    },
  });

  await prisma.amenity.create({
    data: {
      name: "Children's Play Zone",
      type: 'GARDEN',
      description: 'Safe outdoor play area with swings, slides, sandpit for kids aged 2-12.',
      capacity: 20,
      pricePerHour: 0,
      maxBookingsPerUser: 5,
      isActive: true,
      societyId: society.id,
    },
  });

  const sportsCourt = await prisma.amenity.create({
    data: {
      name: 'Multi-Sport Court',
      type: 'SPORTS_COURT',
      description: 'Badminton, basketball, and tennis court with flood lights.',
      capacity: 10,
      pricePerHour: 200,
      maxBookingsPerUser: 3,
      isActive: true,
      societyId: society.id,
    },
  });

  await prisma.amenity.create({
    data: {
      name: 'Rooftop Party Lounge',
      type: 'PARTY_HALL',
      description: 'Rooftop lounge with BBQ area, city views, and DJ console. Adults only.',
      capacity: 60,
      pricePerHour: 2000,
      maxBookingsPerUser: 1,
      isActive: true,
      societyId: society.id,
    },
  });
  console.log('✅ 6 amenities\n');

  // ============================================
  // AMENITY BOOKINGS
  // ============================================
  console.log('📅 Creating bookings...');
  await prisma.amenityBooking.create({
    data: {
      amenityId: clubhouse.id,
      userId: res1.id,
      flatId: flat('A101').id,
      societyId: society.id,
      bookingDate: daysFromNow(5),
      startTime: '18:00',
      endTime: '23:00',
      status: 'CONFIRMED',
      purpose: "Son's 8th birthday party — expecting 40 guests",
    },
  });
  await prisma.amenityBooking.create({
    data: {
      amenityId: pool.id,
      userId: res2.id,
      flatId: flat('A301').id,
      societyId: society.id,
      bookingDate: daysFromNow(3),
      startTime: '16:00',
      endTime: '18:00',
      status: 'PENDING',
      purpose: 'Kids swimming practice session',
    },
  });
  await prisma.amenityBooking.create({
    data: {
      amenityId: gym.id,
      userId: res3.id,
      flatId: flat('B102').id,
      societyId: society.id,
      bookingDate: daysFromNow(1),
      startTime: '06:00',
      endTime: '07:30',
      status: 'CONFIRMED',
      purpose: 'Morning workout',
    },
  });
  await prisma.amenityBooking.create({
    data: {
      amenityId: sportsCourt.id,
      userId: res5.id,
      flatId: flat('C201').id,
      societyId: society.id,
      bookingDate: daysFromNow(2),
      startTime: '18:00',
      endTime: '19:30',
      status: 'CONFIRMED',
      purpose: 'Badminton with friends',
    },
  });
  await prisma.amenityBooking.create({
    data: {
      amenityId: clubhouse.id,
      userId: res4.id,
      flatId: flat('B401').id,
      societyId: society.id,
      bookingDate: daysAgo(10),
      startTime: '10:00',
      endTime: '14:00',
      status: 'COMPLETED',
      purpose: 'Silver jubilee anniversary celebration',
    },
  });
  await prisma.amenityBooking.create({
    data: {
      amenityId: pool.id,
      userId: res6.id,
      flatId: flat('C401').id,
      societyId: society.id,
      bookingDate: daysFromNow(4),
      startTime: '17:00',
      endTime: '19:00',
      status: 'CANCELLED',
      purpose: 'Pool party — cancelled due to rain forecast',
    },
  });
  console.log('✅ 6 bookings\n');

  // ============================================
  // DOMESTIC STAFF
  // ============================================
  console.log('👨‍🔧 Creating domestic staff...');
  const maid1 = await prisma.domesticStaff.create({
    data: {
      name: 'Lakshmi Devi',
      phone: '9820000001',
      staffType: 'MAID',
      qrToken: 'STAFF_MAID_001',
      isVerified: true,
      verifiedAt: daysAgo(180),
      verifiedBy: admin.id,
      isActive: true,
      rating: 4.7,
      totalReviews: 18,
      societyId: society.id,
      addedById: admin.id,
    },
  });

  const cook1 = await prisma.domesticStaff.create({
    data: {
      name: 'Ramesh Yadav',
      phone: '9820000002',
      staffType: 'COOK',
      qrToken: 'STAFF_COOK_001',
      isVerified: true,
      verifiedAt: daysAgo(365),
      verifiedBy: admin.id,
      isActive: true,
      rating: 4.9,
      totalReviews: 14,
      societyId: society.id,
      addedById: admin.id,
    },
  });

  const driver1 = await prisma.domesticStaff.create({
    data: {
      name: 'Shankar Patil',
      phone: '9820000003',
      staffType: 'DRIVER',
      qrToken: 'STAFF_DRIVER_001',
      isVerified: true,
      verifiedAt: daysAgo(90),
      verifiedBy: admin.id,
      isActive: true,
      rating: 4.5,
      totalReviews: 7,
      societyId: society.id,
      addedById: admin.id,
    },
  });

  const gardener1 = await prisma.domesticStaff.create({
    data: {
      name: 'Gopal Reddy',
      phone: '9820000004',
      staffType: 'GARDENER',
      qrToken: 'STAFF_GARDENER_001',
      isVerified: true,
      verifiedAt: daysAgo(250),
      verifiedBy: admin.id,
      isActive: true,
      rating: 4.6,
      totalReviews: 10,
      societyId: society.id,
      addedById: admin.id,
    },
  });

  const nanny1 = await prisma.domesticStaff.create({
    data: {
      name: 'Savita Patil',
      phone: '9820000005',
      staffType: 'NANNY',
      qrToken: 'STAFF_NANNY_001',
      isVerified: true,
      verifiedAt: daysAgo(120),
      verifiedBy: admin.id,
      isActive: true,
      rating: 4.8,
      totalReviews: 11,
      societyId: society.id,
      addedById: admin.id,
    },
  });
  console.log('✅ 5 domestic staff\n');

  // ============================================
  // STAFF FLAT ASSIGNMENTS
  // ============================================
  console.log('🔗 Creating staff assignments...');
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flat('A101').id,
      isActive: true,
      workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY', 'SATURDAY'],
      workStartTime: '08:00',
      workEndTime: '10:00',
      agreedRate: 3500,
      rateType: 'monthly',
    },
  });
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flat('A301').id,
      isActive: true,
      workingDays: ['TUESDAY', 'THURSDAY', 'SUNDAY'],
      workStartTime: '10:30',
      workEndTime: '12:30',
      agreedRate: 3000,
      rateType: 'monthly',
    },
  });
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: cook1.id,
      flatId: flat('B102').id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      workStartTime: '17:00',
      workEndTime: '20:30',
      agreedRate: 12000,
      rateType: 'monthly',
    },
  });
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: driver1.id,
      flatId: flat('B102').id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      workStartTime: '08:00',
      workEndTime: '20:00',
      agreedRate: 18000,
      rateType: 'monthly',
    },
  });
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: gardener1.id,
      flatId: flat('B401').id,
      isActive: true,
      workingDays: ['TUESDAY', 'THURSDAY'],
      workStartTime: '07:00',
      workEndTime: '09:00',
      agreedRate: 2500,
      rateType: 'monthly',
    },
  });
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: nanny1.id,
      flatId: flat('A301').id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      workStartTime: '09:00',
      workEndTime: '17:00',
      agreedRate: 15000,
      rateType: 'monthly',
    },
  });
  console.log('✅ 6 staff assignments\n');

  // ============================================
  // STAFF ATTENDANCE
  // ============================================
  console.log('📋 Creating attendance...');
  await prisma.staffAttendance.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flat('A101').id,
      societyId: society.id,
      checkInTime: hoursAgo(4),
      checkOutTime: hoursAgo(2),
    },
  });
  await prisma.staffAttendance.create({
    data: {
      domesticStaffId: cook1.id,
      flatId: flat('B102').id,
      societyId: society.id,
      checkInTime: hoursAgo(3),
      checkOutTime: hoursAgo(1),
    },
  });
  await prisma.staffAttendance.create({
    data: {
      domesticStaffId: nanny1.id,
      flatId: flat('A301').id,
      societyId: society.id,
      checkInTime: hoursAgo(6),
    },
  });
  console.log('✅ 3 attendance records\n');

  // ============================================
  // STAFF REVIEWS
  // ============================================
  console.log('⭐ Creating reviews...');
  await prisma.staffReview.create({
    data: {
      domesticStaffId: maid1.id,
      reviewerId: res1.id,
      flatId: flat('A101').id,
      rating: 5,
      review: 'Lakshmi is extremely punctual and thorough. Our home has never been cleaner. Highly recommended!',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });
  await prisma.staffReview.create({
    data: {
      domesticStaffId: maid1.id,
      reviewerId: res2.id,
      flatId: flat('A301').id,
      rating: 4,
      review: 'Good worker. Sometimes 10-15 mins late but cleans very well.',
      workQuality: 5,
      punctuality: 3,
      behavior: 5,
    },
  });
  await prisma.staffReview.create({
    data: {
      domesticStaffId: cook1.id,
      reviewerId: res3.id,
      flatId: flat('B102').id,
      rating: 5,
      review: 'Ramesh is an exceptional cook. Authentic North Indian and South Indian dishes. Very hygienic.',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });
  await prisma.staffReview.create({
    data: {
      domesticStaffId: nanny1.id,
      reviewerId: res2.id,
      flatId: flat('A301').id,
      rating: 5,
      review: 'Savita is wonderful with kids. Ishaan loves her. Very caring and responsible.',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });
  console.log('✅ 4 reviews\n');

  // ============================================
  // STAFF BOOKINGS (on-demand)
  // ============================================
  console.log('📅 Creating staff bookings...');
  await prisma.staffBooking.create({
    data: {
      domesticStaffId: maid1.id,
      bookedById: res5.id,
      flatId: flat('C201').id,
      societyId: society.id,
      bookingDate: daysFromNow(2),
      startTime: '10:00',
      endTime: '13:00',
      durationHours: 3,
      workType: 'Deep Cleaning',
      requirements: 'Full house deep clean including kitchen and bathrooms',
      estimatedCost: 800,
      status: 'CONFIRMED',
      acceptedAt: daysAgo(1),
    },
  });
  await prisma.staffBooking.create({
    data: {
      domesticStaffId: cook1.id,
      bookedById: res4.id,
      flatId: flat('B401').id,
      societyId: society.id,
      bookingDate: daysFromNow(5),
      startTime: '11:00',
      endTime: '15:00',
      durationHours: 4,
      workType: 'Party Cooking',
      requirements: 'Cook for 20 people — anniversary dinner. Veg only.',
      estimatedCost: 3000,
      status: 'PENDING',
    },
  });
  console.log('✅ 2 staff bookings\n');

  // ============================================
  // PRE-APPROVALS
  // ============================================
  console.log('✅ Creating pre-approvals...');
  await prisma.preApproval.create({
    data: {
      visitorName: 'Rohit Patil',
      visitorPhone: '9830000001',
      visitorType: 'FRIEND',
      purpose: 'Weekend visits — college friend',
      qrToken: 'PRE_GF_001',
      validFrom: daysAgo(3),
      validUntil: daysFromNow(25),
      maxUses: 10,
      usedCount: 3,
      status: 'ACTIVE',
      flatId: flat('A101').id,
      societyId: society.id,
      createdById: res1.id,
    },
  });
  await prisma.preApproval.create({
    data: {
      visitorName: 'Dr. Anjali Menon',
      visitorPhone: '9830000002',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Physiotherapy sessions 3x/week for Mr. Joshi',
      qrToken: 'PRE_GF_002',
      validFrom: new Date(),
      validUntil: daysFromNow(30),
      maxUses: 15,
      usedCount: 0,
      status: 'ACTIVE',
      flatId: flat('B401').id,
      societyId: society.id,
      createdById: res4.id,
    },
  });
  await prisma.preApproval.create({
    data: {
      visitorName: 'Meena Kulkarni',
      visitorPhone: '9830000003',
      visitorType: 'FAMILY_MEMBER',
      purpose: 'Mother visiting from Nagpur — staying 2 weeks',
      qrToken: 'PRE_GF_003',
      validFrom: daysFromNow(2),
      validUntil: daysFromNow(16),
      maxUses: 20,
      usedCount: 0,
      status: 'ACTIVE',
      flatId: flat('A301').id,
      societyId: society.id,
      createdById: res2.id,
    },
  });
  await prisma.preApproval.create({
    data: {
      visitorName: 'Mohan Electrician',
      visitorPhone: '9830000004',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Electrical work — completed',
      qrToken: 'PRE_GF_004',
      validFrom: daysAgo(15),
      validUntil: daysAgo(2),
      maxUses: 5,
      usedCount: 4,
      status: 'EXPIRED',
      flatId: flat('B102').id,
      societyId: society.id,
      createdById: res3.id,
    },
  });
  console.log('✅ 4 pre-approvals\n');

  // ============================================
  // GATE PASSES
  // ============================================
  console.log('🎫 Creating gate passes...');
  await prisma.gatePass.create({
    data: {
      type: 'MATERIAL',
      title: 'Furniture Delivery',
      description: 'New sofa set from Pepperfry',
      vehicleNumber: 'MH12XX9876',
      qrToken: 'GP_GF_001',
      validFrom: new Date(),
      validUntil: daysFromNow(3),
      status: 'APPROVED',
      isUsed: false,
      flatId: flat('A101').id,
      societyId: society.id,
      requestedById: res1.id,
      approvedById: admin.id,
      approvedAt: new Date(),
    },
  });
  await prisma.gatePass.create({
    data: {
      type: 'MOVE_IN',
      title: 'New Tenant Moving In',
      description: 'Packers and movers — 1 truck + 1 tempo',
      vehicleNumber: 'MH14ZZ5432',
      qrToken: 'GP_GF_002',
      validFrom: daysFromNow(5),
      validUntil: daysFromNow(6),
      status: 'PENDING',
      isUsed: false,
      flatId: flat('A501').id,
      societyId: society.id,
      requestedById: res1.id,
    },
  });
  console.log('✅ 2 gate passes\n');

  // ============================================
  // DELIVERY AUTO-APPROVE RULES
  // ============================================
  console.log('📦 Creating auto-approve rules...');
  await prisma.deliveryAutoApproveRule.create({
    data: {
      flatId: flat('A101').id,
      societyId: society.id,
      isActive: true,
      timeFrom: '08:00',
      timeUntil: '23:00',
      createdById: res1.id,
    },
  });
  await prisma.deliveryAutoApproveRule.create({
    data: {
      flatId: flat('C201').id,
      societyId: society.id,
      isActive: true,
      createdById: res5.id,
    },
  });
  console.log('✅ 2 auto-approve rules\n');

  // ============================================
  // EXPECTED DELIVERIES
  // ============================================
  console.log('📦 Creating expected deliveries...');
  await prisma.expectedDelivery.create({
    data: {
      flatId: flat('A101').id,
      societyId: society.id,
      companyName: 'Amazon',
      itemName: 'Laptop stand and webcam',
      expectedDate: daysFromNow(1),
      expiresAt: daysFromNow(2),
      autoApprove: true,
      isUsed: false,
      createdById: res1.id,
    },
  });
  await prisma.expectedDelivery.create({
    data: {
      flatId: flat('B102').id,
      societyId: society.id,
      companyName: 'Flipkart',
      itemName: 'Air purifier',
      expectedDate: daysFromNow(2),
      expiresAt: daysFromNow(3),
      autoApprove: true,
      isUsed: false,
      createdById: res3.id,
    },
  });
  console.log('✅ 2 expected deliveries\n');

  // ============================================
  // ENTRIES (gate log)
  // ============================================
  console.log('🚪 Creating entries...');
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Deepak Joshi',
      visitorPhone: '9840000001',
      visitorType: 'FRIEND',
      purpose: 'Weekend visit — college reunion dinner',
      checkInTime: daysAgo(2),
      checkOutTime: hoursAgo(46),
      flatId: flat('A101').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard1.id,
      wasAutoApproved: false,
      approvedById: res1.id,
      approvedAt: daysAgo(2),
    },
  });
  await prisma.entry.create({
    data: {
      type: 'DELIVERY',
      status: 'CHECKED_OUT',
      visitorName: 'Swiggy - Rahul',
      visitorPhone: '9840000002',
      purpose: 'Food delivery — Biryani Blues order',
      companyName: 'Swiggy',
      checkInTime: hoursAgo(3),
      checkOutTime: hoursAgo(2.9),
      flatId: flat('A101').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Auto-approved by delivery rule (8 AM - 11 PM)',
    },
  });
  await prisma.entry.create({
    data: {
      type: 'DOMESTIC_STAFF',
      status: 'CHECKED_OUT',
      visitorName: 'Lakshmi Devi',
      visitorPhone: '9820000001',
      purpose: 'Regular cleaning work',
      checkInTime: hoursAgo(4),
      checkOutTime: hoursAgo(2),
      flatId: flat('A101').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Verified domestic staff — QR scanned',
      domesticStaffId: maid1.id,
    },
  });
  await prisma.entry.create({
    data: {
      type: 'DOMESTIC_STAFF',
      status: 'CHECKED_IN',
      visitorName: 'Ramesh Yadav',
      visitorPhone: '9820000002',
      purpose: 'Evening cooking',
      checkInTime: hoursAgo(1.5),
      flatId: flat('B102').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard2.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Verified domestic staff — QR scanned',
      domesticStaffId: cook1.id,
    },
  });
  await prisma.entry.create({
    data: {
      type: 'DELIVERY',
      status: 'CHECKED_OUT',
      visitorName: 'Amazon - Suresh',
      visitorPhone: '9840000003',
      purpose: 'Package delivery — AWB 1234567890',
      companyName: 'Amazon',
      checkInTime: hoursAgo(26),
      checkOutTime: hoursAgo(25.9),
      flatId: flat('A301').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard3.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Expected delivery — auto-approved',
    },
  });
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Kumar Plumbing',
      visitorPhone: '9840000004',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Bathroom tap repair',
      checkInTime: hoursAgo(28),
      checkOutTime: hoursAgo(26.5),
      flatId: flat('B401').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard1.id,
      wasAutoApproved: false,
      approvedById: res4.id,
      approvedAt: hoursAgo(28),
    },
  });
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_IN',
      visitorName: 'Rohit Patil',
      visitorPhone: '9830000001',
      visitorType: 'FRIEND',
      purpose: 'Weekend visit',
      checkInTime: hoursAgo(2),
      flatId: flat('A101').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Pre-approved visitor — valid QR code',
    },
  });
  await prisma.entry.create({
    data: {
      type: 'DELIVERY',
      status: 'CHECKED_OUT',
      visitorName: 'Zomato - Vijay',
      visitorPhone: '9840000005',
      purpose: 'Food delivery — Order #789456',
      companyName: 'Zomato',
      checkInTime: daysAgo(1),
      checkOutTime: hoursAgo(23.9),
      flatId: flat('B102').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard2.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Auto-approved by delivery rule',
    },
  });
  await prisma.entry.create({
    data: {
      type: 'CAB',
      status: 'CHECKED_OUT',
      visitorName: 'Uber Driver - Ravi',
      visitorPhone: '9840000006',
      vehicleNumber: 'MH12XY9999',
      purpose: 'Uber pickup — Priya Desai',
      checkInTime: hoursAgo(25),
      checkOutTime: hoursAgo(24.9),
      flatId: flat('C201').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Cab service — auto-approved',
    },
  });
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Blinkit - Delivery',
      visitorPhone: '9840000007',
      purpose: 'Grocery delivery',
      companyName: 'Blinkit',
      checkInTime: hoursAgo(5),
      checkOutTime: hoursAgo(4.9),
      flatId: flat('C401').id,
      societyId: society.id,
      gatePointId: mainGate.id,
      createdById: guard3.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Auto-approved by delivery rule',
    },
  });
  console.log('✅ 10 entries\n');

  // ============================================
  // ENTRY REQUESTS (pending at gate)
  // ============================================
  console.log('📸 Creating entry requests...');
  await prisma.entryRequest.create({
    data: {
      type: 'DELIVERY',
      status: 'PENDING',
      visitorName: 'Zomato Delivery',
      visitorPhone: '9850000001',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      flatId: flat('A301').id,
      societyId: society.id,
      guardId: guard1.id,
    },
  });
  await prisma.entryRequest.create({
    data: {
      type: 'VISITOR',
      status: 'PENDING',
      visitorName: 'Amit Kumar',
      visitorPhone: '9850000002',
      expiresAt: new Date(Date.now() + 12 * 60 * 1000),
      flatId: flat('B102').id,
      societyId: society.id,
      guardId: guard2.id,
    },
  });
  console.log('✅ 2 entry requests\n');

  // ============================================
  // NOTICES
  // ============================================
  console.log('📢 Creating notices...');
  await prisma.notice.create({
    data: {
      title: 'Monthly Maintenance Due — March 2026',
      description: `Dear Residents,

Monthly maintenance of ₹4,500 for March 2026 is due by 5th March.

Payment Options:
- UPI: greenfieldheights@sbi
- Bank Transfer: A/C 9876543210, IFSC: SBIN0012345
- Cheque: Payable to "Greenfield Heights CHS"

Late fee of ₹200 after 10th March.

— Management Committee`,
      type: 'GENERAL',
      priority: 'HIGH',
      isActive: true,
      isPinned: true,
      isUrgent: true,
      publishAt: daysAgo(2),
      expiresAt: daysFromNow(12),
      societyId: society.id,
      createdById: admin.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Water Supply Disruption — 20th March',
      description: `Due to PMC pipeline maintenance:

Date: 20th March 2026 (Friday)
Time: 10:00 AM to 3:00 PM
Affected: All towers

Please store water. Tanker available on call: 9820001111.

— Maintenance Team`,
      type: 'MAINTENANCE',
      priority: 'HIGH',
      isActive: true,
      isPinned: true,
      isUrgent: true,
      publishAt: daysAgo(1),
      expiresAt: daysFromNow(5),
      societyId: society.id,
      createdById: admin.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Holi Celebration — 14th March 2026',
      description: `Dear Residents,

Join us for Holi celebrations!

Schedule:
🎨 10:00 AM — Gulal play at Central Lawn
🎶 11:00 AM — DJ Music
🍔 12:00 PM — Lunch & Thandai
🚿 2:00 PM — Pool access for all

All residents and families welcome!

— Cultural Committee`,
      type: 'EVENT',
      priority: 'MEDIUM',
      isActive: true,
      isPinned: true,
      publishAt: daysAgo(5),
      expiresAt: daysFromNow(1),
      societyId: society.id,
      createdById: admin.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'New Parking Rules — Effective 1st April',
      description: `New parking regulations:

1. All vehicles MUST display society stickers
2. Visitor parking limited to 3 hours
3. No parking in fire lane — towing enforced
4. Two-wheelers only in designated zones
5. Guest vehicles register at gate

Stickers: ₹200/vehicle at admin office.

— Security Committee`,
      type: 'GENERAL',
      priority: 'MEDIUM',
      isActive: true,
      publishAt: daysAgo(7),
      expiresAt: daysFromNow(30),
      societyId: society.id,
      createdById: admin.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Pest Control — 22nd March',
      description: `Quarterly pest control:

Tower A: 22nd March, 9 AM - 12 PM
Tower B: 22nd March, 2 PM - 5 PM
Tower C: 23rd March, 9 AM - 12 PM

Keep windows open, cover food, remove pets for 2 hours.

Contact: 9820001234 to reschedule.`,
      type: 'MAINTENANCE',
      priority: 'MEDIUM',
      isActive: true,
      publishAt: daysAgo(3),
      expiresAt: daysFromNow(8),
      societyId: society.id,
      createdById: admin.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Gym Upgrade Complete!',
      description: `New equipment added:
✓ 2 Commercial Treadmills
✓ Rowing Machine
✓ Additional Free Weights
✓ New Yoga Mats

Hours: 5:30 AM - 10:00 PM daily.
Trainer available Mon-Sat, 6-8 AM and 6-8 PM.

— Amenities Committee`,
      type: 'GENERAL',
      priority: 'LOW',
      isActive: true,
      publishAt: daysAgo(4),
      societyId: society.id,
      createdById: admin.id,
      images: [],
      documents: [],
    },
  });
  console.log('✅ 6 notices\n');

  // ============================================
  // COMPLAINTS
  // ============================================
  console.log('📝 Creating complaints...');
  await prisma.complaint.create({
    data: {
      title: 'Elevator #2 in Tower A Stuck',
      description: `Elevator #2 has been malfunctioning for 3 days. Gets stuck between floors 5 and 6 with strange grinding noise. Major inconvenience for elderly residents. Please arrange immediate repair — safety hazard.`,
      category: 'MAINTENANCE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      flatId: flat('A101').id,
      societyId: society.id,
      reportedById: res1.id,
      isAnonymous: false,
    },
  });
  await prisma.complaint.create({
    data: {
      title: 'Water Leakage from Overhead Tank',
      description: `Continuous dripping from overhead tank near main gate. Pavement slippery and dangerous. Ongoing for a week. Also causing water wastage.`,
      category: 'WATER',
      priority: 'HIGH',
      status: 'RESOLVED',
      flatId: flat('A301').id,
      societyId: society.id,
      reportedById: res2.id,
      isAnonymous: false,
      resolvedAt: daysAgo(2),
    },
  });
  await prisma.complaint.create({
    data: {
      title: 'Loud Music After 11 PM',
      description: `Neighbor in B103 plays loud music every weekend till 1-2 AM. Disturbing sleep and affecting child's studies. Requested them to reduce volume but no cooperation. Please enforce noise rules.`,
      category: 'NOISE',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flat('B102').id,
      societyId: society.id,
      reportedById: res3.id,
      isAnonymous: false,
    },
  });
  await prisma.complaint.create({
    data: {
      title: 'Unauthorized Parking in My Slot',
      description: `A white car (MH12XX1234) regularly parks in my designated spot Tower A, Slot #A-101. Yesterday had to park on the street. Please take action.`,
      category: 'PARKING',
      priority: 'HIGH',
      status: 'OPEN',
      flatId: flat('A101').id,
      societyId: society.id,
      reportedById: res1.id,
      isAnonymous: false,
    },
  });
  await prisma.complaint.create({
    data: {
      title: 'Street Lights Not Working — Tower C',
      description: `4 street lights near Tower C parking area out for 2+ weeks. Very dark after sunset. Security concern especially for women.`,
      category: 'ELECTRICITY',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      flatId: flat('C201').id,
      societyId: society.id,
      reportedById: res5.id,
      isAnonymous: false,
    },
  });
  await prisma.complaint.create({
    data: {
      title: 'Construction Debris Dumped Near Tower B',
      description: `Someone dumping construction debris behind Tower B garbage area for 4-5 days. Bad smell and blocking path. Please identify culprit and remove waste.`,
      category: 'CLEANLINESS',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flat('C401').id,
      societyId: society.id,
      reportedById: res6.id,
      isAnonymous: false,
    },
  });
  await prisma.complaint.create({
    data: {
      title: 'Pool Water Quality Issue',
      description: `Pool water murky with strange smell. Kids complained of skin irritation after swimming yesterday. Chlorine levels seem off. Request water testing.`,
      category: 'OTHER',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      flatId: flat('B102').id,
      societyId: society.id,
      reportedById: res3Spouse.id,
      isAnonymous: false,
    },
  });
  await prisma.complaint.create({
    data: {
      title: 'Security Guard Misbehavior',
      description: `One guard at main gate has been rude and delays entry approvals. Disrespectful tone with residents on multiple occasions. Keeping anonymous to avoid confrontation.`,
      category: 'SECURITY',
      priority: 'HIGH',
      status: 'OPEN',
      flatId: flat('A301').id,
      societyId: society.id,
      reportedById: res2.id,
      isAnonymous: true,
    },
  });
  console.log('✅ 8 complaints\n');

  // ============================================
  // EMERGENCIES
  // ============================================
  console.log('🚨 Creating emergencies...');
  await prisma.emergency.create({
    data: {
      type: 'FIRE',
      description: `Kitchen fire in A101. Oil overheated while cooking. Small fire controlled with extinguisher. Fire brigade called as precaution. No injuries. Minor cabinet damage.

Action: Fire extinguisher replaced, safety training scheduled.`,
      status: 'RESOLVED',
      resolvedAt: daysAgo(15),
      flatId: flat('A101').id,
      societyId: society.id,
      reportedById: res1.id,
    },
  });
  await prisma.emergency.create({
    data: {
      type: 'MEDICAL',
      description: `Mr. Mohan Joshi (B401) slipped in bathroom. Suspected hip injury. Ambulance arrived in 12 mins. Transported to Ruby Hall Clinic. Surgery done, recovering well.

Follow-up: Grab bars installation requested.`,
      status: 'RESOLVED',
      resolvedAt: daysAgo(8),
      flatId: flat('B401').id,
      societyId: society.id,
      reportedById: res4Spouse.id,
    },
  });
  await prisma.emergency.create({
    data: {
      type: 'OTHER',
      description: `Water pipe burst on floor 3, Tower C. Flooding into C301, C302. Main supply shut off. Cleanup completed in 3 hours. Electrical supply temporarily disconnected.

Insurance claim filed.`,
      status: 'RESOLVED',
      resolvedAt: daysAgo(20),
      flatId: flat('C301').id,
      societyId: society.id,
      reportedById: admin.id,
    },
  });
  console.log('✅ 3 emergencies\n');

  // ============================================
  // VENDORS
  // ============================================
  console.log('🏪 Creating vendors...');
  const vendorData = [
    { name: 'Kumar Plumbing Services', category: 'PLUMBER' as const, phone: '9860000001', email: 'info@kumarplumbing.com', description: 'Professional plumbing — pipe repairs, tap installation, drainage cleaning. Available 24/7. 15+ years experience.' },
    { name: 'Bright Spark Electricians', category: 'ELECTRICIAN' as const, phone: '9860000002', email: 'contact@brightspark.in', description: 'Certified electricians — wiring, MCB, geyser/AC repairs, smart home setup. Emergency service available.' },
    { name: 'AC Care Technicians', category: 'APPLIANCE_REPAIR' as const, phone: '9860000003', email: 'service@accare.com', description: 'AC installation, repair, gas refilling, AMC. All brands. Same-day service. Warranty on repairs.' },
    { name: 'QuickFix Carpenters', category: 'CARPENTER' as const, phone: '9860000004', email: 'work@quickfix.com', description: 'Custom furniture, door/window repairs, modular kitchen, wardrobe work. Free estimates.' },
    { name: 'HomePaint Solutions', category: 'PAINTER' as const, phone: '9860000005', email: 'paint@homepaint.in', description: 'Interior/exterior painting, texture work, waterproofing. Asian Paints authorized applicators.' },
    { name: 'PestGuard Services', category: 'PEST_CONTROL' as const, phone: '9860000006', email: 'info@pestguard.in', description: 'Eco-friendly pest control — cockroaches, termites, bedbugs, rodents. Safe for kids & pets. AMC available.' },
    { name: 'CleanHome Pro', category: 'CLEANER' as const, phone: '9860000007', email: 'book@cleanhome.in', description: 'Deep cleaning, sofa cleaning, bathroom sanitization, move-in/out cleaning. Trained staff.' },
    { name: 'GreenThumb Landscaping', category: 'GARDENER' as const, phone: '9860000008', email: 'hello@greenthumb.in', description: 'Garden maintenance, plant care, landscape design, terrace garden setup. Monthly plans available.' },
  ];

  for (const v of vendorData) {
    await prisma.vendor.create({
      data: {
        ...v,
        isVerified: true,
        isActive: true,
        societyId: society.id,
        addedById: admin.id,
      },
    });
  }
  console.log('✅ 8 vendors\n');

  // ============================================
  // VISITOR FREQUENCY
  // ============================================
  console.log('👥 Creating visitor frequency...');
  await prisma.visitorFrequency.create({
    data: {
      visitorName: 'Rohit Patil',
      visitorPhone: '9830000001',
      flatId: flat('A101').id,
      societyId: society.id,
      visitCount: 8,
      lastVisit: daysAgo(2),
    },
  });
  await prisma.visitorFrequency.create({
    data: {
      visitorName: 'Lakshmi Devi',
      visitorPhone: '9820000001',
      flatId: flat('A101').id,
      societyId: society.id,
      visitCount: 45,
      lastVisit: hoursAgo(2),
    },
  });
  await prisma.visitorFrequency.create({
    data: {
      visitorName: 'Ramesh Yadav',
      visitorPhone: '9820000002',
      flatId: flat('B102').id,
      societyId: society.id,
      visitCount: 38,
      lastVisit: hoursAgo(1.5),
    },
  });
  console.log('✅ 3 frequency records\n');

  // ============================================
  // NOTIFICATIONS
  // ============================================
  console.log('🔔 Creating notifications...');
  await prisma.notification.create({
    data: {
      type: 'SYSTEM',
      title: 'Welcome to Greenfield Heights',
      message: 'Your account has been activated.',
      userId: res1.id,
      societyId: society.id,
      isRead: true,
      readAt: daysAgo(60),
    },
  });
  await prisma.notification.create({
    data: {
      type: 'ENTRY_REQUEST',
      title: 'Delivery at Gate',
      message: 'Zomato delivery waiting for approval at main gate.',
      userId: res2.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'EntryRequest',
    },
  });
  await prisma.notification.create({
    data: {
      type: 'ONBOARDING_STATUS',
      title: 'Booking Confirmed',
      message: 'Your banquet hall booking has been confirmed for March 21.',
      userId: res1.id,
      societyId: society.id,
      isRead: true,
      readAt: daysAgo(1),
      referenceType: 'AmenityBooking',
    },
  });
  await prisma.notification.create({
    data: {
      type: 'DELIVERY_REQUEST',
      title: 'Amazon Package',
      message: 'Your Amazon delivery is expected today.',
      userId: res1.id,
      societyId: society.id,
      isRead: false,
    },
  });
  await prisma.notification.create({
    data: {
      type: 'EMERGENCY_ALERT',
      title: 'Fire Incident Resolved',
      message: 'Kitchen fire in A-101 has been controlled. No injuries.',
      userId: admin.id,
      societyId: society.id,
      isRead: true,
      readAt: daysAgo(15),
    },
  });
  await prisma.notification.create({
    data: {
      type: 'STAFF_CHECKIN',
      title: 'Staff Arrived',
      message: 'Lakshmi Devi (Maid) checked in at 8:05 AM.',
      userId: res1.id,
      societyId: society.id,
      isRead: true,
      readAt: hoursAgo(4),
    },
  });
  console.log('✅ 6 notifications\n');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Seed completed!\n');
  console.log('=====================================');
  console.log('  GREENFIELD HEIGHTS — Pune');
  console.log('=====================================');
  console.log(`  Society:        1`);
  console.log(`  Gate Points:    2`);
  console.log(`  Blocks:         3 towers (A, B, C)`);
  console.log(`  Flats:          ${flats.length}`);
  console.log(`  Users:          18 (1 super admin, 1 admin, 3 guards, 13 residents)`);
  console.log(`  Onboarding:     6 approved requests`);
  console.log(`  Vehicles:       7`);
  console.log(`  Amenities:      6`);
  console.log(`  Bookings:       6 (confirmed, pending, completed, cancelled)`);
  console.log(`  Staff:          5 (maid, cook, driver, gardener, nanny)`);
  console.log(`  Assignments:    6`);
  console.log(`  Attendance:     3`);
  console.log(`  Reviews:        4`);
  console.log(`  Staff Bookings: 2 (confirmed, pending)`);
  console.log(`  Pre-approvals:  4 (active, expired)`);
  console.log(`  Gate Passes:    2 (approved, pending)`);
  console.log(`  Auto-approve:   2 rules`);
  console.log(`  Deliveries:     2 expected`);
  console.log(`  Entries:        10 (visitors, staff, deliveries, cab)`);
  console.log(`  Entry Requests: 2 (pending at gate)`);
  console.log(`  Notices:        6`);
  console.log(`  Complaints:     8`);
  console.log(`  Emergencies:    3`);
  console.log(`  Vendors:        8`);
  console.log(`  Visitor Freq:   3`);
  console.log(`  Notifications:  6`);
  console.log('=====================================\n');
  console.log('🔑 KEY ACCOUNTS:');
  console.log('-------------------------------------');
  console.log('SUPER ADMIN (Platform):');
  console.log('  Phone: 9999900000');
  console.log('\nSOCIETY ADMIN (Your account):');
  console.log('  Phone: 7484827530');
  console.log('  Name:  Agastya');
  console.log('  Role:  ADMIN of Greenfield Heights');
  console.log('\nGUARD:');
  console.log('  Phone: 9800000001 (Rajendra Singh)');
  console.log('\nRESIDENTS:');
  console.log('  Phone: 9811000001 (Amit Sharma — A101)');
  console.log('  Phone: 9811000004 (Dr. Sneha Kulkarni — A301)');
  console.log('  Phone: 9811000006 (Vikram Chauhan — B102)');
  console.log('  Phone: 9811000008 (Mohan Joshi — B401)');
  console.log('  Phone: 9811000010 (Priya Desai — C201)');
  console.log('  Phone: 9811000011 (Karthik Nair — C401)');
  console.log('=====================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
