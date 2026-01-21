import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clean existing data (in reverse order of dependencies)
  console.log('🧹 Cleaning existing data...');
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
  await prisma.vehicle.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.preApproval.deleteMany();
  await prisma.gatePass.deleteMany();
  await prisma.expectedDelivery.deleteMany();
  await prisma.deliveryAutoApproveRule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.block.deleteMany();
  await prisma.society.deleteMany();

  console.log('✅ Database cleaned\n');

  // ============================================
  // 1. CREATE SOCIETIES
  // ============================================
  console.log('🏢 Creating societies...');

  const society1 = await prisma.society.create({
    data: {
      name: 'Skyline Residency',
      address: '123 MG Road, Bangalore, Karnataka 560001',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      contactName: 'Society Admin',
      contactPhone: '+919876543210',
      contactEmail: 'admin@skyline.com',
      totalFlats: 100,
      monthlyFee: 1500,
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentStatus: 'PAID',
    },
  });

  // Second society for multi-tenancy testing
  const society2 = await prisma.society.create({
    data: {
      name: 'Green Valley Apartments',
      address: '456 Park Avenue, Mumbai, Maharashtra 400001',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      contactName: 'Green Valley Admin',
      contactPhone: '+919876543299',
      contactEmail: 'admin@greenvalley.com',
      totalFlats: 50,
      monthlyFee: 2000,
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentStatus: 'PAID',
    },
  });

  console.log(`✅ Created 2 societies\n`);

  // ============================================
  // 2. CREATE BLOCKS - SOCIETY 1
  // ============================================
  console.log('🏗️ Creating blocks...');

  const blockA = await prisma.block.create({
    data: {
      name: 'Block A',
      societyId: society1.id,
      totalFloors: 5,
      description: 'Main residential block',
    },
  });

  const blockB = await prisma.block.create({
    data: {
      name: 'Block B',
      societyId: society1.id,
      totalFloors: 5,
      description: 'Secondary residential block',
    },
  });

  // SOCIETY 2 BLOCKS
  const blockC = await prisma.block.create({
    data: {
      name: 'Tower C',
      societyId: society2.id,
      totalFloors: 10,
      description: 'High-rise tower',
    },
  });

  console.log(`✅ Created 3 blocks\n`);

  // ============================================
  // 3. CREATE FLATS
  // ============================================
  console.log('🏠 Creating flats...');

  const flats = [];

  // Create 10 flats in Block A (Society 1)
  for (let floor = 1; floor <= 5; floor++) {
    for (let flatNum = 1; flatNum <= 2; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `A${floor}0${flatNum}`,
          floor: `Floor ${floor}`,
          blockId: blockA.id,
          societyId: society1.id,
          isOccupied: flatNum === 1 ? true : false,
        },
      });
      flats.push(flat);
    }
  }

  // Create 5 flats in Block B (Society 1)
  for (let floor = 1; floor <= 2; floor++) {
    for (let flatNum = 1; flatNum <= 2; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `B${floor}0${flatNum}`,
          floor: `Floor ${floor}`,
          blockId: blockB.id,
          societyId: society1.id,
          isOccupied: false,
        },
      });
      flats.push(flat);
    }
  }

  // Create 5 flats in Tower C (Society 2)
  const flats2 = [];
  for (let floor = 1; floor <= 5; floor++) {
    const flat = await prisma.flat.create({
      data: {
        flatNumber: `C${floor}01`,
        floor: `Floor ${floor}`,
        blockId: blockC.id,
        societyId: society2.id,
        isOccupied: floor <= 2 ? true : false,
      },
    });
    flats2.push(flat);
  }

  console.log(`✅ Created ${flats.length + flats2.length} flats\n`);

  // ============================================
  // 4. CREATE USERS
  // ============================================
  console.log('👥 Creating users...');

  const hashedPassword = await bcrypt.hash('Test@1234', 10);

  // Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      phone: '+919999999999',
      email: 'superadmin@societygate.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // ============================================
  // SOCIETY 1 USERS
  // ============================================

  // Admin for Skyline Residency
  const admin1 = await prisma.user.create({
    data: {
      name: 'Rajesh Kumar',
      phone: '+919876543210',
      email: 'rajesh.admin@skyline.com',
      password: hashedPassword,
      role: 'ADMIN',
      societyId: society1.id,
      isActive: true,
    },
  });

  // Guards for Skyline Residency
  const guard1 = await prisma.user.create({
    data: {
      name: 'Ramesh Singh',
      phone: '+919123456780',
      email: 'ramesh.guard@skyline.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society1.id,
      isActive: true,
    },
  });

  const guard2 = await prisma.user.create({
    data: {
      name: 'Suresh Yadav',
      phone: '+919123456781',
      email: 'suresh.guard@skyline.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society1.id,
      isActive: true,
    },
  });

  // Residents for Skyline Residency
  const resident1 = await prisma.user.create({
    data: {
      name: 'Amit Verma',
      phone: '+919111111111',
      email: 'amit.verma@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[0].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident2 = await prisma.user.create({
    data: {
      name: 'Sneha Reddy',
      phone: '+919111111112',
      email: 'sneha.reddy@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[2].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident3 = await prisma.user.create({
    data: {
      name: 'Vikram Singh',
      phone: '+919111111113',
      email: 'vikram.singh@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[4].id,
      isOwner: false,
      isPrimaryResident: false,
      isActive: true,
    },
  });

  const resident4 = await prisma.user.create({
    data: {
      name: 'Anita Desai',
      phone: '+919111111114',
      email: 'anita.desai@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[6].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident5 = await prisma.user.create({
    data: {
      name: 'Rahul Kapoor',
      phone: '+919111111115',
      email: 'rahul.kapoor@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[8].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  // ============================================
  // SOCIETY 2 USERS
  // ============================================

  // Admin for Green Valley
  const admin2 = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      phone: '+919876543299',
      email: 'priya.admin@greenvalley.com',
      password: hashedPassword,
      role: 'ADMIN',
      societyId: society2.id,
      isActive: true,
    },
  });

  // Guard for Green Valley
  const guard3 = await prisma.user.create({
    data: {
      name: 'Mohan Das',
      phone: '+919123456790',
      email: 'mohan.guard@greenvalley.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society2.id,
      isActive: true,
    },
  });

  // Residents for Green Valley
  const resident6 = await prisma.user.create({
    data: {
      name: 'Kiran Patel',
      phone: '+919222222221',
      email: 'kiran.patel@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[0].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident7 = await prisma.user.create({
    data: {
      name: 'Maya Iyer',
      phone: '+919222222222',
      email: 'maya.iyer@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[1].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  console.log(`✅ Created 13 users (1 super admin, 2 admins, 3 guards, 7 residents)\n`);

  // ============================================
  // 5. CREATE AMENITIES
  // ============================================
  console.log('🏊 Creating amenities...');

  // Society 1 Amenities
  const gym = await prisma.amenity.create({
    data: {
      name: 'Fitness Center',
      type: 'GYM',
      description: 'Fully equipped gym with modern equipment',
      capacity: 20,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society1.id,
    },
  });

  const pool = await prisma.amenity.create({
    data: {
      name: 'Swimming Pool',
      type: 'SWIMMING_POOL',
      description: 'Olympic size swimming pool',
      capacity: 30,
      pricePerHour: 200,
      maxBookingsPerUser: 3,
      isActive: true,
      societyId: society1.id,
    },
  });

  await prisma.amenity.create({
    data: {
      name: 'Community Hall',
      type: 'CLUBHOUSE',
      description: 'Large hall for events and parties',
      capacity: 100,
      pricePerHour: 1500,
      maxBookingsPerUser: 1,
      isActive: true,
      societyId: society1.id,
    },
  });

  // Society 2 Amenity
  await prisma.amenity.create({
    data: {
      name: 'Green Valley Gym',
      type: 'GYM',
      description: 'Modern fitness center',
      capacity: 15,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society2.id,
    },
  });

  console.log(`✅ Created 4 amenities\n`);

  // ============================================
  // 6. CREATE PRE-APPROVALS
  // ============================================
  console.log('✅ Creating pre-approvals...');

  const validFrom = new Date();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);

  await prisma.preApproval.create({
    data: {
      visitorName: 'Rohit Sharma',
      visitorPhone: '+919333333331',
      visitorType: 'FRIEND',
      purpose: 'Weekend visit',
      qrToken: 'PRE_SKYLINE_001',
      validFrom: validFrom,
      validUntil: validUntil,
      maxUses: 3,
      usedCount: 0,
      status: 'ACTIVE',
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: resident1.id,
    },
  });

  // Pre-approval for testing race condition
  await prisma.preApproval.create({
    data: {
      visitorName: 'Test Visitor',
      visitorPhone: '+919333333332',
      visitorType: 'GUEST',
      purpose: 'Race condition testing',
      qrToken: 'PRE_RACE_TEST_001',
      validFrom: validFrom,
      validUntil: validUntil,
      maxUses: 3,
      usedCount: 0,
      status: 'ACTIVE',
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: resident1.id,
    },
  });

  console.log(`✅ Created 2 pre-approvals\n`);

  // ============================================
  // 7. CREATE GATE PASSES
  // ============================================
  console.log('🎫 Creating gate passes...');

  const passValidFrom = new Date();
  const passValidUntil = new Date();
  passValidUntil.setDate(passValidUntil.getDate() + 3);

  await prisma.gatePass.create({
    data: {
      type: 'MATERIAL',
      title: 'Furniture Moving',
      description: 'Moving new sofa set',
      vehicleNumber: 'KA01AB1234',
      qrToken: 'GATE_SKYLINE_001',
      validFrom: passValidFrom,
      validUntil: passValidUntil,
      status: 'APPROVED',
      isUsed: false,
      flatId: flats[0].id,
      societyId: society1.id,
      requestedById: resident1.id,
      approvedById: admin1.id,
      approvedAt: new Date(),
    },
  });

  // Gate pass for race condition testing
  await prisma.gatePass.create({
    data: {
      type: 'VEHICLE',
      title: 'Vehicle Entry',
      description: 'Race condition test gate pass',
      qrToken: 'GATE_RACE_TEST_001',
      validFrom: passValidFrom,
      validUntil: passValidUntil,
      status: 'APPROVED',
      isUsed: false,
      flatId: flats[0].id,
      societyId: society1.id,
      requestedById: resident1.id,
      approvedById: admin1.id,
      approvedAt: new Date(),
    },
  });

  console.log(`✅ Created 2 gate passes\n`);

  // ============================================
  // 8. CREATE ENTRIES
  // ============================================
  console.log('🚪 Creating entry records...');

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Society 1 entry
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Arun Kumar',
      visitorPhone: '+919444444441',
      visitorType: 'GUEST',
      purpose: 'Personal visit',
      checkInTime: yesterday,
      checkOutTime: yesterday,
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: false,
      approvedById: resident1.id,
      approvedAt: yesterday,
    },
  });

  // Society 2 entry (for multi-tenancy testing)
  await prisma.entry.create({
    data: {
      type: 'DELIVERY',
      status: 'CHECKED_IN',
      visitorName: 'Zomato Delivery',
      visitorPhone: '+919444444442',
      purpose: 'Food delivery',
      checkInTime: new Date(),
      flatId: flats2[0].id,
      societyId: society2.id,
      createdById: guard3.id,
      wasAutoApproved: true,
    },
  });

  console.log(`✅ Created 2 entry records\n`);

  // ============================================
  // 9. CREATE ENTRY REQUESTS
  // ============================================
  console.log('📸 Creating entry requests...');

  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 15);

  await prisma.entryRequest.create({
    data: {
      type: 'DELIVERY',
      status: 'PENDING',
      providerTag: 'SWIGGY',
      visitorName: 'Swiggy Delivery',
      visitorPhone: '+919555555551',
      expiresAt: expiryTime,
      flatId: flats[2].id,
      societyId: society1.id,
      guardId: guard1.id,
    },
  });

  console.log(`✅ Created 1 entry request\n`);

  // ============================================
  // 10. CREATE DOMESTIC STAFF
  // ============================================
  console.log('👨‍🔧 Creating domestic staff...');

  const maid = await prisma.domesticStaff.create({
    data: {
      name: 'Lakshmi Devi',
      phone: '+919666666661',
      staffType: 'MAID',
      qrToken: 'STAFF_SKYLINE_001',
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.5,
      totalReviews: 8,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  // Society 2 staff (for multi-tenancy testing)
  await prisma.domesticStaff.create({
    data: {
      name: 'Ramu Kumar',
      phone: '+919666666662',
      staffType: 'COOK',
      qrToken: 'STAFF_GREEN_001',
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: admin2.id,
      isActive: true,
      rating: 4.0,
      totalReviews: 5,
      societyId: society2.id,
      addedById: admin2.id,
    },
  });

  console.log(`✅ Created 2 domestic staff\n`);

  // ============================================
  // 11. CREATE STAFF ASSIGNMENTS
  // ============================================
  console.log('🔗 Creating staff assignments...');

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid.id,
      flatId: flats[0].id,
      isActive: true,
      workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      workStartTime: '08:00',
      workEndTime: '10:00',
      agreedRate: 3000,
      rateType: 'monthly',
    },
  });

  console.log(`✅ Created 1 staff assignment\n`);

  // ============================================
  // 12. CREATE NOTICES
  // ============================================
  console.log('📢 Creating notices...');

  await prisma.notice.create({
    data: {
      title: 'Society Maintenance Notice',
      description: 'Monthly maintenance fees are due by 5th of every month. Please pay on time to avoid late fees.',
      type: 'GENERAL',
      priority: 'MEDIUM',
      isActive: true,
      publishAt: new Date(),
      societyId: society1.id,
      createdById: admin1.id,
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Green Valley Swimming Pool Opening',
      description: 'Our new swimming pool will be inaugurated next week. All residents are invited.',
      type: 'EVENT',
      priority: 'LOW',
      isActive: true,
      publishAt: new Date(),
      societyId: society2.id,
      createdById: admin2.id,
    },
  });

  console.log(`✅ Created 2 notices\n`);

  // ============================================
  // 13. CREATE COMPLAINTS
  // ============================================
  console.log('📝 Creating complaints...');

  await prisma.complaint.create({
    data: {
      title: 'Broken Lift in Block A',
      description: 'The lift in Block A has been out of order for 3 days. Residents are facing difficulty.',
      category: 'MAINTENANCE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      flatId: flats[0].id,
      societyId: society1.id,
      reportedById: resident1.id,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Parking Space Issue',
      description: 'Unauthorized vehicles parked in visitor parking',
      category: 'PARKING',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flats2[0].id,
      societyId: society2.id,
      reportedById: resident6.id,
    },
  });

  console.log(`✅ Created 2 complaints\n`);

  // ============================================
  // 14. CREATE VEHICLE REGISTRATIONS
  // ============================================
  console.log('🚗 Creating vehicle registrations...');

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA01MJ9876',
      vehicleType: 'Car',
      model: 'Honda City',
      color: 'Silver',
      isActive: true,
      userId: resident1.id,
      flatId: flats[0].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH01AB1234',
      vehicleType: 'Car',
      model: 'Toyota Fortuner',
      color: 'Black',
      isActive: true,
      userId: resident6.id,
      flatId: flats2[0].id,
      societyId: society2.id,
    },
  });

  console.log(`✅ Created 2 vehicle registrations\n`);

  // ============================================
  // 15. CREATE NOTIFICATIONS
  // ============================================
  console.log('🔔 Creating notifications...');

  await prisma.notification.create({
    data: {
      type: 'SYSTEM',
      title: 'Welcome to Skyline Residency',
      message: 'Your account has been successfully created. Complete your profile to get started.',
      userId: resident1.id,
      societyId: society1.id,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      type: 'ENTRY_REQUEST',
      title: 'Delivery Approval Request',
      message: 'A delivery person is waiting at the gate for approval',
      userId: resident2.id,
      societyId: society1.id,
      isRead: false,
      referenceType: 'EntryRequest',
    },
  });

  console.log(`✅ Created 2 notifications\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Seed completed successfully!\n');
  console.log('=====================================');
  console.log('SUMMARY:');
  console.log('=====================================');
  console.log(`✅ Societies: 2 (Skyline Residency, Green Valley Apartments)`);
  console.log(`✅ Blocks: 3`);
  console.log(`✅ Flats: ${flats.length + flats2.length}`);
  console.log(`✅ Users: 13 (1 super admin, 2 society admins, 3 guards, 7 residents)`);
  console.log(`✅ Amenities: 4`);
  console.log(`✅ Pre-approvals: 2 (including 1 for race testing)`);
  console.log(`✅ Gate Passes: 2 (including 1 for race testing)`);
  console.log(`✅ Entry Records: 2`);
  console.log(`✅ Entry Requests: 1`);
  console.log(`✅ Domestic Staff: 2`);
  console.log(`✅ Staff Assignments: 1`);
  console.log(`✅ Notices: 2`);
  console.log(`✅ Complaints: 2`);
  console.log(`✅ Vehicle Registrations: 2`);
  console.log(`✅ Notifications: 2`);
  console.log('=====================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
