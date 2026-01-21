import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting realistic database seed...\n');

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

  console.log('✅ Database cleaned\n');

  // ============================================
  // 1. CREATE SOCIETIES
  // ============================================
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
      contactEmail: 'admin@skylineresidency.com',
      totalFlats: 120,
      totalBlocks: 3,
      establishedYear: 2018,
      monthlyFee: 2500,
      nextDueDate: new Date('2026-02-05'),
      paymentStatus: 'PAID',
      emergencyContact: '+918012345678',
    },
  });

  const society2 = await prisma.society.create({
    data: {
      name: 'Green Valley Apartments',
      address: '456 Park Avenue, Andheri West, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400053',
      contactName: 'Priya Sharma',
      contactPhone: '+919876543299',
      contactEmail: 'admin@greenvalley.com',
      totalFlats: 80,
      totalBlocks: 2,
      establishedYear: 2020,
      monthlyFee: 3500,
      nextDueDate: new Date('2026-02-05'),
      paymentStatus: 'PAID',
      emergencyContact: '+912212345678',
    },
  });

  console.log(`✅ Created 2 societies\n`);

  // ============================================
  // 2. CREATE GATE POINTS
  // ============================================
  console.log('🚪 Creating gate points...');

  const mainGate1 = await prisma.gatePoint.create({
    data: {
      name: 'Main Gate',
      location: 'MG Road Entrance',
      isActive: true,
      societyId: society1.id,
    },
  });

  const backGate1 = await prisma.gatePoint.create({
    data: {
      name: 'Back Gate',
      location: 'Service Road',
      isActive: true,
      societyId: society1.id,
    },
  });

  const mainGate2 = await prisma.gatePoint.create({
    data: {
      name: 'Main Entrance',
      location: 'Park Avenue',
      isActive: true,
      societyId: society2.id,
    },
  });

  console.log(`✅ Created 3 gate points\n`);

  // ============================================
  // 3. CREATE BLOCKS
  // ============================================
  console.log('🏗️ Creating blocks...');

  // Society 1 Blocks
  const blockA = await prisma.block.create({
    data: {
      name: 'Block A',
      societyId: society1.id,
      totalFloors: 10,
      description: 'Main residential block facing MG Road',
    },
  });

  const blockB = await prisma.block.create({
    data: {
      name: 'Block B',
      societyId: society1.id,
      totalFloors: 10,
      description: 'Premium block with park view',
    },
  });

  const blockC = await prisma.block.create({
    data: {
      name: 'Block C',
      societyId: society1.id,
      totalFloors: 8,
      description: 'Economy block',
    },
  });

  // Society 2 Blocks
  const towerX = await prisma.block.create({
    data: {
      name: 'Tower X',
      societyId: society2.id,
      totalFloors: 15,
      description: 'High-rise luxury tower',
    },
  });

  const towerY = await prisma.block.create({
    data: {
      name: 'Tower Y',
      societyId: society2.id,
      totalFloors: 15,
      description: 'High-rise premium tower',
    },
  });

  console.log(`✅ Created 5 blocks\n`);

  // ============================================
  // 4. CREATE FLATS
  // ============================================
  console.log('🏠 Creating flats...');

  const flats: any[] = [];

  // Block A - 40 flats (10 floors × 4 flats)
  for (let floor = 1; floor <= 10; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `A-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: blockA.id,
          societyId: society1.id,
          isOccupied: floor <= 8 ? true : false, // 80% occupancy
          bhk: flatNum <= 2 ? '2BHK' : '3BHK',
          area: flatNum <= 2 ? 950 : 1400,
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
          isOccupied: floor <= 7 ? true : false,
          bhk: flatNum <= 2 ? '2BHK' : '3BHK',
          area: flatNum <= 2 ? 1100 : 1600,
        },
      });
      flats.push(flat);
    }
  }

  // Block C - 32 flats (8 floors × 4 flats)
  for (let floor = 1; floor <= 8; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `C-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: blockC.id,
          societyId: society1.id,
          isOccupied: floor <= 6 ? true : false,
          bhk: '2BHK',
          area: 850,
        },
      });
      flats.push(flat);
    }
  }

  // Society 2 Flats
  const flats2: any[] = [];

  // Tower X - 45 flats (15 floors × 3 flats)
  for (let floor = 1; floor <= 15; floor++) {
    for (let flatNum = 1; flatNum <= 3; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `X-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: towerX.id,
          societyId: society2.id,
          isOccupied: floor <= 12 ? true : false,
          bhk: flatNum === 1 ? '3BHK' : '4BHK',
          area: flatNum === 1 ? 1800 : 2200,
        },
      });
      flats2.push(flat);
    }
  }

  // Tower Y - 45 flats
  for (let floor = 1; floor <= 15; floor++) {
    for (let flatNum = 1; flatNum <= 3; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `Y-${floor}${flatNum.toString().padStart(2, '0')}`,
          floor: `${floor}`,
          blockId: towerY.id,
          societyId: society2.id,
          isOccupied: floor <= 10 ? true : false,
          bhk: flatNum === 1 ? '3BHK' : '4BHK',
          area: flatNum === 1 ? 1800 : 2200,
        },
      });
      flats2.push(flat);
    }
  }

  console.log(`✅ Created ${flats.length + flats2.length} flats\n`);

  // ============================================
  // 5. CREATE USERS
  // ============================================
  console.log('👥 Creating users...');

  const hashedPassword = await bcrypt.hash('Test@1234', 10);

  // Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      phone: '+919999999999',
      email: 'superadmin@societygate.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=System+Admin',
    },
  });

  // ============================================
  // SOCIETY 1 USERS (Skyline Residency)
  // ============================================

  // Admin
  const admin1 = await prisma.user.create({
    data: {
      name: 'Rajesh Kumar',
      phone: '+919876543210',
      email: 'rajesh.admin@skyline.com',
      password: hashedPassword,
      role: 'ADMIN',
      societyId: society1.id,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Rajesh+Kumar',
      emergencyContact: '+919876543211',
    },
  });

  // Guards - Day and Night shifts
  const guard1 = await prisma.user.create({
    data: {
      name: 'Ramesh Singh',
      phone: '+919123456780',
      email: 'ramesh.guard@skyline.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society1.id,
      gatePointId: mainGate1.id,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Ramesh+Singh',
      shiftTiming: 'Day Shift (6 AM - 6 PM)',
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
      gatePointId: mainGate1.id,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Suresh+Yadav',
      shiftTiming: 'Night Shift (6 PM - 6 AM)',
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
      gatePointId: backGate1.id,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Mahesh+Kumar',
      shiftTiming: 'Day Shift (6 AM - 6 PM)',
    },
  });

  // Residents - Create diverse families
  const residents1: any[] = [];

  // Family 1 - A-101 (Owner + Spouse + 2 Kids)
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
      profilePhoto: 'https://ui-avatars.com/api/?name=Amit+Verma',
      emergencyContact: '+919111111112',
      occupation: 'Software Engineer',
      aadhaarNumber: '1234-5678-9012',
    },
  });
  residents1.push(resident1);

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
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Priya+Verma',
      emergencyContact: '+919111111111',
      occupation: 'Teacher',
      relationshipWithOwner: 'Spouse',
    },
  });
  residents1.push(resident2);

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
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Aarav+Verma',
      emergencyContact: '+919111111111',
      occupation: 'Student',
      relationshipWithOwner: 'Child',
    },
  });
  residents1.push(resident3);

  // Family 2 - A-201 (Single owner)
  const resident4 = await prisma.user.create({
    data: {
      name: 'Sneha Reddy',
      phone: '+919222222221',
      email: 'sneha.reddy@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[4].id, // A-201
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Sneha+Reddy',
      emergencyContact: '+919222222222',
      occupation: 'Doctor',
      aadhaarNumber: '2234-5678-9012',
    },
  });
  residents1.push(resident4);

  // Family 3 - B-101 (Tenant family)
  const resident5 = await prisma.user.create({
    data: {
      name: 'Vikram Singh',
      phone: '+919333333331',
      email: 'vikram.singh@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[40].id, // B-101
      isOwner: false,
      isPrimaryResident: true,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Vikram+Singh',
      emergencyContact: '+919333333332',
      occupation: 'Business Analyst',
    },
  });
  residents1.push(resident5);

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
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Ananya+Singh',
      emergencyContact: '+919333333331',
      occupation: 'Designer',
      relationshipWithOwner: 'Spouse',
    },
  });
  residents1.push(resident6);

  // Family 4 - C-101
  const resident7 = await prisma.user.create({
    data: {
      name: 'Rahul Kapoor',
      phone: '+919444444441',
      email: 'rahul.kapoor@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[80].id, // C-101
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Rahul+Kapoor',
      emergencyContact: '+919444444442',
      occupation: 'Entrepreneur',
      aadhaarNumber: '3234-5678-9012',
    },
  });
  residents1.push(resident7);

  // Family 5 - B-501
  const resident8 = await prisma.user.create({
    data: {
      name: 'Anita Desai',
      phone: '+919555555551',
      email: 'anita.desai@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[56].id, // B-501
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Anita+Desai',
      emergencyContact: '+919555555552',
      occupation: 'Architect',
      aadhaarNumber: '4234-5678-9012',
    },
  });
  residents1.push(resident8);

  // ============================================
  // SOCIETY 2 USERS (Green Valley)
  // ============================================

  // Admin
  const admin2 = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      phone: '+919876543299',
      email: 'priya.admin@greenvalley.com',
      password: hashedPassword,
      role: 'ADMIN',
      societyId: society2.id,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Priya+Sharma',
      emergencyContact: '+919876543298',
    },
  });

  // Guards
  const guard4 = await prisma.user.create({
    data: {
      name: 'Mohan Das',
      phone: '+919123456790',
      email: 'mohan.guard@greenvalley.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society2.id,
      gatePointId: mainGate2.id,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Mohan+Das',
      shiftTiming: 'Day Shift (6 AM - 6 PM)',
    },
  });

  const guard5 = await prisma.user.create({
    data: {
      name: 'Ravi Shankar',
      phone: '+919123456791',
      email: 'ravi.guard@greenvalley.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society2.id,
      gatePointId: mainGate2.id,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Ravi+Shankar',
      shiftTiming: 'Night Shift (6 PM - 6 AM)',
    },
  });

  // Residents
  const residents2: any[] = [];

  // Family - X-101
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
      profilePhoto: 'https://ui-avatars.com/api/?name=Kiran+Patel',
      emergencyContact: '+919666666662',
      occupation: 'CEO',
      aadhaarNumber: '5234-5678-9012',
    },
  });
  residents2.push(resident9);

  const resident10 = await prisma.user.create({
    data: {
      name: 'Maya Iyer',
      phone: '+919777777771',
      email: 'maya.iyer@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[3].id, // X-201
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Maya+Iyer',
      emergencyContact: '+919777777772',
      occupation: 'Lawyer',
      aadhaarNumber: '6234-5678-9012',
    },
  });
  residents2.push(resident10);

  const resident11 = await prisma.user.create({
    data: {
      name: 'Arjun Mehta',
      phone: '+919888888881',
      email: 'arjun.mehta@gmail.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[6].id, // X-301
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
      profilePhoto: 'https://ui-avatars.com/api/?name=Arjun+Mehta',
      emergencyContact: '+919888888882',
      occupation: 'Investment Banker',
      aadhaarNumber: '7234-5678-9012',
    },
  });
  residents2.push(resident11);

  console.log(`✅ Created ${10 + residents1.length + residents2.length} users\n`);

  // ============================================
  // 6. CREATE VEHICLES
  // ============================================
  console.log('🚗 Creating vehicle registrations...');

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA01MJ9876',
      vehicleType: 'Car',
      model: 'Honda City',
      color: 'Silver',
      manufacturer: 'Honda',
      isActive: true,
      userId: resident1.id,
      flatId: flats[0].id,
      societyId: society1.id,
      registeredAt: new Date('2024-01-15'),
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA02AB5432',
      vehicleType: 'Bike',
      model: 'Royal Enfield Classic 350',
      color: 'Black',
      manufacturer: 'Royal Enfield',
      isActive: true,
      userId: resident3.id,
      flatId: flats[0].id,
      societyId: society1.id,
      registeredAt: new Date('2024-03-20'),
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA05CD1234',
      vehicleType: 'Car',
      model: 'Toyota Fortuner',
      color: 'White',
      manufacturer: 'Toyota',
      isActive: true,
      userId: resident4.id,
      flatId: flats[4].id,
      societyId: society1.id,
      registeredAt: new Date('2023-11-10'),
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH01AB1234',
      vehicleType: 'Car',
      model: 'BMW 5 Series',
      color: 'Black',
      manufacturer: 'BMW',
      isActive: true,
      userId: resident9.id,
      flatId: flats2[0].id,
      societyId: society2.id,
      registeredAt: new Date('2024-02-05'),
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH02XY9876',
      vehicleType: 'Car',
      model: 'Mercedes E-Class',
      color: 'Silver',
      manufacturer: 'Mercedes-Benz',
      isActive: true,
      userId: resident10.id,
      flatId: flats2[3].id,
      societyId: society2.id,
      registeredAt: new Date('2023-12-15'),
    },
  });

  console.log(`✅ Created 5 vehicle registrations\n`);

  // ============================================
  // 7. CREATE AMENITIES
  // ============================================
  console.log('🏊 Creating amenities...');

  const gym1 = await prisma.amenity.create({
    data: {
      name: 'Skyline Fitness Center',
      type: 'GYM',
      description: 'Fully equipped gym with cardio machines, weights, yoga area, and personal trainers available',
      capacity: 25,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society1.id,
      operatingHours: '5:00 AM - 11:00 PM',
      amenities: ['Treadmill', 'Cross Trainer', 'Dumbbells', 'Yoga Mats', 'Steam Room'],
    },
  });

  const pool1 = await prisma.amenity.create({
    data: {
      name: 'Swimming Pool',
      type: 'SWIMMING_POOL',
      description: 'Olympic size heated swimming pool with separate kids pool and lifeguard on duty',
      capacity: 40,
      pricePerHour: 200,
      maxBookingsPerUser: 3,
      isActive: true,
      societyId: society1.id,
      operatingHours: '6:00 AM - 8:00 PM',
      amenities: ['Lifeguard', 'Changing Room', 'Shower', 'Locker'],
    },
  });

  const clubhouse1 = await prisma.amenity.create({
    data: {
      name: 'Community Hall',
      type: 'CLUBHOUSE',
      description: 'Spacious air-conditioned hall for events, parties, and community gatherings with kitchen facility',
      capacity: 150,
      pricePerHour: 2000,
      maxBookingsPerUser: 1,
      isActive: true,
      societyId: society1.id,
      operatingHours: '24/7 (Booking Required)',
      amenities: ['AC', 'Sound System', 'Projector', 'Kitchen', 'Tables & Chairs'],
    },
  });

  const sports1 = await prisma.amenity.create({
    data: {
      name: 'Sports Complex',
      type: 'SPORTS',
      description: 'Multi-purpose sports facility with badminton, basketball, and tennis courts',
      capacity: 30,
      pricePerHour: 300,
      maxBookingsPerUser: 4,
      isActive: true,
      societyId: society1.id,
      operatingHours: '6:00 AM - 10:00 PM',
      amenities: ['Badminton Court', 'Basketball Court', 'Tennis Court', 'Changing Room'],
    },
  });

  const gym2 = await prisma.amenity.create({
    data: {
      name: 'Green Valley Gym',
      type: 'GYM',
      description: 'Premium fitness center with latest equipment and certified trainers',
      capacity: 20,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society2.id,
      operatingHours: '5:00 AM - 11:00 PM',
      amenities: ['Modern Equipment', 'Personal Trainer', 'Yoga Studio', 'Sauna'],
    },
  });

  const pool2 = await prisma.amenity.create({
    data: {
      name: 'Infinity Pool',
      type: 'SWIMMING_POOL',
      description: 'Rooftop infinity pool with stunning city views',
      capacity: 30,
      pricePerHour: 300,
      maxBookingsPerUser: 3,
      isActive: true,
      societyId: society2.id,
      operatingHours: '7:00 AM - 9:00 PM',
      amenities: ['Lifeguard', 'Poolside Bar', 'Cabana', 'Changing Room'],
    },
  });

  console.log(`✅ Created 6 amenities\n`);

  // ============================================
  // 8. CREATE AMENITY BOOKINGS
  // ============================================
  console.log('📅 Creating amenity bookings...');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(19, 0, 0, 0);

  await prisma.amenityBooking.create({
    data: {
      amenityId: clubhouse1.id,
      userId: resident1.id,
      flatId: flats[0].id,
      societyId: society1.id,
      bookingDate: tomorrow,
      startTime: '18:00',
      endTime: '22:00',
      status: 'APPROVED',
      purpose: 'Birthday party for my son',
      approvedById: admin1.id,
      approvedAt: new Date(),
    },
  });

  await prisma.amenityBooking.create({
    data: {
      amenityId: sports1.id,
      userId: resident5.id,
      flatId: flats[40].id,
      societyId: society1.id,
      bookingDate: nextWeek,
      startTime: '17:00',
      endTime: '19:00',
      status: 'PENDING',
      purpose: 'Badminton tournament practice',
    },
  });

  await prisma.amenityBooking.create({
    data: {
      amenityId: pool2.id,
      userId: resident9.id,
      flatId: flats2[0].id,
      societyId: society2.id,
      bookingDate: tomorrow,
      startTime: '16:00',
      endTime: '18:00',
      status: 'APPROVED',
      purpose: 'Swimming practice for kids',
      approvedById: admin2.id,
      approvedAt: new Date(),
    },
  });

  console.log(`✅ Created 3 amenity bookings\n`);

  // ============================================
  // 9. CREATE DOMESTIC STAFF
  // ============================================
  console.log('👨‍🔧 Creating domestic staff...');

  const maid1 = await prisma.domesticStaff.create({
    data: {
      name: 'Lakshmi Devi',
      phone: '+919000000001',
      staffType: 'MAID',
      qrToken: 'STAFF_MAID_001',
      gender: 'Female',
      age: 35,
      address: 'BTM Layout, Bangalore',
      idProofType: 'Aadhaar',
      idProofNumber: 'XXXX-XXXX-1234',
      policeVerificationNumber: 'PV-2024-001',
      isVerified: true,
      verifiedAt: new Date('2024-01-10'),
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
      gender: 'Male',
      age: 42,
      address: 'Koramangala, Bangalore',
      idProofType: 'Aadhaar',
      idProofNumber: 'XXXX-XXXX-5678',
      policeVerificationNumber: 'PV-2024-002',
      isVerified: true,
      verifiedAt: new Date('2024-02-15'),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.8,
      totalReviews: 8,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  const driver1 = await prisma.domesticStaff.create({
    data: {
      name: 'Sunil Sharma',
      phone: '+919000000003',
      staffType: 'DRIVER',
      qrToken: 'STAFF_DRIVER_001',
      gender: 'Male',
      age: 38,
      address: 'Whitefield, Bangalore',
      idProofType: 'Driving License',
      idProofNumber: 'DL-KA-2020-123456',
      policeVerificationNumber: 'PV-2024-003',
      isVerified: true,
      verifiedAt: new Date('2024-01-20'),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.3,
      totalReviews: 6,
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
      gender: 'Female',
      age: 40,
      address: 'Andheri West, Mumbai',
      idProofType: 'Aadhaar',
      idProofNumber: 'XXXX-XXXX-9012',
      policeVerificationNumber: 'PV-2024-004',
      isVerified: true,
      verifiedAt: new Date('2024-02-01'),
      verifiedBy: admin2.id,
      isActive: true,
      rating: 4.6,
      totalReviews: 10,
      societyId: society2.id,
      addedById: admin2.id,
    },
  });

  console.log(`✅ Created 4 domestic staff\n`);

  // ============================================
  // 10. CREATE STAFF ASSIGNMENTS
  // ============================================
  console.log('🔗 Creating staff assignments...');

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flats[0].id,
      assignedById: resident1.id,
      isActive: true,
      workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      workStartTime: '08:00',
      workEndTime: '10:00',
      agreedRate: 3000,
      rateType: 'monthly',
      startDate: new Date('2024-01-15'),
    },
  });

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flats[4].id,
      assignedById: resident4.id,
      isActive: true,
      workingDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      workStartTime: '10:30',
      workEndTime: '12:00',
      agreedRate: 2800,
      rateType: 'monthly',
      startDate: new Date('2024-02-01'),
    },
  });

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: cook1.id,
      flatId: flats[40].id,
      assignedById: resident5.id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      workStartTime: '17:00',
      workEndTime: '20:00',
      agreedRate: 8000,
      rateType: 'monthly',
      startDate: new Date('2024-01-20'),
    },
  });

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid2.id,
      flatId: flats2[0].id,
      assignedById: resident9.id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      workStartTime: '09:00',
      workEndTime: '11:00',
      agreedRate: 4000,
      rateType: 'monthly',
      startDate: new Date('2024-02-10'),
    },
  });

  console.log(`✅ Created 4 staff assignments\n`);

  // ============================================
  // 11. CREATE STAFF ATTENDANCE
  // ============================================
  console.log('📋 Creating staff attendance...');

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.staffAttendance.create({
    data: {
      staffId: maid1.id,
      flatId: flats[0].id,
      date: today,
      checkInTime: new Date(today.setHours(8, 5, 0, 0)),
      checkOutTime: new Date(today.setHours(10, 2, 0, 0)),
      status: 'PRESENT',
      markedById: resident1.id,
    },
  });

  await prisma.staffAttendance.create({
    data: {
      staffId: cook1.id,
      flatId: flats[40].id,
      date: yesterday,
      checkInTime: new Date(yesterday.setHours(17, 10, 0, 0)),
      checkOutTime: new Date(yesterday.setHours(20, 5, 0, 0)),
      status: 'PRESENT',
      markedById: resident5.id,
    },
  });

  console.log(`✅ Created 2 staff attendance records\n`);

  // ============================================
  // 12. CREATE STAFF REVIEWS
  // ============================================
  console.log('⭐ Creating staff reviews...');

  await prisma.staffReview.create({
    data: {
      staffId: maid1.id,
      reviewerId: resident1.id,
      flatId: flats[0].id,
      rating: 5,
      comment: 'Excellent work! Very punctual and thorough with cleaning. Highly recommended.',
    },
  });

  await prisma.staffReview.create({
    data: {
      staffId: cook1.id,
      reviewerId: resident5.id,
      flatId: flats[40].id,
      rating: 5,
      comment: 'Amazing cook! Food is delicious and always on time. Worth every penny.',
    },
  });

  await prisma.staffReview.create({
    data: {
      staffId: maid1.id,
      reviewerId: resident4.id,
      flatId: flats[4].id,
      rating: 4,
      comment: 'Good service, but sometimes arrives 10-15 minutes late.',
    },
  });

  console.log(`✅ Created 3 staff reviews\n`);

  // Continue in next part...
  console.log('✅ Part 1 completed. Continuing with entries, notices, etc...\n');

  // ============================================
  // 13. CREATE PRE-APPROVALS
  // ============================================
  console.log('✅ Creating pre-approvals...');

  const validFrom = new Date();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);

  await prisma.preApproval.create({
    data: {
      visitorName: 'Rohit Sharma',
      visitorPhone: '+919100000001',
      visitorType: 'FRIEND',
      purpose: 'Weekend visit and dinner',
      qrToken: 'PRE_SKYLINE_001',
      validFrom: validFrom,
      validUntil: validUntil,
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
      visitorName: 'Dr. Sanjay Gupta',
      visitorPhone: '+919100000002',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Home physiotherapy sessions',
      qrToken: 'PRE_SKYLINE_002',
      validFrom: validFrom,
      validUntil: validUntil,
      maxUses: 5,
      usedCount: 2,
      status: 'ACTIVE',
      flatId: flats[4].id,
      societyId: society1.id,
      createdById: resident4.id,
    },
  });

  // For race condition testing
  await prisma.preApproval.create({
    data: {
      visitorName: 'Test Visitor',
      visitorPhone: '+919100000099',
      visitorType: 'GUEST',
      purpose: 'Race condition testing - DO NOT DELETE',
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

  console.log(`✅ Created 3 pre-approvals\n`);

  // ============================================
  // 14. CREATE GATE PASSES
  // ============================================
  console.log('🎫 Creating gate passes...');

  const passValidFrom = new Date();
  const passValidUntil = new Date();
  passValidUntil.setDate(passValidUntil.getDate() + 3);

  await prisma.gatePass.create({
    data: {
      type: 'MATERIAL',
      title: 'Furniture Delivery',
      description: 'New sofa set from Urban Ladder',
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
      type: 'MAINTENANCE',
      title: 'AC Repair Service',
      description: 'Annual AC maintenance by BlueS tar',
      qrToken: 'GATE_SKYLINE_002',
      validFrom: passValidFrom,
      validUntil: passValidUntil,
      status: 'APPROVED',
      isUsed: true,
      usedAt: new Date(),
      flatId: flats[4].id,
      societyId: society1.id,
      requestedById: resident4.id,
      approvedById: admin1.id,
      approvedAt: new Date(),
      usedByGuardId: guard1.id,
    },
  });

  // For race condition testing
  await prisma.gatePass.create({
    data: {
      type: 'VEHICLE',
      title: 'Vehicle Entry Pass',
      description: 'Race condition testing - DO NOT DELETE',
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

  console.log(`✅ Created 3 gate passes\n`);

  // ============================================
  // 15. CREATE DELIVERY AUTO-APPROVE RULES
  // ============================================
  console.log('📦 Creating delivery auto-approve rules...');

  await prisma.deliveryAutoApproveRule.create({
    data: {
      flatId: flats[0].id,
      providerTag: 'SWIGGY',
      isActive: true,
      timeFrom: '08:00',
      timeUntil: '23:00',
      createdById: resident1.id,
    },
  });

  await prisma.deliveryAutoApproveRule.create({
    data: {
      flatId: flats[0].id,
      providerTag: 'AMAZON',
      isActive: true,
      createdById: resident1.id,
    },
  });

  await prisma.deliveryAutoApproveRule.create({
    data: {
      flatId: flats[4].id,
      providerTag: 'ZOMATO',
      isActive: true,
      timeFrom: '09:00',
      timeUntil: '22:00',
      createdById: resident4.id,
    },
  });

  console.log(`✅ Created 3 auto-approve rules\n`);

  // ============================================
  // 16. CREATE EXPECTED DELIVERIES
  // ============================================
  console.log('📦 Creating expected deliveries...');

  const deliveryDate = new Date();
  deliveryDate.setHours(deliveryDate.getHours() + 2);

  await prisma.expectedDelivery.create({
    data: {
      flatId: flats[0].id,
      providerTag: 'AMAZON',
      trackingNumber: 'AMZ-2026-123456',
      description: 'Books and electronics',
      expectedDate: deliveryDate,
      autoApprove: true,
      isUsed: false,
      createdById: resident1.id,
    },
  });

  await prisma.expectedDelivery.create({
    data: {
      flatId: flats[40].id,
      providerTag: 'FLIPKART',
      trackingNumber: 'FK-2026-789012',
      description: 'Mobile phone',
      expectedDate: deliveryDate,
      autoApprove: true,
      isUsed: false,
      createdById: resident5.id,
    },
  });

  console.log(`✅ Created 2 expected deliveries\n`);

  // ============================================
  // 17. CREATE ENTRIES
  // ============================================
  console.log('🚪 Creating entry records...');

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // Visitor entry - checked out
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Deepak Joshi',
      visitorPhone: '+919200000001',
      visitorType: 'FRIEND',
      purpose: 'Personal visit',
      checkInTime: twoDaysAgo,
      checkOutTime: new Date(twoDaysAgo.getTime() + 3 * 60 * 60 * 1000), // 3 hours later
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: false,
      approvedById: resident1.id,
      approvedAt: twoDaysAgo,
    },
  });

  // Delivery entry - checked in
  await prisma.entry.create({
    data: {
      type: 'DELIVERY',
      status: 'CHECKED_IN',
      visitorName: 'Swiggy Delivery Executive',
      visitorPhone: '+919200000002',
      purpose: 'Food delivery',
      checkInTime: new Date(),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Auto-approved by delivery rule',
    },
  });

  // Service provider entry
  await prisma.entry.create({
    data: {
      type: 'SERVICE_PROVIDER',
      status: 'CHECKED_OUT',
      visitorName: 'AC Technician - BlueStar',
      visitorPhone: '+919200000003',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'AC servicing',
      checkInTime: oneDayAgo,
      checkOutTime: new Date(oneDayAgo.getTime() + 2 * 60 * 60 * 1000),
      flatId: flats[4].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: false,
      approvedById: resident4.id,
      approvedAt: oneDayAgo,
    },
  });

  // Entry for Society 2
  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_IN',
      visitorName: 'Rajesh Malhotra',
      visitorPhone: '+919200000004',
      visitorType: 'GUEST',
      purpose: 'Business meeting',
      checkInTime: new Date(),
      flatId: flats2[0].id,
      societyId: society2.id,
      createdById: guard4.id,
      wasAutoApproved: false,
      approvedById: resident9.id,
      approvedAt: new Date(),
    },
  });

  // Domestic staff entry
  await prisma.entry.create({
    data: {
      type: 'DOMESTIC_STAFF',
      status: 'CHECKED_OUT',
      visitorName: 'Lakshmi Devi',
      visitorPhone: '+919000000001',
      purpose: 'Daily cleaning work',
      checkInTime: new Date(today.setHours(8, 5, 0, 0)),
      checkOutTime: new Date(today.setHours(10, 2, 0, 0)),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Verified domestic staff',
      domesticStaffId: maid1.id,
    },
  });

  console.log(`✅ Created 5 entry records\n`);

  // ============================================
  // 18. CREATE ENTRY REQUESTS
  // ============================================
  console.log('📸 Creating entry requests...');

  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 15);

  await prisma.entryRequest.create({
    data: {
      type: 'DELIVERY',
      status: 'PENDING',
      providerTag: 'ZOMATO',
      visitorName: 'Zomato Delivery Partner',
      visitorPhone: '+919300000001',
      expiresAt: expiryTime,
      flatId: flats[4].id,
      societyId: society1.id,
      guardId: guard1.id,
    },
  });

  const expiryTime2 = new Date();
  expiryTime2.setMinutes(expiryTime2.getMinutes() + 10);

  await prisma.entryRequest.create({
    data: {
      type: 'DELIVERY',
      status: 'PENDING',
      providerTag: 'AMAZON',
      visitorName: 'Amazon Delivery Associate',
      visitorPhone: '+919300000002',
      expiresAt: expiryTime2,
      flatId: flats[40].id,
      societyId: society1.id,
      guardId: guard1.id,
    },
  });

  console.log(`✅ Created 2 entry requests\n`);

  // ============================================
  // 19. CREATE NOTICES
  // ============================================
  console.log('📢 Creating notices...');

  await prisma.notice.create({
    data: {
      title: 'Monthly Maintenance Payment Reminder',
      description: 'Dear residents, monthly maintenance fees for February 2026 are due by 5th Feb. Please pay via the app or bank transfer to avoid late fees of ₹200.',
      type: 'ANNOUNCEMENT',
      priority: 'HIGH',
      isActive: true,
      isPinned: true,
      publishAt: new Date(),
      expiresAt: new Date('2026-02-05'),
      societyId: society1.id,
      createdById: admin1.id,
      targetAudience: 'ALL_RESIDENTS',
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Water Supply Disruption - 25th January',
      description: 'Due to water tank cleaning, water supply will be interrupted on 25th January from 10 AM to 2 PM. Please store water in advance.',
      type: 'MAINTENANCE',
      priority: 'HIGH',
      isActive: true,
      isPinned: false,
      publishAt: new Date(),
      expiresAt: new Date('2026-01-26'),
      societyId: society1.id,
      createdById: admin1.id,
      targetAudience: 'ALL_RESIDENTS',
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Republic Day Celebration - 26th January',
      description: 'Join us for Republic Day flag hoisting at 8 AM in the main lawn. Cultural programs and refreshments will follow. All residents are invited!',
      type: 'EVENT',
      priority: 'MEDIUM',
      isActive: true,
      isPinned: true,
      publishAt: new Date(),
      expiresAt: new Date('2026-01-27'),
      societyId: society1.id,
      createdById: admin1.id,
      targetAudience: 'ALL_RESIDENTS',
      attachments: ['https://example.com/republic-day-poster.jpg'],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Parking Rules Reminder',
      description: 'Please ensure vehicles are parked only in designated spots. Violators will be fined ₹500 per incident. Visitor parking is strictly for guests only.',
      type: 'RULE',
      priority: 'MEDIUM',
      isActive: true,
      isPinned: false,
      publishAt: new Date(),
      societyId: society1.id,
      createdById: admin1.id,
      targetAudience: 'ALL_RESIDENTS',
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Gym Equipment Upgrade',
      description: 'We are pleased to announce the installation of new treadmills and cross trainers in our gym. Enjoy the upgraded facilities from 1st February!',
      type: 'ANNOUNCEMENT',
      priority: 'LOW',
      isActive: true,
      isPinned: false,
      publishAt: new Date(),
      societyId: society2.id,
      createdById: admin2.id,
      targetAudience: 'ALL_RESIDENTS',
    },
  });

  console.log(`✅ Created 5 notices\n`);

  // ============================================
  // 20. CREATE COMPLAINTS
  // ============================================
  console.log('📝 Creating complaints...');

  await prisma.complaint.create({
    data: {
      title: 'Broken Elevator in Block A',
      description: 'The elevator in Block A has been malfunctioning for the past 3 days. It gets stuck between floors. This is causing major inconvenience, especially for elderly residents and those with kids.',
      category: 'MAINTENANCE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      flatId: flats[0].id,
      societyId: society1.id,
      reportedById: resident1.id,
      adminResponse: 'We have contacted the elevator maintenance company. Technician will visit tomorrow morning.',
      respondedById: admin1.id,
      respondedAt: new Date(),
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Water Leakage in Common Area',
      description: 'There is continuous water leakage near the main gate area causing slippery floors. Safety hazard!',
      category: 'WATER',
      priority: 'HIGH',
      status: 'RESOLVED',
      flatId: flats[4].id,
      societyId: society1.id,
      reportedById: resident4.id,
      adminResponse: 'Plumber has fixed the leakage. Issue resolved.',
      respondedById: admin1.id,
      respondedAt: oneDayAgo,
      resolvedAt: new Date(),
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Loud Music from A-502',
      description: 'Flat A-502 plays loud music every night till 1 AM. Multiple residents have complained but no action taken.',
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
      title: 'Unauthorized Vehicle Parking',
      description: 'Unknown vehicles are regularly parked in visitor parking for days. Actual visitors have no space to park.',
      category: 'PARKING',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      flatId: flats[80].id,
      societyId: society1.id,
      reportedById: resident7.id,
      adminResponse: 'Security team is noting down vehicle numbers. Notices will be sent to violators.',
      respondedById: admin1.id,
      respondedAt: new Date(),
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Cleanliness Issue in Tower X',
      description: 'Garbage bins on 5th floor are not being cleared regularly. Bad smell in the corridor.',
      category: 'CLEANLINESS',
      priority: 'HIGH',
      status: 'OPEN',
      flatId: flats2[0].id,
      societyId: society2.id,
      reportedById: resident9.id,
    },
  });

  console.log(`✅ Created 5 complaints\n`);

  // ============================================
  // 21. CREATE EMERGENCY ALERTS
  // ============================================
  console.log('🚨 Creating emergency alerts...');

  await prisma.emergency.create({
    data: {
      type: 'FIRE',
      description: 'Small fire in kitchen due to gas stove malfunction. Quickly controlled with fire extinguisher. No major damage.',
      status: 'RESOLVED',
      resolvedAt: twoDaysAgo,
      flatId: flats[0].id,
      societyId: society1.id,
      reportedById: resident1.id,
      actionTaken: 'Fire extinguished immediately. Fire department called as precaution. Flat checked and declared safe.',
    },
  });

  await prisma.emergency.create({
    data: {
      type: 'MEDICAL',
      description: 'Elderly resident fell in bathroom. Ambulance called.',
      status: 'RESOLVED',
      resolvedAt: oneDayAgo,
      flatId: flats[4].id,
      societyId: society1.id,
      reportedById: resident4.id,
      actionTaken: 'Ambulance arrived within 10 minutes. Patient taken to hospital. Minor injury, stable condition.',
    },
  });

  console.log(`✅ Created 2 emergency alerts\n`);

  // ============================================
  // 22. CREATE VENDORS
  // ============================================
  console.log('🏪 Creating vendors...');

  await prisma.vendor.create({
    data: {
      name: 'Big Basket',
      category: 'GROCERY',
      contactPerson: 'Vendor Manager',
      phone: '+918012340001',
      email: 'vendor@bigbasket.com',
      description: 'Online grocery delivery service',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'Urban Clap',
      category: 'SERVICE',
      contactPerson: 'Service Manager',
      phone: '+918012340002',
      email: 'support@urbanclap.com',
      description: 'Home services - plumbing, electrician, cleaning',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'Dominos Pizza',
      category: 'FOOD',
      contactPerson: 'Store Manager',
      phone: '+918012340003',
      email: 'koramangala@dominos.com',
      description: 'Pizza delivery',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  console.log(`✅ Created 3 vendors\n`);

  // ============================================
  // 23. CREATE PAYMENT REMINDERS
  // ============================================
  console.log('💰 Creating payment reminders...');

  await prisma.paymentReminder.create({
    data: {
      flatId: flats[40].id,
      amount: 2500,
      dueDate: new Date('2026-02-05'),
      description: 'Monthly maintenance fee for February 2026',
      status: 'PENDING',
      reminderCount: 1,
      lastReminderAt: new Date(),
    },
  });

  await prisma.paymentReminder.create({
    data: {
      flatId: flats[80].id,
      amount: 2500,
      dueDate: new Date('2026-02-05'),
      description: 'Monthly maintenance fee for February 2026',
      status: 'PENDING',
      reminderCount: 0,
    },
  });

  console.log(`✅ Created 2 payment reminders\n`);

  // ============================================
  // 24. CREATE NOTIFICATIONS
  // ============================================
  console.log('🔔 Creating notifications...');

  await prisma.notification.create({
    data: {
      type: 'SYSTEM',
      title: 'Welcome to Skyline Residency',
      message: 'Your account has been activated. Complete your profile to get started with all features.',
      userId: resident1.id,
      societyId: society1.id,
      isRead: true,
      readAt: new Date('2024-01-15'),
    },
  });

  await prisma.notification.create({
    data: {
      type: 'ENTRY_REQUEST',
      title: 'Delivery Waiting at Gate',
      message: 'A Zomato delivery person is waiting at the main gate for approval',
      userId: resident4.id,
      societyId: society1.id,
      isRead: false,
      referenceType: 'EntryRequest',
      referenceId: 'entry-request-id',
    },
  });

  await prisma.notification.create({
    data: {
      type: 'ONBOARDING_STATUS',
      title: 'Birthday Party Booking Approved',
      message: 'Your community hall booking for 23rd January has been approved by the admin',
      userId: resident1.id,
      societyId: society1.id,
      isRead: true,
      readAt: new Date(),
      referenceType: 'AmenityBooking',
    },
  });

  await prisma.notification.create({
    data: {
      type: 'DELIVERY_REQUEST',
      title: 'Expected Delivery Alert',
      message: 'Your Amazon package is expected to arrive today between 2-4 PM',
      userId: resident1.id,
      societyId: society1.id,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      type: 'EMERGENCY_ALERT',
      title: 'Fire Incident Reported',
      message: 'A minor fire incident was reported in A-101. Situation is under control.',
      userId: admin1.id,
      societyId: society1.id,
      isRead: true,
      readAt: twoDaysAgo,
    },
  });

  console.log(`✅ Created 5 notifications\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Realistic seed completed successfully!\n');
  console.log('=====================================');
  console.log('SUMMARY:');
  console.log('=====================================');
  console.log(`✅ Societies: 2`);
  console.log(`✅ Gate Points: 3`);
  console.log(`✅ Blocks: 5`);
  console.log(`✅ Flats: ${flats.length + flats2.length}`);
  console.log(`✅ Users: 20+ (admins, guards, residents with families)`);
  console.log(`✅ Vehicles: 5`);
  console.log(`✅ Amenities: 6`);
  console.log(`✅ Amenity Bookings: 3`);
  console.log(`✅ Domestic Staff: 4`);
  console.log(`✅ Staff Assignments: 4`);
  console.log(`✅ Staff Attendance: 2`);
  console.log(`✅ Staff Reviews: 3`);
  console.log(`✅ Pre-approvals: 3 (including race test)`);
  console.log(`✅ Gate Passes: 3 (including race test)`);
  console.log(`✅ Auto-approve Rules: 3`);
  console.log(`✅ Expected Deliveries: 2`);
  console.log(`✅ Entry Records: 5`);
  console.log(`✅ Entry Requests: 2 (pending)`);
  console.log(`✅ Notices: 5`);
  console.log(`✅ Complaints: 5 (various statuses)`);
  console.log(`✅ Emergency Alerts: 2`);
  console.log(`✅ Vendors: 3`);
  console.log(`✅ Payment Reminders: 2`);
  console.log(`✅ Notifications: 5`);
  console.log('=====================================\n');
  console.log('💡 This seed includes:');
  console.log('   - Complete family structures with relationships');
  console.log('   - Real-world scenarios (deliveries, visitors, staff)');
  console.log('   - Multiple entry types and statuses');
  console.log('   - Active complaints and notices');
  console.log('   - Staff with assignments and reviews');
  console.log('   - Auto-approve rules and expected deliveries');
  console.log('   - Emergency alerts with resolutions');
  console.log('   - Payment tracking');
  console.log('   - Comprehensive notifications');
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
