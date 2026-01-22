import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
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

  // Clean database
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

  const hashedPassword = await bcrypt.hash('Test@1234', 10);

  // SOCIETIES
  console.log('🏢 Creating societies...');
  const society1 = await prisma.society.create({
    data: {
      name: 'Skyline Residency',
      address: '123 MG Road, Koramangala, Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      contactName: 'Rajesh Kumar',
      contactPhone: '+919876543210',
      contactEmail: 'admin@skyline.com',
      totalFlats: 120,
      monthlyFee: 2500,
      nextDueDate: daysFromNow(15),
      paymentStatus: 'PAID',
    },
  });

  const society2 = await prisma.society.create({
    data: {
      name: 'Green Valley Apartments',
      address: '456 Park Avenue, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400053',
      contactName: 'Priya Sharma',
      contactPhone: '+919876543299',
      contactEmail: 'admin@greenvalley.com',
      totalFlats: 90,
      monthlyFee: 3500,
      nextDueDate: daysFromNow(10),
      paymentStatus: 'PAID',
    },
  });
  console.log('✅ 2 societies\n');

  // GATE POINTS
  console.log('🚪 Creating gate points...');
  const mainGate1 = await prisma.gatePoint.create({
    data: { name: 'Main Gate', isActive: true, societyId: society1.id },
  });
  await prisma.gatePoint.create({
    data: { name: 'Back Gate', isActive: true, societyId: society1.id },
  });
  await prisma.gatePoint.create({
    data: { name: 'Main Entrance', isActive: true, societyId: society2.id },
  });
  console.log('✅ 3 gate points\n');

  // BLOCKS
  console.log('🏗️ Creating blocks...');
  const blockA = await prisma.block.create({
    data: {
      name: 'Block A',
      societyId: society1.id,
      totalFloors: 10,
      description: 'Main block',
    },
  });

  const blockB = await prisma.block.create({
    data: {
      name: 'Block B',
      societyId: society1.id,
      totalFloors: 10,
      description: 'Premium block',
    },
  });

  const blockC = await prisma.block.create({
    data: {
      name: 'Block C',
      societyId: society1.id,
      totalFloors: 8,
    },
  });

  const towerX = await prisma.block.create({
    data: {
      name: 'Tower X',
      societyId: society2.id,
      totalFloors: 15,
    },
  });
  console.log('✅ 4 blocks\n');

  // FLATS
  console.log('🏠 Creating flats...');
  const flats: any[] = [];
  // Block A - 40 flats
  for (let floor = 1; floor <= 10; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `A-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: blockA.id,
          societyId: society1.id,
          isOccupied: floor <= 8,
        },
      });
      flats.push(flat);
    }
  }

  // Block B - 40 flats
  for (let floor = 1; floor <= 10; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `B-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: blockB.id,
          societyId: society1.id,
          isOccupied: floor <= 7,
        },
      });
      flats.push(flat);
    }
  }

  // Block C - 32 flats
  for (let floor = 1; floor <= 8; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `C-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: blockC.id,
          societyId: society1.id,
          isOccupied: floor <= 6,
        },
      });
      flats.push(flat);
    }
  }

  const flats2: any[] = [];
  // Tower X - 45 flats
  for (let floor = 1; floor <= 15; floor++) {
    for (let flatNum = 1; flatNum <= 3; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `X-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: towerX.id,
          societyId: society2.id,
          isOccupied: floor <= 12,
        },
      });
      flats2.push(flat);
    }
  }
  console.log(`✅ ${flats.length + flats2.length} flats\n`);

  // USERS
  console.log('👥 Creating users...');

  // Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      phone: '+919999999999',
      email: 'superadmin@societygate.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  // Society 1 - Admin
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

  // Society 1 - Guards
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

  const guard3 = await prisma.user.create({
    data: {
      name: 'Mahesh Kumar',
      phone: '+919123456782',
      email: 'mahesh.guard@skyline.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society1.id,
      isActive: true,
    },
  });

  // Society 1 - Residents (Family 1 - A-101)
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
      name: 'Priya Verma',
      phone: '+919111111112',
      email: 'priya.verma@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[0].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident1.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  const resident3 = await prisma.user.create({
    data: {
      name: 'Aarav Verma',
      phone: '+919111111113',
      email: 'aarav.verma@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[0].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident1.id,
      familyRole: 'CHILD',
      isActive: true,
    },
  });

  // Family 2 (A-201)
  const resident4 = await prisma.user.create({
    data: {
      name: 'Sneha Reddy',
      phone: '+919222222221',
      email: 'sneha.reddy@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[4].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  // Family 3 (B-101)
  const resident5 = await prisma.user.create({
    data: {
      name: 'Vikram Singh',
      phone: '+919333333331',
      email: 'vikram.singh@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[40].id,
      isOwner: false,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident6 = await prisma.user.create({
    data: {
      name: 'Ananya Singh',
      phone: '+919333333332',
      email: 'ananya.singh@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[40].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident5.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  // Family 4 (C-101)
  const resident7 = await prisma.user.create({
    data: {
      name: 'Rahul Kapoor',
      phone: '+919444444441',
      email: 'rahul.kapoor@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[80].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident8 = await prisma.user.create({
    data: {
      name: 'Anita Desai',
      phone: '+919555555551',
      email: 'anita.desai@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[56].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  // Society 2 Users
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

  const guard4 = await prisma.user.create({
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

  const resident9 = await prisma.user.create({
    data: {
      name: 'Kiran Patel',
      phone: '+919666666661',
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

  const resident10 = await prisma.user.create({
    data: {
      name: 'Maya Iyer',
      phone: '+919777777771',
      email: 'maya.iyer@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[3].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  console.log('✅ 19 users\n');

  // VEHICLES
  console.log('🚗 Creating vehicles...');
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
      vehicleNumber: 'KA02AB5432',
      vehicleType: 'Bike',
      model: 'Royal Enfield',
      color: 'Black',
      isActive: true,
      userId: resident3.id,
      flatId: flats[0].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA05CD1234',
      vehicleType: 'Car',
      model: 'Toyota Fortuner',
      color: 'White',
      isActive: true,
      userId: resident4.id,
      flatId: flats[4].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH01AB1234',
      vehicleType: 'Car',
      model: 'BMW 5 Series',
      color: 'Black',
      isActive: true,
      userId: resident9.id,
      flatId: flats2[0].id,
      societyId: society2.id,
    },
  });
  console.log('✅ 4 vehicles\n');

  // AMENITIES
  console.log('🏊 Creating amenities...');
  const gym1 = await prisma.amenity.create({
    data: {
      name: 'Fitness Center',
      type: 'GYM',
      description: 'Fully equipped gym',
      capacity: 25,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society1.id,
    },
  });

  const pool1 = await prisma.amenity.create({
    data: {
      name: 'Swimming Pool',
      type: 'SWIMMING_POOL',
      description: 'Olympic size pool',
      capacity: 40,
      pricePerHour: 200,
      maxBookingsPerUser: 3,
      isActive: true,
      societyId: society1.id,
    },
  });

  const clubhouse1 = await prisma.amenity.create({
    data: {
      name: 'Community Hall',
      type: 'CLUBHOUSE',
      description: 'Large hall for events',
      capacity: 150,
      pricePerHour: 2000,
      maxBookingsPerUser: 1,
      isActive: true,
      societyId: society1.id,
    },
  });

  const gym2 = await prisma.amenity.create({
    data: {
      name: 'Green Valley Gym',
      type: 'GYM',
      description: 'Premium fitness center',
      capacity: 20,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society2.id,
    },
  });
  console.log('✅ 4 amenities\n');

  // AMENITY BOOKINGS
  console.log('📅 Creating bookings...');
  const tomorrow = daysFromNow(1);
  tomorrow.setHours(18, 0, 0, 0);

  await prisma.amenityBooking.create({
    data: {
      amenityId: clubhouse1.id,
      userId: resident1.id,
      flatId: flats[0].id,
      societyId: society1.id,
      bookingDate: tomorrow,
      startTime: '18:00',
      endTime: '22:00',
      status: 'CONFIRMED',
      purpose: 'Birthday party',
    },
  });

  await prisma.amenityBooking.create({
    data: {
      amenityId: pool1.id,
      userId: resident4.id,
      flatId: flats[4].id,
      societyId: society1.id,
      bookingDate: daysFromNow(3),
      startTime: '16:00',
      endTime: '18:00',
      status: 'PENDING',
      purpose: 'Swimming lessons',
    },
  });
  console.log('✅ 2 bookings\n');

  // DOMESTIC STAFF
  console.log('👨‍🔧 Creating staff...');
  const maid1 = await prisma.domesticStaff.create({
    data: {
      name: 'Lakshmi Devi',
      phone: '+919000000001',
      staffType: 'MAID',
      qrToken: 'STAFF_MAID_001',
      isVerified: true,
      verifiedAt: daysAgo(30),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.5,
      totalReviews: 12,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  const cook1 = await prisma.domesticStaff.create({
    data: {
      name: 'Ramesh Kumar',
      phone: '+919000000002',
      staffType: 'COOK',
      qrToken: 'STAFF_COOK_001',
      isVerified: true,
      verifiedAt: daysAgo(45),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.8,
      totalReviews: 8,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  const maid2 = await prisma.domesticStaff.create({
    data: {
      name: 'Savita Patil',
      phone: '+919000000004',
      staffType: 'MAID',
      qrToken: 'STAFF_MAID_002',
      isVerified: true,
      verifiedAt: daysAgo(15),
      verifiedBy: admin2.id,
      isActive: true,
      rating: 4.6,
      totalReviews: 10,
      societyId: society2.id,
      addedById: admin2.id,
    },
  });
  console.log('✅ 3 staff\n');

  // STAFF ASSIGNMENTS
  console.log('🔗 Creating assignments...');
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flats[0].id,
      isActive: true,
      workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      workStartTime: '08:00',
      workEndTime: '10:00',
      agreedRate: 3000,
      rateType: 'monthly',
    },
  });

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: cook1.id,
      flatId: flats[40].id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      workStartTime: '17:00',
      workEndTime: '20:00',
      agreedRate: 8000,
      rateType: 'monthly',
    },
  });

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid2.id,
      flatId: flats2[0].id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      workStartTime: '09:00',
      workEndTime: '11:00',
      agreedRate: 4000,
      rateType: 'monthly',
    },
  });
  console.log('✅ 3 assignments\n');

  // STAFF ATTENDANCE
  console.log('📋 Creating attendance...');
  const today = new Date();
  today.setHours(8, 5, 0, 0);

  await prisma.staffAttendance.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flats[0].id,
      societyId: society1.id,
      checkInTime: new Date(today),
      checkOutTime: new Date(today.setHours(10, 2, 0, 0)),
    },
  });

  await prisma.staffAttendance.create({
    data: {
      domesticStaffId: cook1.id,
      flatId: flats[40].id,
      societyId: society1.id,
      checkInTime: hoursAgo(3),
      checkOutTime: hoursAgo(1),
    },
  });
  console.log('✅ 2 attendance records\n');

  // STAFF REVIEWS
  console.log('⭐ Creating reviews...');
  await prisma.staffReview.create({
    data: {
      domesticStaffId: maid1.id,
      reviewerId: resident1.id,
      flatId: flats[0].id,
      rating: 5,
      review: 'Excellent work! Very punctual.',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });

  await prisma.staffReview.create({
    data: {
      domesticStaffId: cook1.id,
      reviewerId: resident5.id,
      flatId: flats[40].id,
      rating: 5,
      review: 'Amazing cook! Food is delicious.',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });
  console.log('✅ 2 reviews\n');

  // PRE-APPROVALS
  console.log('✅ Creating pre-approvals...');
  const validFrom = new Date();
  const validUntil = daysFromNow(7);

  await prisma.preApproval.create({
    data: {
      visitorName: 'Rohit Sharma',
      visitorPhone: '+919100000001',
      visitorType: 'FRIEND',
      purpose: 'Weekend visit',
      qrToken: 'PRE_SKYLINE_001',
      validFrom,
      validUntil,
      maxUses: 3,
      usedCount: 1,
      status: 'ACTIVE',
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: resident1.id,
    },
  });

  await prisma.preApproval.create({
    data: {
      visitorName: 'Test Visitor',
      visitorPhone: '+919100000099',
      visitorType: 'GUEST',
      purpose: 'Race condition testing',
      qrToken: 'PRE_RACE_TEST_001',
      validFrom,
      validUntil,
      maxUses: 3,
      usedCount: 0,
      status: 'ACTIVE',
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: resident1.id,
    },
  });
  console.log('✅ 2 pre-approvals\n');

  // GATE PASSES
  console.log('🎫 Creating gate passes...');
  const passValidFrom = new Date();
  const passValidUntil = daysFromNow(3);

  await prisma.gatePass.create({
    data: {
      type: 'MATERIAL',
      title: 'Furniture Delivery',
      description: 'New sofa set',
      vehicleNumber: 'KA03AB9876',
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

  await prisma.gatePass.create({
    data: {
      type: 'VEHICLE',
      title: 'Vehicle Entry Test',
      description: 'Race condition testing',
      vehicleNumber: 'TEST1234',
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
  console.log('✅ 2 gate passes\n');

  // AUTO-APPROVE RULES
  console.log('📦 Creating auto-approve rules...');
  await prisma.deliveryAutoApproveRule.create({
    data: {
      flatId: flats[0].id,
      societyId: society1.id,
      isActive: true,
      timeFrom: '08:00',
      timeUntil: '23:00',
      createdById: resident1.id,
    },
  });

  await prisma.deliveryAutoApproveRule.create({
    data: {
      flatId: flats[4].id,
      societyId: society1.id,
      isActive: true,
      createdById: resident4.id,
    },
  });
  console.log('✅ 2 rules\n');

  // EXPECTED DELIVERIES
  console.log('📦 Creating expected deliveries...');
  await prisma.expectedDelivery.create({
    data: {
      flatId: flats[0].id,
      societyId: society1.id,
      companyName: 'Amazon',
      itemName: 'Books and electronics',
      expectedDate: daysFromNow(1),
      expiresAt: daysFromNow(2),
      autoApprove: true,
      isUsed: false,
      createdById: resident1.id,
    },
  });
  console.log('✅ 1 delivery\n');

  // ENTRIES
  console.log('🚪 Creating entries...');
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Deepak Joshi',
      visitorPhone: '+919200000001',
      visitorType: 'FRIEND',
      purpose: 'Personal visit',
      checkInTime: daysAgo(2),
      checkOutTime: hoursAgo(46),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: false,
      approvedById: resident1.id,
      approvedAt: daysAgo(2),
    },
  });

  await prisma.entry.create({
    data: {
      type: 'DELIVERY',
      status: 'CHECKED_IN',
      visitorName: 'Swiggy Delivery',
      visitorPhone: '+919200000002',
      purpose: 'Food delivery',
      checkInTime: hoursAgo(1),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Auto-approved by rule',
    },
  });

  await prisma.entry.create({
    data: {
      type: 'DOMESTIC_STAFF',
      status: 'CHECKED_OUT',
      visitorName: 'Lakshmi Devi',
      visitorPhone: '+919000000001',
      purpose: 'Cleaning work',
      checkInTime: hoursAgo(4),
      checkOutTime: hoursAgo(2),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Verified staff',
      domesticStaffId: maid1.id,
    },
  });

  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_IN',
      visitorName: 'Rajesh Malhotra',
      visitorPhone: '+919200000004',
      visitorType: 'GUEST',
      purpose: 'Business meeting',
      checkInTime: hoursAgo(1),
      flatId: flats2[0].id,
      societyId: society2.id,
      createdById: guard4.id,
      wasAutoApproved: false,
      approvedById: resident9.id,
      approvedAt: hoursAgo(1),
    },
  });
  console.log('✅ 4 entries\n');

  // ENTRY REQUESTS
  console.log('📸 Creating entry requests...');
  await prisma.entryRequest.create({
    data: {
      type: 'DELIVERY',
      status: 'PENDING',
      visitorName: 'Zomato Delivery',
      visitorPhone: '+919300000001',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      flatId: flats[4].id,
      societyId: society1.id,
      guardId: guard1.id,
    },
  });

  await prisma.entryRequest.create({
    data: {
      type: 'VISITOR',
      status: 'PENDING',
      visitorName: 'Amit Kumar',
      visitorPhone: '+919300000002',
      expiresAt: new Date(Date.now() + 12 * 60 * 1000),
      flatId: flats[40].id,
      societyId: society1.id,
      guardId: guard2.id,
    },
  });
  console.log('✅ 2 entry requests\n');

  // NOTICES
  console.log('📢 Creating notices...');
  await prisma.notice.create({
    data: {
      title: 'Monthly Maintenance Payment Reminder',
      description: 'Maintenance fees due by 5th Feb',
      type: 'GENERAL',
      priority: 'HIGH',
      isActive: true,
      isPinned: true,
      isUrgent: true,
      publishAt: new Date(),
      expiresAt: daysFromNow(15),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Water Supply Disruption',
      description: 'Water supply interrupted on 25th Jan from 10 AM to 2 PM',
      type: 'MAINTENANCE',
      priority: 'HIGH',
      isActive: true,
      publishAt: new Date(),
      expiresAt: daysFromNow(3),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Republic Day Celebration',
      description: 'Flag hoisting at 8 AM on 26th Jan',
      type: 'EVENT',
      priority: 'MEDIUM',
      isActive: true,
      isPinned: true,
      publishAt: new Date(),
      expiresAt: daysFromNow(4),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Gym Equipment Upgrade',
      description: 'New treadmills installed',
      type: 'GENERAL',
      priority: 'LOW',
      isActive: true,
      publishAt: new Date(),
      societyId: society2.id,
      createdById: admin2.id,
      images: [],
      documents: [],
    },
  });
  console.log('✅ 4 notices\n');

  // COMPLAINTS
  console.log('📝 Creating complaints...');
  await prisma.complaint.create({
    data: {
      title: 'Broken Elevator in Block A',
      description: 'Elevator malfunctioning for 3 days',
      category: 'MAINTENANCE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      flatId: flats[0].id,
      societyId: society1.id,
      reportedById: resident1.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Water Leakage',
      description: 'Water leakage near main gate',
      category: 'WATER',
      priority: 'HIGH',
      status: 'RESOLVED',
      flatId: flats[4].id,
      societyId: society1.id,
      reportedById: resident4.id,
      isAnonymous: false,
      resolvedAt: new Date(),
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Loud Music at Night',
      description: 'Loud music till 1 AM',
      category: 'NOISE',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flats[40].id,
      societyId: society1.id,
      reportedById: resident5.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Parking Issue',
      description: 'Unauthorized parking',
      category: 'PARKING',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flats2[0].id,
      societyId: society2.id,
      reportedById: resident9.id,
      isAnonymous: false,
    },
  });
  console.log('✅ 4 complaints\n');

  // EMERGENCIES
  console.log('🚨 Creating emergencies...');
  await prisma.emergency.create({
    data: {
      type: 'FIRE',
      description: 'Small kitchen fire, controlled',
      status: 'RESOLVED',
      resolvedAt: daysAgo(7),
      flatId: flats[0].id,
      societyId: society1.id,
      reportedById: resident1.id,
    },
  });

  await prisma.emergency.create({
    data: {
      type: 'MEDICAL',
      description: 'Elderly resident fell, ambulance called',
      status: 'RESOLVED',
      resolvedAt: daysAgo(3),
      flatId: flats[4].id,
      societyId: society1.id,
      reportedById: resident4.id,
    },
  });
  console.log('✅ 2 emergencies\n');

  // VENDORS
  console.log('🏪 Creating vendors...');
  await prisma.vendor.create({
    data: {
      name: 'Kumar Plumbing',
      category: 'PLUMBER',
      phone: '+918012340001',
      email: 'kumar@plumbing.com',
      description: 'Professional plumbing',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'City Electricians',
      category: 'ELECTRICIAN',
      phone: '+918012340002',
      email: 'city@electricians.com',
      description: 'Electrical repairs',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });
  console.log('✅ 2 vendors\n');

  // VISITOR FREQUENCY
  console.log('👥 Creating visitor frequency...');
  await prisma.visitorFrequency.create({
    data: {
      visitorName: 'Rohit Sharma',
      visitorPhone: '+919100000001',
      flatId: flats[0].id,
      societyId: society1.id,
      visitCount: 8,
      lastVisit: daysAgo(2),
    },
  });

  await prisma.visitorFrequency.create({
    data: {
      visitorName: 'Lakshmi Devi',
      visitorPhone: '+919000000001',
      flatId: flats[0].id,
      societyId: society1.id,
      visitCount: 45,
      lastVisit: hoursAgo(2),
    },
  });
  console.log('✅ 2 frequency records\n');

  // NOTIFICATIONS
  console.log('🔔 Creating notifications...');
  await prisma.notification.create({
    data: {
      type: 'SYSTEM',
      title: 'Welcome',
      message: 'Account activated',
      userId: resident1.id,
      societyId: society1.id,
      isRead: true,
      readAt: daysAgo(60),
    },
  });

  await prisma.notification.create({
    data: {
      type: 'ENTRY_REQUEST',
      title: 'Delivery Waiting',
      message: 'Zomato delivery at gate',
      userId: resident4.id,
      societyId: society1.id,
      isRead: false,
      referenceType: 'EntryRequest',
    },
  });

  await prisma.notification.create({
    data: {
      type: 'ONBOARDING_STATUS',
      title: 'Booking Approved',
      message: 'Hall booking approved',
      userId: resident1.id,
      societyId: society1.id,
      isRead: true,
      readAt: daysAgo(1),
      referenceType: 'AmenityBooking',
    },
  });

  await prisma.notification.create({
    data: {
      type: 'DELIVERY_REQUEST',
      title: 'Package Arriving',
      message: 'Amazon package today',
      userId: resident1.id,
      societyId: society1.id,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      type: 'EMERGENCY_ALERT',
      title: 'Fire Incident',
      message: 'Minor fire in A-101, controlled',
      userId: admin1.id,
      societyId: society1.id,
      isRead: true,
      readAt: daysAgo(7),
    },
  });
  console.log('✅ 5 notifications\n');

  // SUMMARY
  console.log('\n🎉 Production-ready seed completed!\n');
  console.log('=====================================');
  console.log('SUMMARY:');
  console.log('=====================================');
  console.log(`✅ Societies: 2`);
  console.log(`✅ Gate Points: 3`);
  console.log(`✅ Blocks: 4`);
  console.log(`✅ Flats: ${flats.length + flats2.length}`);
  console.log(`✅ Users: 19 (with families)`);
  console.log(`✅ Vehicles: 4`);
  console.log(`✅ Amenities: 4`);
  console.log(`✅ Bookings: 2`);
  console.log(`✅ Staff: 3`);
  console.log(`✅ Assignments: 3`);
  console.log(`✅ Attendance: 2`);
  console.log(`✅ Reviews: 2`);
  console.log(`✅ Pre-approvals: 2 (+ race test)`);
  console.log(`✅ Gate Passes: 2 (+ race test)`);
  console.log(`✅ Auto-approve Rules: 2`);
  console.log(`✅ Expected Deliveries: 1`);
  console.log(`✅ Entries: 4`);
  console.log(`✅ Entry Requests: 2 (pending)`);
  console.log(`✅ Notices: 4`);
  console.log(`✅ Complaints: 4`);
  console.log(`✅ Emergencies: 2`);
  console.log(`✅ Vendors: 2`);
  console.log(`✅ Visitor Frequency: 2`);
  console.log(`✅ Notifications: 5`);
  console.log('=====================================\n');
  console.log('🔐 ALL PASSWORDS: Test@1234');
  console.log('📧 See TEST_CREDENTIALS_FULL.md');
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
