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
      name: 'Emerald Heights Residency',
      address: 'Survey No. 45/2, Outer Ring Road, Marathahalli, Bangalore',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560037',
      contactName: 'Dr. Rajesh Kumar Mehta',
      contactPhone: '+919876543210',
      contactEmail: 'secretary@emeraldheights.in',
      totalFlats: 144,
      monthlyFee: 3500,
      nextDueDate: daysFromNow(12),
      paymentStatus: 'PAID',
    },
  });

  const society2 = await prisma.society.create({
    data: {
      name: 'Orchid Gardens',
      address: 'Plot 126, Sector 18, Kharghar, Navi Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '410210',
      contactName: 'Mrs. Priya Deshmukh',
      contactPhone: '+912227543299',
      contactEmail: 'admin@orchidgardens.com',
      totalFlats: 96,
      monthlyFee: 4200,
      nextDueDate: daysFromNow(8),
      paymentStatus: 'PAID',
    },
  });
  console.log('✅ 2 societies\n');

  // GATE POINTS
  console.log('🚪 Creating gate points...');
  const mainGate1 = await prisma.gatePoint.create({
    data: { name: 'East Gate (Main)', isActive: true, societyId: society1.id },
  });
  await prisma.gatePoint.create({
    data: { name: 'West Gate (Service)', isActive: true, societyId: society1.id },
  });
  await prisma.gatePoint.create({
    data: { name: 'Tower Entrance', isActive: true, societyId: society2.id },
  });
  await prisma.gatePoint.create({
    data: { name: 'Parking Gate', isActive: true, societyId: society2.id },
  });
  console.log('✅ 4 gate points\n');

  // BLOCKS
  console.log('🏗️ Creating blocks...');
  const blockA = await prisma.block.create({
    data: {
      name: 'Tower A (Emerald)',
      societyId: society1.id,
      totalFloors: 12,
      description: 'East facing tower with 2BHK & 3BHK units',
    },
  });

  const blockB = await prisma.block.create({
    data: {
      name: 'Tower B (Jade)',
      societyId: society1.id,
      totalFloors: 12,
      description: 'West facing premium 3BHK & 4BHK penthouses',
    },
  });

  const blockC = await prisma.block.create({
    data: {
      name: 'Tower C (Ruby)',
      societyId: society1.id,
      totalFloors: 10,
      description: 'North facing compact 2BHK units',
    },
  });

  const towerX = await prisma.block.create({
    data: {
      name: 'Orchid Wing',
      societyId: society2.id,
      totalFloors: 16,
      description: 'Premium high-rise with sea view',
    },
  });
  console.log('✅ 4 blocks\n');

  // FLATS
  console.log('🏠 Creating flats...');
  const flats: any[] = [];
  // Tower A - 48 flats (12 floors x 4 units)
  for (let floor = 1; floor <= 12; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `A${floor.toString().padStart(2, '0')}0${flatNum}`,
          floor: `${floor}`,
          blockId: blockA.id,
          societyId: society1.id,
          isOccupied: floor <= 10,
        },
      });
      flats.push(flat);
    }
  }

  // Tower B - 48 flats (12 floors x 4 units)
  for (let floor = 1; floor <= 12; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `B${floor.toString().padStart(2, '0')}0${flatNum}`,
          floor: `${floor}`,
          blockId: blockB.id,
          societyId: society1.id,
          isOccupied: floor <= 9,
        },
      });
      flats.push(flat);
    }
  }

  // Tower C - 40 flats (10 floors x 4 units)
  for (let floor = 1; floor <= 10; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `C${floor.toString().padStart(2, '0')}0${flatNum}`,
          floor: `${floor}`,
          blockId: blockC.id,
          societyId: society1.id,
          isOccupied: floor <= 8,
        },
      });
      flats.push(flat);
    }
  }

  const flats2: any[] = [];
  // Orchid Wing - 64 flats (16 floors x 4 units)
  for (let floor = 1; floor <= 16; floor++) {
    for (let flatNum = 1; flatNum <= 4; flatNum++) {
      const flat = await prisma.flat.create({
        data: {
          flatNumber: `O${floor.toString().padStart(2, '0')}0${flatNum}`,
          floor: `${floor}`,
          blockId: towerX.id,
          societyId: society2.id,
          isOccupied: floor <= 13,
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
      name: 'Arvind Krishnan',
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
      name: 'Dr. Rajesh Kumar Mehta',
      phone: '+919876543210',
      email: 'secretary@emeraldheights.in',
      password: hashedPassword,
      role: 'ADMIN',
      societyId: society1.id,
      isActive: true,
    },
  });

  // Society 1 - Guards
  const guard1 = await prisma.user.create({
    data: {
      name: 'Ramesh Bahadur Singh',
      phone: '+919123456780',
      email: 'ramesh.security@emeraldheights.in',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society1.id,
      isActive: true,
    },
  });

  const guard2 = await prisma.user.create({
    data: {
      name: 'Suresh Prasad Yadav',
      phone: '+919123456781',
      email: 'suresh.security@emeraldheights.in',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society1.id,
      isActive: true,
    },
  });

  const guard3 = await prisma.user.create({
    data: {
      name: 'Mahesh Kumar Pandey',
      phone: '+919123456782',
      email: 'mahesh.security@emeraldheights.in',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society1.id,
      isActive: true,
    },
  });

  // Society 1 - Residents (Family 1 - A0101 - Tech Entrepreneur Family)
  const resident1 = await prisma.user.create({
    data: {
      name: 'Amit Verma',
      phone: '+919845123456',
      email: 'amit.verma@techcorp.com',
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
      phone: '+919845123457',
      email: 'priya.verma@designer.com',
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
      phone: '+919845123458',
      email: 'aarav.verma@student.edu',
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

  // Family 2 (A0501 - Doctor - Single Parent)
  const resident4 = await prisma.user.create({
    data: {
      name: 'Dr. Sneha Reddy',
      phone: '+919845234567',
      email: 'sneha.reddy@hospital.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[16].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident4Child = await prisma.user.create({
    data: {
      name: 'Aisha Reddy',
      phone: '+919845234568',
      email: 'aisha.reddy@student.edu',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[16].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident4.id,
      familyRole: 'CHILD',
      isActive: true,
    },
  });

  // Family 3 (B0101 - Investment Banker Family - Tenant)
  const resident5 = await prisma.user.create({
    data: {
      name: 'Vikram Singh Chauhan',
      phone: '+919845345678',
      email: 'vikram.singh@investment.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[48].id,
      isOwner: false,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident6 = await prisma.user.create({
    data: {
      name: 'Ananya Singh Chauhan',
      phone: '+919845345679',
      email: 'ananya.singh@architect.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[48].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident5.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  const resident6Child1 = await prisma.user.create({
    data: {
      name: 'Arjun Singh',
      phone: '+919845345680',
      email: 'arjun.singh@school.edu',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[48].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident5.id,
      familyRole: 'CHILD',
      isActive: true,
    },
  });

  const resident6Child2 = await prisma.user.create({
    data: {
      name: 'Kiara Singh',
      phone: '+919845345681',
      email: 'kiara.singh@school.edu',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[48].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident5.id,
      familyRole: 'CHILD',
      isActive: true,
    },
  });

  // Family 4 (C0101 - Retired Couple)
  const resident7 = await prisma.user.create({
    data: {
      name: 'Rahul Kapoor',
      phone: '+919845456789',
      email: 'rahul.kapoor@retired.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[96].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident7Spouse = await prisma.user.create({
    data: {
      name: 'Meera Kapoor',
      phone: '+919845456790',
      email: 'meera.kapoor@retired.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[96].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident7.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  // Family 5 (B0702 - Working Professional - Live alone)
  const resident8 = await prisma.user.create({
    data: {
      name: 'Anita Desai',
      phone: '+919845567890',
      email: 'anita.desai@marketing.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[72].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  // Family 6 (A0801 - Software Engineer Family with Parents)
  const resident9IT = await prisma.user.create({
    data: {
      name: 'Karthik Nair',
      phone: '+919845678901',
      email: 'karthik.nair@techgiant.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[28].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident9Spouse = await prisma.user.create({
    data: {
      name: 'Divya Nair',
      phone: '+919845678902',
      email: 'divya.nair@teacher.edu',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[28].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident9IT.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  const resident9Parent = await prisma.user.create({
    data: {
      name: 'Ramesh Nair',
      phone: '+919845678903',
      email: 'ramesh.nair@retired.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society1.id,
      flatId: flats[28].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident9IT.id,
      familyRole: 'PARENT',
      isActive: true,
    },
  });

  // Society 2 Users
  const admin2 = await prisma.user.create({
    data: {
      name: 'Mrs. Priya Deshmukh',
      phone: '+912227543299',
      email: 'admin@orchidgardens.com',
      password: hashedPassword,
      role: 'ADMIN',
      societyId: society2.id,
      isActive: true,
    },
  });

  const guard4 = await prisma.user.create({
    data: {
      name: 'Mohan Das Gupta',
      phone: '+912227123456',
      email: 'mohan.security@orchidgardens.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society2.id,
      isActive: true,
    },
  });

  const guard5 = await prisma.user.create({
    data: {
      name: 'Shankar Patil',
      phone: '+912227123457',
      email: 'shankar.security@orchidgardens.com',
      password: hashedPassword,
      role: 'GUARD',
      societyId: society2.id,
      isActive: true,
    },
  });

  // Society 2 - Family 1 (O0101 - Business Owner)
  const resident10 = await prisma.user.create({
    data: {
      name: 'Kiran Patel',
      phone: '+912227345678',
      email: 'kiran.patel@manufacturing.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[0].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident10Spouse = await prisma.user.create({
    data: {
      name: 'Kavita Patel',
      phone: '+912227345679',
      email: 'kavita.patel@boutique.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[0].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident10.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  // Society 2 - Family 2 (O0401 - Lawyer Family)
  const resident11 = await prisma.user.create({
    data: {
      name: 'Adv. Maya Iyer',
      phone: '+912227456789',
      email: 'maya.iyer@lawfirm.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[12].id,
      isOwner: true,
      isPrimaryResident: true,
      isActive: true,
    },
  });

  const resident11Spouse = await prisma.user.create({
    data: {
      name: 'Suresh Iyer',
      phone: '+912227456790',
      email: 'suresh.iyer@consultant.com',
      password: hashedPassword,
      role: 'RESIDENT',
      societyId: society2.id,
      flatId: flats2[12].id,
      isOwner: false,
      isPrimaryResident: false,
      primaryResidentId: resident11.id,
      familyRole: 'SPOUSE',
      isActive: true,
    },
  });

  console.log('✅ 20 users created\n');

  // VEHICLES
  console.log('🚗 Creating vehicles...');
  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA01MJ9876',
      vehicleType: 'Car',
      model: 'Honda City VX Diesel',
      color: 'Platinum Silver',
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
      model: 'Royal Enfield Classic 350',
      color: 'Stealth Black',
      isActive: true,
      userId: resident3.id,
      flatId: flats[0].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA51EB7890',
      vehicleType: 'Car',
      model: 'Maruti Swift VDi',
      color: 'Pearl Arctic White',
      isActive: true,
      userId: resident2.id,
      flatId: flats[0].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA05CD1234',
      vehicleType: 'Car',
      model: 'Toyota Fortuner 4x4',
      color: 'Super White',
      isActive: true,
      userId: resident4.id,
      flatId: flats[16].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA20MN5678',
      vehicleType: 'Car',
      model: 'BMW X5 xDrive',
      color: 'Phytonic Blue',
      isActive: true,
      userId: resident5.id,
      flatId: flats[48].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA03PQ8901',
      vehicleType: 'Bike',
      model: 'Honda Activa 6G',
      color: 'Matte Black',
      isActive: true,
      userId: resident6.id,
      flatId: flats[48].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'KA09RS2345',
      vehicleType: 'Car',
      model: 'Hyundai Creta SX',
      color: 'Polar White',
      isActive: true,
      userId: resident8.id,
      flatId: flats[72].id,
      societyId: society1.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH04AB1234',
      vehicleType: 'Car',
      model: 'Mercedes-Benz E-Class',
      color: 'Obsidian Black',
      isActive: true,
      userId: resident10.id,
      flatId: flats2[0].id,
      societyId: society2.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH04CD5678',
      vehicleType: 'Car',
      model: 'Audi Q7 Premium Plus',
      color: 'Glacier White',
      isActive: true,
      userId: resident11.id,
      flatId: flats2[12].id,
      societyId: society2.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      vehicleNumber: 'MH04EF9012',
      vehicleType: 'Bike',
      model: 'Vespa SXL 150',
      color: 'Matte Red',
      isActive: true,
      userId: resident11.id,
      flatId: flats2[12].id,
      societyId: society2.id,
    },
  });

  console.log('✅ 10 vehicles\n');

  // AMENITIES
  console.log('🏊 Creating amenities...');
  const gym1 = await prisma.amenity.create({
    data: {
      name: 'Emerald Fitness Studio',
      type: 'GYM',
      description: 'State-of-the-art gym with treadmills, ellipticals, weights, and cross-trainers. Personal trainer available on request.',
      capacity: 30,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society1.id,
    },
  });

  const pool1 = await prisma.amenity.create({
    data: {
      name: 'Aqua Paradise Pool',
      type: 'SWIMMING_POOL',
      description: 'Semi-Olympic size swimming pool (25m x 12m) with separate kids pool. Lifeguard on duty 6 AM - 9 PM.',
      capacity: 45,
      pricePerHour: 300,
      maxBookingsPerUser: 4,
      isActive: true,
      societyId: society1.id,
    },
  });

  const clubhouse1 = await prisma.amenity.create({
    data: {
      name: 'Grand Banquet Hall',
      type: 'CLUBHOUSE',
      description: 'Premium air-conditioned banquet hall with stage, sound system, and catering facility. Perfect for weddings, birthdays, and corporate events.',
      capacity: 200,
      pricePerHour: 3500,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society1.id,
    },
  });

  await prisma.amenity.create({
    data: {
      name: "Children's Play Garden",
      type: 'GARDEN',
      description: 'Safe outdoor play area with swings, slides, see-saw, and sandpit for kids aged 2-12 years.',
      capacity: 25,
      pricePerHour: 0,
      maxBookingsPerUser: 5,
      isActive: true,
      societyId: society1.id,
    },
  });

  await prisma.amenity.create({
    data: {
      name: 'Multi-Purpose Sports Court',
      type: 'SPORTS_COURT',
      description: 'Badminton, basketball, and tennis court with flood lights for evening play. Equipment available on rent.',
      capacity: 12,
      pricePerHour: 250,
      maxBookingsPerUser: 3,
      isActive: true,
      societyId: society1.id,
    },
  });

  const gym2 = await prisma.amenity.create({
    data: {
      name: 'Orchid Wellness Center',
      type: 'GYM',
      description: 'Premium fitness center with yoga studio, steam room, and modern cardio equipment. Air-conditioned facility.',
      capacity: 25,
      pricePerHour: 0,
      maxBookingsPerUser: 2,
      isActive: true,
      societyId: society2.id,
    },
  });

  await prisma.amenity.create({
    data: {
      name: 'Sky Lounge',
      type: 'PARTY_HALL',
      description: 'Rooftop party hall with panoramic city views, DJ console, and BBQ area. Adults only (18+).',
      capacity: 80,
      pricePerHour: 2500,
      maxBookingsPerUser: 1,
      isActive: true,
      societyId: society2.id,
    },
  });

  console.log('✅ 7 amenities\n');

  // AMENITY BOOKINGS
  console.log('📅 Creating bookings...');
  const tomorrow = daysFromNow(1);
  tomorrow.setHours(18, 0, 0, 0);

  // Confirmed booking - Birthday party
  await prisma.amenityBooking.create({
    data: {
      amenityId: clubhouse1.id,
      userId: resident1.id,
      flatId: flats[0].id,
      societyId: society1.id,
      bookingDate: daysFromNow(5),
      startTime: '18:00',
      endTime: '23:00',
      status: 'CONFIRMED',
      purpose: "My daughter's 10th birthday celebration - expecting 50 guests",
    },
  });

  // Pending approval
  await prisma.amenityBooking.create({
    data: {
      amenityId: pool1.id,
      userId: resident4.id,
      flatId: flats[16].id,
      societyId: society1.id,
      bookingDate: daysFromNow(3),
      startTime: '16:00',
      endTime: '18:00',
      status: 'PENDING',
      purpose: 'Kids swimming lessons and practice session',
    },
  });

  // Confirmed - Sports court
  await prisma.amenityBooking.create({
    data: {
      amenityId: gym1.id,
      userId: resident5.id,
      flatId: flats[48].id,
      societyId: society1.id,
      bookingDate: tomorrow,
      startTime: '06:00',
      endTime: '07:30',
      status: 'CONFIRMED',
      purpose: 'Morning workout session',
    },
  });

  // Past completed booking
  await prisma.amenityBooking.create({
    data: {
      amenityId: clubhouse1.id,
      userId: resident7.id,
      flatId: flats[96].id,
      societyId: society1.id,
      bookingDate: daysAgo(10),
      startTime: '10:00',
      endTime: '14:00',
      status: 'COMPLETED',
      purpose: 'Silver jubilee anniversary celebration',
    },
  });

  // Cancelled booking
  await prisma.amenityBooking.create({
    data: {
      amenityId: pool1.id,
      userId: resident8.id,
      flatId: flats[72].id,
      societyId: society1.id,
      bookingDate: daysFromNow(2),
      startTime: '17:00',
      endTime: '19:00',
      status: 'CANCELLED',
      purpose: 'Pool party with colleagues',
    },
  });

  console.log('✅ 5 bookings\n');

  // DOMESTIC STAFF
  console.log('👨‍🔧 Creating staff...');
  const maid1 = await prisma.domesticStaff.create({
    data: {
      name: 'Lakshmi Devi Sharma',
      phone: '+919845678000',
      staffType: 'MAID',
      qrToken: 'STAFF_MAID_001',
      isVerified: true,
      verifiedAt: daysAgo(180),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.7,
      totalReviews: 23,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  const cook1 = await prisma.domesticStaff.create({
    data: {
      name: 'Ramesh Kumar Yadav',
      phone: '+919845678001',
      staffType: 'COOK',
      qrToken: 'STAFF_COOK_001',
      isVerified: true,
      verifiedAt: daysAgo(365),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.9,
      totalReviews: 18,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  const driver1 = await prisma.domesticStaff.create({
    data: {
      name: 'Shankar Prasad',
      phone: '+919845678002',
      staffType: 'DRIVER',
      qrToken: 'STAFF_DRIVER_001',
      isVerified: true,
      verifiedAt: daysAgo(90),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.5,
      totalReviews: 8,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  const gardener1 = await prisma.domesticStaff.create({
    data: {
      name: 'Gopal Reddy',
      phone: '+919845678003',
      staffType: 'GARDENER',
      qrToken: 'STAFF_GARDENER_001',
      isVerified: true,
      verifiedAt: daysAgo(250),
      verifiedBy: admin1.id,
      isActive: true,
      rating: 4.6,
      totalReviews: 14,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  const maid2 = await prisma.domesticStaff.create({
    data: {
      name: 'Savita Ramesh Patil',
      phone: '+912227890001',
      staffType: 'MAID',
      qrToken: 'STAFF_MAID_002',
      isVerified: true,
      verifiedAt: daysAgo(120),
      verifiedBy: admin2.id,
      isActive: true,
      rating: 4.8,
      totalReviews: 16,
      societyId: society2.id,
      addedById: admin2.id,
    },
  });

  const cook2 = await prisma.domesticStaff.create({
    data: {
      name: 'Mangal Singh Thakur',
      phone: '+912227890002',
      staffType: 'COOK',
      qrToken: 'STAFF_COOK_002',
      isVerified: true,
      verifiedAt: daysAgo(200),
      verifiedBy: admin2.id,
      isActive: true,
      rating: 4.7,
      totalReviews: 12,
      societyId: society2.id,
      addedById: admin2.id,
    },
  });

  console.log('✅ 6 staff members\n');

  // STAFF ASSIGNMENTS
  console.log('🔗 Creating assignments...');
  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: maid1.id,
      flatId: flats[0].id,
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
      flatId: flats[16].id,
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
      flatId: flats[48].id,
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
      flatId: flats[48].id,
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
      flatId: flats[96].id,
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
      domesticStaffId: maid2.id,
      flatId: flats2[0].id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      workStartTime: '09:00',
      workEndTime: '11:00',
      agreedRate: 5000,
      rateType: 'monthly',
    },
  });

  await prisma.staffFlatAssignment.create({
    data: {
      domesticStaffId: cook2.id,
      flatId: flats2[12].id,
      isActive: true,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      workStartTime: '18:00',
      workEndTime: '21:00',
      agreedRate: 10000,
      rateType: 'monthly',
    },
  });

  console.log('✅ 7 assignments\n');

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
      review: 'Lakshmi has been working with us for over 6 months now. She is extremely punctual, thorough in her work, and very trustworthy. Highly recommend her!',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });

  await prisma.staffReview.create({
    data: {
      domesticStaffId: maid1.id,
      reviewerId: resident4.id,
      flatId: flats[16].id,
      rating: 4,
      review: 'Good worker, cleans well. Sometimes arrives 10-15 mins late but otherwise very reliable.',
      workQuality: 5,
      punctuality: 3,
      behavior: 5,
    },
  });

  await prisma.staffReview.create({
    data: {
      domesticStaffId: cook1.id,
      reviewerId: resident5.id,
      flatId: flats[48].id,
      rating: 5,
      review: 'Ramesh is an exceptional cook! Makes authentic North Indian and South Indian dishes. Very hygienic in the kitchen and respects our preferences. Been with us for a year now.',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });

  await prisma.staffReview.create({
    data: {
      domesticStaffId: maid2.id,
      reviewerId: resident10.id,
      flatId: flats2[0].id,
      rating: 5,
      review: 'Savita is wonderful! She takes care of our home like it is her own. Very honest and hardworking.',
      workQuality: 5,
      punctuality: 5,
      behavior: 5,
    },
  });

  await prisma.staffReview.create({
    data: {
      domesticStaffId: cook2.id,
      reviewerId: resident11.id,
      flatId: flats2[12].id,
      rating: 4,
      review: 'Mangal cooks delicious food, especially his biryanis and curries. Would give 5 stars if he was more flexible with menu changes.',
      workQuality: 5,
      punctuality: 5,
      behavior: 3,
    },
  });

  console.log('✅ 5 reviews\n');

  // PRE-APPROVALS
  console.log('✅ Creating pre-approvals...');
  const validFrom = new Date();
  const validUntil = daysFromNow(7);

  await prisma.preApproval.create({
    data: {
      visitorName: 'Rohit Sharma',
      visitorPhone: '+919845901234',
      visitorType: 'FRIEND',
      purpose: 'Regular weekend visits - childhood friend',
      qrToken: 'PRE_EMERALD_001',
      validFrom: daysAgo(3),
      validUntil: daysFromNow(25),
      maxUses: 10,
      usedCount: 3,
      status: 'ACTIVE',
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: resident1.id,
    },
  });

  await prisma.preApproval.create({
    data: {
      visitorName: 'Dr. Anjali Menon',
      visitorPhone: '+919845901235',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Physiotherapy sessions - 3x per week',
      qrToken: 'PRE_EMERALD_002',
      validFrom,
      validUntil: daysFromNow(30),
      maxUses: 15,
      usedCount: 0,
      status: 'ACTIVE',
      flatId: flats[96].id,
      societyId: society1.id,
      createdById: resident7.id,
    },
  });

  await prisma.preApproval.create({
    data: {
      visitorName: 'Ravi Kapoor',
      visitorPhone: '+919845901236',
      visitorType: 'FAMILY_MEMBER',
      purpose: 'Sister visiting from Delhi - staying for 2 weeks',
      qrToken: 'PRE_EMERALD_003',
      validFrom: daysFromNow(2),
      validUntil: daysFromNow(16),
      maxUses: 20,
      usedCount: 0,
      status: 'ACTIVE',
      flatId: flats[72].id,
      societyId: society1.id,
      createdById: resident8.id,
    },
  });

  await prisma.preApproval.create({
    data: {
      visitorName: 'Fitness Trainer Vikram',
      visitorPhone: '+912227901234',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Personal training sessions',
      qrToken: 'PRE_ORCHID_001',
      validFrom: daysAgo(10),
      validUntil: daysFromNow(20),
      maxUses: 12,
      usedCount: 5,
      status: 'ACTIVE',
      flatId: flats2[0].id,
      societyId: society2.id,
      createdById: resident10.id,
    },
  });

  // Expired pre-approval
  await prisma.preApproval.create({
    data: {
      visitorName: 'Mohan Electrician',
      visitorPhone: '+919845901237',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Electrical work - completed',
      qrToken: 'PRE_EMERALD_004',
      validFrom: daysAgo(15),
      validUntil: daysAgo(2),
      maxUses: 5,
      usedCount: 4,
      status: 'EXPIRED',
      flatId: flats[48].id,
      societyId: society1.id,
      createdById: resident5.id,
    },
  });

  console.log('✅ 5 pre-approvals\n');

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
      visitorPhone: '+919845123001',
      visitorType: 'FRIEND',
      purpose: 'Weekend visit - college reunion dinner',
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
      status: 'CHECKED_OUT',
      visitorName: 'Swiggy - Rahul',
      visitorPhone: '+919845123002',
      purpose: 'Food delivery - Biryani Blues order #AB123456',
      checkInTime: hoursAgo(3),
      checkOutTime: hoursAgo(2.9),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Auto-approved by delivery rule (8 AM - 11 PM)',
    },
  });

  await prisma.entry.create({
    data: {
      type: 'DOMESTIC_STAFF',
      status: 'CHECKED_OUT',
      visitorName: 'Lakshmi Devi Sharma',
      visitorPhone: '+919845678000',
      purpose: 'Regular cleaning work',
      checkInTime: hoursAgo(4),
      checkOutTime: hoursAgo(2),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Verified domestic staff - QR scanned',
      domesticStaffId: maid1.id,
    },
  });

  await prisma.entry.create({
    data: {
      type: 'DOMESTIC_STAFF',
      status: 'CHECKED_IN',
      visitorName: 'Ramesh Kumar Yadav',
      visitorPhone: '+919845678001',
      purpose: 'Evening cooking',
      checkInTime: hoursAgo(1.5),
      flatId: flats[48].id,
      societyId: society1.id,
      createdById: guard2.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Verified domestic staff - QR scanned',
      domesticStaffId: cook1.id,
    },
  });

  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Amazon Delivery - Suresh',
      visitorPhone: '+919845123003',
      purpose: 'Package delivery - AWB 1234567890',
      checkInTime: hoursAgo(26),
      checkOutTime: hoursAgo(25.9),
      flatId: flats[16].id,
      societyId: society1.id,
      createdById: guard3.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Expected delivery - auto-approved',
    },
  });

  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Kumar Plumbing - Technician',
      visitorPhone: '+919845234001',
      visitorType: 'SERVICE_PROVIDER',
      purpose: 'Bathroom tap repair',
      checkInTime: hoursAgo(28),
      checkOutTime: hoursAgo(26.5),
      flatId: flats[96].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: false,
      approvedById: resident7.id,
      approvedAt: hoursAgo(28),
    },
  });

  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_IN',
      visitorName: 'Rohit Sharma',
      visitorPhone: '+919845901234',
      visitorType: 'FRIEND',
      purpose: 'Weekend visit',
      checkInTime: hoursAgo(2),
      flatId: flats[0].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Pre-approved visitor - valid QR code',
    },
  });

  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_OUT',
      visitorName: 'Zomato - Vijay',
      visitorPhone: '+919845123004',
      purpose: 'Food delivery - Order #789456',
      checkInTime: daysAgo(1),
      checkOutTime: hoursAgo(23.9),
      flatId: flats[48].id,
      societyId: society1.id,
      createdById: guard2.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Auto-approved by delivery rule',
    },
  });

  await prisma.entry.create({
    data: {
      type: 'VISITOR',
      status: 'CHECKED_IN',
      visitorName: 'Adv. Pradeep Menon',
      visitorPhone: '+912227123001',
      visitorType: 'GUEST',
      purpose: 'Legal consultation meeting',
      checkInTime: hoursAgo(0.5),
      flatId: flats2[12].id,
      societyId: society2.id,
      createdById: guard4.id,
      wasAutoApproved: false,
      approvedById: resident11.id,
      approvedAt: hoursAgo(0.5),
    },
  });

  await prisma.entry.create({
    data: {
      type: 'CAB',
      status: 'CHECKED_OUT',
      visitorName: 'Uber Driver - Ravi',
      visitorPhone: '+919845123005',
      vehicleNumber: 'KA01XY9999',
      purpose: 'Uber pickup',
      checkInTime: hoursAgo(25),
      checkOutTime: hoursAgo(24.9),
      flatId: flats[72].id,
      societyId: society1.id,
      createdById: guard1.id,
      wasAutoApproved: true,
      autoApprovalReason: 'Cab service - auto-approved',
    },
  });

  console.log('✅ 10 entries\n');

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
      title: 'Maintenance Fees Due - February 2026',
      description: `Dear Residents,

This is a reminder that monthly maintenance fees for February 2026 are due by 5th February 2026.

Amount: ₹3,500 per flat
Payment Options:
- Online: UPI ID - emeraldheights@sbi
- Bank Transfer: Account No. 12345678901, IFSC: SBIN0001234
- Cheque: Payable to "Emerald Heights RWA"

Please ensure timely payment to avoid late fee charges (₹100 after 10th Feb).

For queries, contact the accounts committee.

Regards,
Management Committee`,
      type: 'GENERAL',
      priority: 'HIGH',
      isActive: true,
      isPinned: true,
      isUrgent: true,
      publishAt: daysAgo(2),
      expiresAt: daysFromNow(8),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'URGENT: Water Supply Disruption - 25th January',
      description: `Dear Residents,

Due to scheduled maintenance work by BWSSB (Bangalore Water Supply and Sewerage Board), water supply will be disrupted on:

Date: 25th January 2026 (Saturday)
Time: 10:00 AM to 2:00 PM
Affected Areas: All towers

Please store adequate water in advance. Tanker service will be available on call for emergencies.

Emergency Contact: +91 9845123000

We apologize for the inconvenience.

Regards,
Maintenance Team`,
      type: 'MAINTENANCE',
      priority: 'HIGH',
      isActive: true,
      isPinned: true,
      isUrgent: true,
      publishAt: daysAgo(1),
      expiresAt: daysFromNow(2),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Republic Day Celebration - 26th January 2026',
      description: `Dear Residents,

Join us for the Republic Day celebration at Emerald Heights!

Schedule:
🇮🇳 8:00 AM - Flag Hoisting Ceremony at Main Lawn
🎤 8:15 AM - National Anthem
🏆 8:30 AM - Cultural Program by Kids
☕ 9:00 AM - Refreshments

All residents are cordially invited. Let's celebrate together!

Cultural Committee
Emerald Heights`,
      type: 'EVENT',
      priority: 'MEDIUM',
      isActive: true,
      isPinned: true,
      publishAt: daysAgo(5),
      expiresAt: daysFromNow(3),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'New Parking Rules - Effective 1st February',
      description: `Dear Residents,

New parking regulations will be enforced from 1st February 2026:

1. All vehicles MUST display parking stickers
2. Visitor parking limited to 2 hours
3. No parking in fire lane (Towing will be enforced)
4. Two-wheeler parking only in designated zones
5. Guest vehicles must register at gate

Parking stickers available at admin office. Cost: ₹200 per vehicle.

Please cooperate to ensure smooth parking management.

Security Committee`,
      type: 'GENERAL',
      priority: 'MEDIUM',
      isActive: true,
      publishAt: daysAgo(7),
      expiresAt: daysFromNow(30),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Fitness Center Upgrade Complete!',
      description: `Dear Members,

We're excited to announce that our fitness center renovation is complete!

New Equipment Added:
✓ 3 Commercial-grade Treadmills
✓ 2 Elliptical Trainers
✓ Rowing Machine
✓ Additional Free Weights
✓ New Yoga Mats

Hours: 5:30 AM - 10:00 PM (Daily)

Certified trainer available Mon-Sat, 6-8 AM and 6-8 PM.

Stay Fit, Stay Healthy!
Amenities Committee`,
      type: 'GENERAL',
      priority: 'LOW',
      isActive: true,
      publishAt: daysAgo(3),
      societyId: society2.id,
      createdById: admin2.id,
      images: [],
      documents: [],
    },
  });

  await prisma.notice.create({
    data: {
      title: 'Pest Control Schedule - February',
      description: `Quarterly pest control treatment scheduled for:

Tower A: 1st February - 9 AM to 12 PM
Tower B: 1st February - 2 PM to 5 PM
Tower C: 2nd February - 9 AM to 12 PM

Please keep windows open and vacate for 2 hours during treatment.
Cover food items and remove pets temporarily.

Contact: +91 9845123111 for rescheduling`,
      type: 'MAINTENANCE',
      priority: 'MEDIUM',
      isActive: true,
      publishAt: daysAgo(4),
      expiresAt: daysFromNow(10),
      societyId: society1.id,
      createdById: admin1.id,
      images: [],
      documents: [],
    },
  });

  console.log('✅ 6 notices\n');

  // COMPLAINTS
  console.log('📝 Creating complaints...');
  await prisma.complaint.create({
    data: {
      title: 'Elevator #2 in Tower A Not Working',
      description: `Elevator #2 in Tower A has been malfunctioning for the past 3 days. It gets stuck between floors 5 and 6. This is causing major inconvenience especially for elderly residents and families with small children.

The elevator makes strange noises before stopping. We've informed the security multiple times but no action has been taken yet.

Please arrange for immediate repair as this is a safety hazard.`,
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
      title: 'Water Leakage from Overhead Tank',
      description: `There is continuous water leakage from the overhead tank near the main gate. Water is dripping onto the pavement making it slippery and dangerous, especially during morning and evening rush hours.

The issue has been ongoing for about a week now. This is also causing water wastage which will reflect in our bills.

Location: Near main gate, below overhead tank
Urgency: High - safety concern`,
      category: 'WATER',
      priority: 'HIGH',
      status: 'RESOLVED',
      flatId: flats[16].id,
      societyId: society1.id,
      reportedById: resident4.id,
      isAnonymous: false,
      resolvedAt: daysAgo(2),
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Loud Music and Party Noise After 11 PM',
      description: `My neighbor in B0901 has been playing extremely loud music almost every weekend till 1-2 AM. Last Saturday (20th Jan), there was a party with loud music till 1:30 AM.

This is disturbing our sleep and affecting my child's studies. I have personally requested them to reduce volume but they are not cooperating.

Request management to enforce society rules regarding noise levels after 11 PM.`,
      category: 'NOISE',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flats[48].id,
      societyId: society1.id,
      reportedById: resident5.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Unauthorized Parking in My Designated Slot',
      description: `A white Honda City (KA05XX1234) has been regularly parking in my designated parking spot (Tower A, Slot #A-101) for the past week.

I have tried contacting the vehicle owner through security but no response. Yesterday I had to park on the street due to this.

Please take strict action and ensure my parking slot remains available.`,
      category: 'PARKING',
      priority: 'HIGH',
      status: 'OPEN',
      flatId: flats[0].id,
      societyId: society1.id,
      reportedById: resident1.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Street Lights Not Working in Tower C Area',
      description: `4 street lights near Tower C parking area have not been working for over 2 weeks now. The area becomes very dark after sunset which is a security concern.

Several residents, especially women, feel unsafe walking to their cars in the evening.

Request urgent repair/replacement of these lights.`,
      category: 'ELECTRICITY',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      flatId: flats[96].id,
      societyId: society1.id,
      reportedById: resident7.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Illegal Dumping of Construction Waste',
      description: `Someone has been dumping construction debris near the garbage collection area behind Tower B. This has been happening for the past 4-5 days.

The waste is creating a mess and bad smell. Also blocking the access path.

Please identify who is doing this and remove the waste immediately.`,
      category: 'CLEANLINESS',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flats[72].id,
      societyId: society1.id,
      reportedById: resident8.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Swimming Pool Water Quality Issue',
      description: `The swimming pool water appears murky and has a strange smell. My kids complained of skin irritation after swimming yesterday.

I suspect the chlorine levels are not being maintained properly. Request water quality testing and proper treatment.`,
      category: 'OTHER',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      flatId: flats[48].id,
      societyId: society1.id,
      reportedById: resident6.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Anonymous - Security Guard Misbehavior',
      description: `One of the security guards at the east gate has been rude and uncooperative. He delays entry approvals unnecessarily and speaks in a disrespectful tone to residents.

This happened on multiple occasions in the past week. Please address this behavior issue.

(Keeping anonymous to avoid confrontation)`,
      category: 'SECURITY',
      priority: 'HIGH',
      status: 'OPEN',
      flatId: flats[16].id,
      societyId: society1.id,
      reportedById: resident4.id,
      isAnonymous: true,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Visitor Parking Occupied by Residents',
      description: `Several resident vehicles are permanently parked in visitor parking slots in Orchid Wing. This leaves no space for actual visitors.

Yesterday my guest had to park on the main road and got a parking ticket.

Please mark and enforce visitor parking strictly.`,
      category: 'PARKING',
      priority: 'MEDIUM',
      status: 'OPEN',
      flatId: flats2[0].id,
      societyId: society2.id,
      reportedById: resident10.id,
      isAnonymous: false,
    },
  });

  await prisma.complaint.create({
    data: {
      title: 'Gym Equipment Broken',
      description: `The treadmill #2 in the gym stops working after 5-10 minutes of use. The elliptical machine also makes a loud squeaking noise.

These issues have been there for over a month. Request repair or replacement.`,
      category: 'OTHER',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      flatId: flats2[12].id,
      societyId: society2.id,
      reportedById: resident11.id,
      isAnonymous: false,
      resolvedAt: daysAgo(5),
    },
  });

  console.log('✅ 10 complaints\n');

  // EMERGENCIES
  console.log('🚨 Creating emergencies...');
  await prisma.emergency.create({
    data: {
      type: 'FIRE',
      description: `Kitchen fire at A0101. Resident attempted to cook while oil was overheated. Small fire broke out but was quickly controlled using kitchen fire extinguisher.

Fire brigade called as precaution. No injuries. Minor damage to kitchen cabinet.

Action taken: Fire extinguisher replaced, fire safety training scheduled for all residents.`,
      status: 'RESOLVED',
      resolvedAt: daysAgo(15),
      flatId: flats[0].id,
      societyId: society1.id,
      reportedById: resident1.id,
    },
  });

  await prisma.emergency.create({
    data: {
      type: 'MEDICAL',
      description: `Elderly resident (Mr. Rahul Kapoor, 68 years) from C0101 slipped and fell in bathroom. Unable to get up, suspected hip fracture.

Family called emergency number. Ambulance arrived in 15 minutes. Patient transported to Manipal Hospital.

Follow-up: Patient underwent hip surgery, recovering well. Family requested installation of grab bars in bathroom.`,
      status: 'RESOLVED',
      resolvedAt: daysAgo(8),
      flatId: flats[96].id,
      societyId: society1.id,
      reportedById: resident7.id,
    },
  });

  await prisma.emergency.create({
    data: {
      type: 'THEFT',
      description: `Attempted break-in reported at B0702 around 2:30 AM. Resident heard suspicious noise near window. Security personnel immediately dispatched.

Found ladder placed against building. Intruder fled when alarm rang. CCTV footage captured image. Police complaint filed (FIR #12345/2026).

Action: Enhanced night patrolling, additional CCTV cameras installed.`,
      status: 'RESOLVED',
      resolvedAt: daysAgo(12),
      flatId: flats[72].id,
      societyId: society1.id,
      reportedById: resident8.id,
    },
  });

  await prisma.emergency.create({
    data: {
      type: 'OTHER',
      description: `Major water pipe burst on floor 6 of Tower A. Water flooding into multiple flats (A0601, A0602, A0603).

Emergency maintenance team called. Main water supply shut off. Water extraction and cleanup completed. Affected flats' electrical supply temporarily disconnected as safety measure.

Repairs completed in 4 hours. Insurance claim filed for damage restoration.`,
      status: 'RESOLVED',
      resolvedAt: daysAgo(20),
      flatId: flats[20].id,
      societyId: society1.id,
      reportedById: admin1.id,
    },
  });

  console.log('✅ 4 emergencies\n');

  // VENDORS
  console.log('🏪 Creating vendors...');
  await prisma.vendor.create({
    data: {
      name: 'Kumar Plumbing Services',
      category: 'PLUMBER',
      phone: '+919845234001',
      email: 'info@kumarplumbing.com',
      description: 'Professional plumbing services - pipe repairs, tap installation, drainage cleaning, water tank maintenance. Available 24/7. Licensed and insured. 15+ years experience.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'Bright Spark Electricians',
      category: 'ELECTRICIAN',
      phone: '+919845234002',
      email: 'contact@brightspark.in',
      description: 'Certified electricians for all electrical work - wiring, MCB installation, geyser/AC repairs, smart home setup. Emergency service available. 10+ years in business.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'AC Care Technicians',
      category: 'APPLIANCE_REPAIR',
      phone: '+919845234003',
      email: 'service@accare.com',
      description: 'Specialized in AC installation, repair, gas refilling, and AMC. All brands serviced. Same-day service. Warranty on repairs.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'QuickFix Carpenters',
      category: 'CARPENTER',
      phone: '+919845234004',
      email: 'work@quickfixcarpentry.com',
      description: 'Custom furniture, door/window repairs, modular kitchen installation, wardrobe work. Quality workmanship guaranteed. Free estimates.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'HomePaint Solutions',
      category: 'PAINTER',
      phone: '+919845234005',
      email: 'paint@homepaint.in',
      description: 'Interior and exterior painting, texture work, waterproofing. Asian Paints, Berger authorized applicators. Clean and professional service.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'PestGuard Services',
      category: 'PEST_CONTROL',
      phone: '+919845234006',
      email: 'info@pestguard.co.in',
      description: 'Eco-friendly pest control for cockroaches, termites, bedbugs, rodents. Licensed by health dept. Safe for kids and pets. AMC available.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'CleanHome Services',
      category: 'CLEANER',
      phone: '+919845234007',
      email: 'booking@cleanhome.com',
      description: 'Professional deep cleaning, sofa cleaning, bathroom sanitization, move-in/out cleaning. Trained staff. Affordable packages.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'PackersMovers Express',
      category: 'OTHER',
      phone: '+919845234008',
      email: 'relocate@packersmove.com',
      description: 'Reliable packing and moving services. Local and intercity. Insurance covered. Car transport available. Free quotation.',
      isVerified: true,
      isActive: true,
      societyId: society1.id,
      addedById: admin1.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'Mumbai Plumbing Co.',
      category: 'PLUMBER',
      phone: '+912227234001',
      email: 'service@mumbaiplumbing.in',
      description: 'Trusted plumbing solutions across Mumbai. 24x7 emergency service. Bathroom fittings, pipeline work, water heater installation.',
      isVerified: true,
      isActive: true,
      societyId: society2.id,
      addedById: admin2.id,
    },
  });

  await prisma.vendor.create({
    data: {
      name: 'ElectroFix Mumbai',
      category: 'ELECTRICIAN',
      phone: '+912227234002',
      email: 'info@electrofix.co.in',
      description: 'Licensed electrical contractors. Home automation, circuit repairs, inverter installation. Prompt and reliable service.',
      isVerified: true,
      isActive: true,
      societyId: society2.id,
      addedById: admin2.id,
    },
  });

  console.log('✅ 10 vendors\n');

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
  console.log('\n🎉 Realistic seed data completed!\n');
  console.log('=====================================');
  console.log('SUMMARY:');
  console.log('=====================================');
  console.log(`✅ Societies: 2 (Emerald Heights, Orchid Gardens)`);
  console.log(`✅ Gate Points: 4`);
  console.log(`✅ Blocks: 4 (3 towers + 1 wing)`);
  console.log(`✅ Flats: ${flats.length + flats2.length} units`);
  console.log(`✅ Users: 20+ (including families)`);
  console.log(`✅ Vehicles: 10 (cars & bikes)`);
  console.log(`✅ Amenities: 7 (gym, pool, halls, etc.)`);
  console.log(`✅ Bookings: 5 (confirmed, pending, completed)`);
  console.log(`✅ Staff: 6 (maids, cooks, driver, gardener)`);
  console.log(`✅ Assignments: 7`);
  console.log(`✅ Attendance: 2`);
  console.log(`✅ Reviews: 5`);
  console.log(`✅ Pre-approvals: 5 (active & expired)`);
  console.log(`✅ Gate Passes: 2`);
  console.log(`✅ Auto-approve Rules: 2`);
  console.log(`✅ Expected Deliveries: 1`);
  console.log(`✅ Entries: 10 (visitors, staff, deliveries, cab)`);
  console.log(`✅ Entry Requests: 2 (pending approval)`);
  console.log(`✅ Notices: 6 (maintenance, events, rules)`);
  console.log(`✅ Complaints: 10 (various categories)`);
  console.log(`✅ Emergencies: 4 (fire, medical, theft, water)`);
  console.log(`✅ Vendors: 10 (plumber, electrician, etc.)`);
  console.log(`✅ Visitor Frequency: 2`);
  console.log(`✅ Notifications: 5`);
  console.log('=====================================\n');
  console.log('🔐 PASSWORD FOR ALL USERS: Test@1234');
  console.log('📧 EMAIL FORMAT: name@domain.com');
  console.log('📱 PHONE: +91-XXXXXXXXXX');
  console.log('=====================================');
  console.log('\n💡 Sample Login Credentials:');
  console.log('-------------------------------------');
  console.log('Super Admin:');
  console.log('  Email: superadmin@societygate.com');
  console.log('  Phone: +919999999999');
  console.log('\nSociety Admin (Emerald Heights):');
  console.log('  Email: secretary@emeraldheights.in');
  console.log('  Phone: +919876543210');
  console.log('\nGuard:');
  console.log('  Email: ramesh.security@emeraldheights.in');
  console.log('  Phone: +919123456780');
  console.log('\nResident:');
  console.log('  Email: amit.verma@techcorp.com');
  console.log('  Phone: +919845123456');
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
