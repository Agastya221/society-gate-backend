import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Date helpers ───────────────────────────────────────────────────
const daysAgo     = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x; };
const daysFromNow = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x; };
const hoursAgo    = (h: number) => { const x = new Date(); x.setMinutes(x.getMinutes() - h * 60); return x; };
const hoursFromNow= (h: number) => { const x = new Date(); x.setMinutes(x.getMinutes() + h * 60); return x; };
const rand6       = ()           => Math.random().toString(36).slice(2, 8).toUpperCase();

async function main() {
  console.log('🌱 Seeding Dalma Heights Residency, Jamshedpur...\n');

  // ════════════════════════════════════════════════════════
  // CLEAN (reverse dependency order)
  // ════════════════════════════════════════════════════════
  console.log('🧹 Cleaning database...');
  await prisma.parkingViolation.deleteMany();
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
  await prisma.paymentTransaction.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.societyRegistrationRequest.deleteMany();
  await prisma.userFlatMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.block.deleteMany();
  await prisma.gatePoint.deleteMany();
  await prisma.society.deleteMany();
  console.log('✅ Cleaned\n');

  // ════════════════════════════════════════════════════════
  // SOCIETY
  // ════════════════════════════════════════════════════════
  console.log('🏢 Creating society...');
  const society = await prisma.society.create({
    data: {
      name: 'Dalma Heights Residency',
      address: 'Road No. 4, Contractors Area, Bistupur, near Jubilee Park',
      city: 'Jamshedpur',
      state: 'Jharkhand',
      pincode: '831001',
      contactName: 'Agastya Kumar',
      contactPhone: '6202923165',
      contactEmail: 'admin@dalmaheights.in',
      totalFlats: 96,
      isActive: true,
      monthlyFee: 4500,
      lastPaidDate: daysAgo(15),
      nextDueDate: daysFromNow(15),
      paymentStatus: 'PAID',
    },
  });
  console.log('✅ Society created\n');

  // ════════════════════════════════════════════════════════
  // GATE POINTS
  // ════════════════════════════════════════════════════════
  console.log('🚪 Creating gate points...');
  const mainGate = await prisma.gatePoint.create({
    data: { name: 'Main Gate (North)', isActive: true, societyId: society.id },
  });
  const serviceGate = await prisma.gatePoint.create({
    data: { name: 'Service Gate (South)', isActive: true, societyId: society.id },
  });
  console.log('✅ 2 gate points\n');

  // ════════════════════════════════════════════════════════
  // BLOCKS
  // ════════════════════════════════════════════════════════
  console.log('🏗️ Creating blocks...');
  const towerA = await prisma.block.create({
    data: { name: 'Tower A', societyId: society.id, totalFloors: 8, description: 'East-facing 2BHK & 3BHK units' },
  });
  const towerB = await prisma.block.create({
    data: { name: 'Tower B', societyId: society.id, totalFloors: 8, description: 'West-facing premium 3BHK & 4BHK units' },
  });
  const towerC = await prisma.block.create({
    data: { name: 'Tower C', societyId: society.id, totalFloors: 8, description: 'North-facing 2BHK compact units' },
  });
  const adminBlock = await prisma.block.create({
    data: { name: 'Admin', societyId: society.id, description: 'Virtual block for society management office' },
  });
  console.log('✅ 4 blocks\n');

  // ════════════════════════════════════════════════════════
  // FLATS
  // ════════════════════════════════════════════════════════
  console.log('🏠 Creating flats...');
  const allFlats: any[] = [];
  for (const [block, prefix] of [[towerA, 'A'], [towerB, 'B'], [towerC, 'C']] as const) {
    for (let floor = 1; floor <= 8; floor++) {
      for (let unit = 1; unit <= 4; unit++) {
        const f = await prisma.flat.create({
          data: {
            flatNumber: `${prefix}${floor}0${unit}`,
            floor: String(floor),
            blockId: (block as any).id,
            societyId: society.id,
            isOccupied: floor <= 6,
            ownerName: `Registered Owner of ${prefix}${floor}0${unit}`,
            ownerPhone: `98${String(Math.floor(10000000 + Math.random() * 89999999))}`,
            ownerEmail: `owner.${prefix.toLowerCase()}${floor}0${unit}@dalmaheights.in`,
          },
        });
        allFlats.push(f);
      }
    }
  }
  const adminOfficeFlat = await prisma.flat.create({
    data: {
      flatNumber: 'OFFICE',
      floor: 'G',
      blockId: adminBlock.id,
      societyId: society.id,
      isOccupied: true,
      ownerName: 'Dalma Heights Residency Management',
      ownerPhone: '6202923165',
      ownerEmail: 'admin@dalmaheights.in',
    },
  });
  const flat = (num: string) => allFlats.find((f: any) => f.flatNumber === num)!;
  console.log(`✅ ${allFlats.length} residential flats + 1 Admin Office\n`);

  // ════════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════════
  console.log('👥 Creating users...');

  const superAdmin = await prisma.user.create({ data: {
    name: 'Platform Admin',
    phone: '9999900000',
    email: 'superadmin@sgate.in',
    role: 'SUPER_ADMIN',
    isActive: true,
    isPrimaryResident: false,
    lastLogin: daysAgo(1),
    lastTokenRefresh: daysAgo(1),
  }});

  const admin = await prisma.user.create({ data: {
    name: 'Agastya Kumar',
    phone: '6202923165',
    email: 'agastya@dalmaheights.in',
    role: 'ADMIN',
    isActive: true,
    societyId: society.id,
    flatId: flat('A101').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: daysAgo(0),
    lastTokenRefresh: daysAgo(0),
  }});

  const guard1 = await prisma.user.create({ data: {
    name: 'Rajendra Singh',
    phone: '9800000001',
    email: 'rajendra.guard@dalmaheights.in',
    role: 'GUARD',
    isActive: true,
    societyId: society.id,
    lastLogin: hoursAgo(2),
    lastTokenRefresh: hoursAgo(2),
  }});

  const guard2 = await prisma.user.create({ data: {
    name: 'Suresh Mahto',
    phone: '9800000002',
    email: 'suresh.guard@dalmaheights.in',
    role: 'GUARD',
    isActive: true,
    societyId: society.id,
    lastLogin: hoursAgo(6),
    lastTokenRefresh: hoursAgo(6),
  }});

  const guard3 = await prisma.user.create({ data: {
    name: 'Manoj Kumar',
    phone: '9800000003',
    email: 'manoj.guard@dalmaheights.in',
    role: 'GUARD',
    isActive: true,
    societyId: society.id,
    lastLogin: daysAgo(1),
    lastTokenRefresh: daysAgo(1),
  }});

  // Resident 1 — A101 (Owner, Primary)
  const res1 = await prisma.user.create({ data: {
    name: 'Amit Sinha',
    phone: '9811000001',
    email: 'amit.sinha@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('A101').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: hoursAgo(3),
    lastTokenRefresh: hoursAgo(3),
  }});

  // Resident 1 spouse — A101
  const res1spouse = await prisma.user.create({ data: {
    name: 'Kavita Sinha',
    phone: '9811000002',
    email: 'kavita.sinha@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('A101').id,
    isOwner: false,
    isPrimaryResident: false,
    familyRole: 'SPOUSE',
    primaryResidentId: res1.id,
    lastLogin: daysAgo(2),
    lastTokenRefresh: daysAgo(2),
  }});

  // Resident 2 — A301 (Owner)
  const res2 = await prisma.user.create({ data: {
    name: 'Dr. Sneha Singh',
    phone: '9811000004',
    email: 'sneha.singh@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('A301').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: hoursAgo(1),
    lastTokenRefresh: hoursAgo(1),
  }});

  // Resident 3 — B102 (Tenant)
  const res3 = await prisma.user.create({ data: {
    name: 'Vikram Prasad',
    phone: '9811000006',
    email: 'vikram.prasad@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('B102').id,
    isOwner: false,
    isPrimaryResident: true,
    lastLogin: daysAgo(1),
    lastTokenRefresh: daysAgo(1),
  }});

  // Resident 4 — B401 (Owner)
  const res4 = await prisma.user.create({ data: {
    name: 'Mohan Agarwal',
    phone: '9811000008',
    email: 'mohan.agarwal@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('B401').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: daysAgo(3),
    lastTokenRefresh: daysAgo(3),
  }});

  // Resident 5 — C201 (Owner)
  const res5 = await prisma.user.create({ data: {
    name: 'Priya Kumari',
    phone: '9811000010',
    email: 'priya.kumari@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('C201').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: hoursAgo(5),
    lastTokenRefresh: hoursAgo(5),
  }});

  // Resident 6 — C401 (Owner)
  const res6 = await prisma.user.create({ data: {
    name: 'Kartik Mahto',
    phone: '9811000011',
    email: 'kartik.mahto@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('C401').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: daysAgo(2),
    lastTokenRefresh: daysAgo(2),
  }});

  // Resident 7 — B201 (Owner)
  const res7 = await prisma.user.create({ data: {
    name: 'Anita Gupta',
    phone: '9811000012',
    email: 'anita.gupta@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('B201').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: daysAgo(1),
    lastTokenRefresh: daysAgo(1),
  }});

  // Resident 8 — A201 (Owner + family member — son)
  const res8 = await prisma.user.create({ data: {
    name: 'Rajan Verma',
    phone: '9811000013',
    email: 'rajan.verma@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('A201').id,
    isOwner: true,
    isPrimaryResident: true,
    lastLogin: hoursAgo(10),
    lastTokenRefresh: hoursAgo(10),
  }});

  const res8son = await prisma.user.create({ data: {
    name: 'Aryan Verma',
    phone: '9811000014',
    email: 'aryan.verma@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('A201').id,
    isOwner: false,
    isPrimaryResident: false,
    familyRole: 'CHILD',
    primaryResidentId: res8.id,
    lastLogin: daysAgo(1),
    lastTokenRefresh: daysAgo(1),
  }});

  // Javed — B301 (Tenant, Primary)
  const javed = await prisma.user.create({ data: {
    name: 'Javed Khan',
    phone: '9006412619',
    email: 'javed.khan@gmail.com',
    role: 'RESIDENT',
    isActive: true,
    societyId: society.id,
    flatId: flat('B301').id,
    isOwner: false,
    isPrimaryResident: true,
    lastLogin: hoursAgo(1),
    lastTokenRefresh: hoursAgo(1),
  }});

  // Flat owner info updates
  await prisma.flat.update({ where: { id: flat('A101').id }, data: { currentOwnerId: res1.id, ownerName: 'Amit Sinha', ownerPhone: '9811000001', ownerEmail: 'amit.sinha@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('A201').id }, data: { currentOwnerId: res8.id, ownerName: 'Rajan Verma', ownerPhone: '9811000013', ownerEmail: 'rajan.verma@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('B301').id }, data: { currentTenantId: javed.id, ownerName: 'Javed Khan', ownerPhone: '9006412619', ownerEmail: 'javed.khan@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('A301').id }, data: { currentOwnerId: res2.id, ownerName: 'Dr. Sneha Singh', ownerPhone: '9811000004', ownerEmail: 'sneha.singh@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('B102').id }, data: { currentTenantId: res3.id, ownerName: 'Ramesh Prasad', ownerPhone: '9811099006', ownerEmail: 'ramesh.prasad@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('B201').id }, data: { currentOwnerId: res7.id, ownerName: 'Anita Gupta', ownerPhone: '9811000012', ownerEmail: 'anita.gupta@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('B401').id }, data: { currentOwnerId: res4.id, ownerName: 'Mohan Agarwal', ownerPhone: '9811000008', ownerEmail: 'mohan.agarwal@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('C201').id }, data: { currentOwnerId: res5.id, ownerName: 'Priya Kumari', ownerPhone: '9811000010', ownerEmail: 'priya.kumari@gmail.com' }});
  await prisma.flat.update({ where: { id: flat('C401').id }, data: { currentOwnerId: res6.id, ownerName: 'Kartik Mahto', ownerPhone: '9811000011', ownerEmail: 'kartik.mahto@gmail.com' }});

  console.log('✅ 16 users (1 super admin, 1 admin, 3 guards, 11 residents incl. 2 family members)\n');

  console.log('🏘️ Creating flat memberships...');
  await prisma.userFlatMembership.createMany({ data: [
    { userId: admin.id, societyId: society.id, flatId: flat('A101').id, role: 'ADMIN', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res1.id, societyId: society.id, flatId: flat('A101').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res1spouse.id, societyId: society.id, flatId: flat('A101').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: false, isLivingHere: true, isPrimary: false, isActive: true, isDefault: true },
    { userId: res2.id, societyId: society.id, flatId: flat('A301').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res3.id, societyId: society.id, flatId: flat('B102').id, role: 'RESIDENT', residentType: 'TENANT', isOwner: false, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res4.id, societyId: society.id, flatId: flat('B401').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res5.id, societyId: society.id, flatId: flat('C201').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res6.id, societyId: society.id, flatId: flat('C401').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res7.id, societyId: society.id, flatId: flat('B201').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res8.id, societyId: society.id, flatId: flat('A201').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: true, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
    { userId: res8son.id, societyId: society.id, flatId: flat('A201').id, role: 'RESIDENT', residentType: 'OWNER', isOwner: false, isLivingHere: true, isPrimary: false, isActive: true, isDefault: true },
    { userId: javed.id, societyId: society.id, flatId: flat('B301').id, role: 'RESIDENT', residentType: 'TENANT', isOwner: false, isLivingHere: true, isPrimary: true, isActive: true, isDefault: true },
  ]});
  console.log('✅ 12 flat memberships\n');

  // ════════════════════════════════════════════════════════
  // ONBOARDING
  // ════════════════════════════════════════════════════════
  console.log('📋 Creating onboarding records...');
  const residents = [
    { user: res1,   flat: flat('A101'), block: towerA, type: 'OWNER'  as const },
    { user: res2,   flat: flat('A301'), block: towerA, type: 'OWNER'  as const },
    { user: res3,   flat: flat('B102'), block: towerB, type: 'TENANT' as const },
    { user: res4,   flat: flat('B401'), block: towerB, type: 'OWNER'  as const },
    { user: res5,   flat: flat('C201'), block: towerC, type: 'OWNER'  as const },
    { user: res6,   flat: flat('C401'), block: towerC, type: 'OWNER'  as const },
    { user: res7,   flat: flat('B201'), block: towerB, type: 'OWNER'  as const },
    { user: res8,   flat: flat('A201'), block: towerA, type: 'OWNER'  as const },
    { user: javed,  flat: flat('B301'), block: towerB, type: 'TENANT' as const },
  ];

  for (const r of residents) {
    const req = await prisma.onboardingRequest.create({ data: {
      userId: r.user.id,
      societyId: society.id,
      blockId: r.block.id,
      flatId: r.flat.id,
      residentType: r.type,
      status: 'APPROVED',
      reviewedById: admin.id,
      reviewedAt: daysAgo(30),
      submittedAt: daysAgo(35),
      approvedAt: daysAgo(30),
    }});

    await prisma.residentDocument.create({ data: {
      onboardingRequestId: req.id,
      documentType: r.type === 'OWNER' ? 'OWNERSHIP_PROOF' : 'TENANT_AGREEMENT',
      documentUrl: `https://storage.dalmaheights.in/docs/${r.user.id}-doc.pdf`,
      fileName: r.type === 'OWNER' ? 'sale_agreement.pdf' : 'rent_agreement.pdf',
      fileSize: 1048576,
      mimeType: 'application/pdf',
      isVerified: true,
      verifiedAt: daysAgo(30),
    }});

    await prisma.residentDocument.create({ data: {
      onboardingRequestId: req.id,
      documentType: 'AADHAR_CARD',
      documentUrl: `https://storage.dalmaheights.in/docs/${r.user.id}-aadhar.pdf`,
      fileName: 'aadhar_card.pdf',
      fileSize: 512000,
      mimeType: 'application/pdf',
      isVerified: true,
      verifiedAt: daysAgo(30),
    }});

    await prisma.onboardingAuditLog.create({ data: {
      onboardingRequestId: req.id,
      action: 'APPROVED',
      performedBy: admin.id,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'APPROVED',
      notes: 'All documents verified. Welcome to Dalma Heights Residency!',
    }});
  }
  console.log('✅ Onboarding complete with documents & audit logs\n');

  // ════════════════════════════════════════════════════════
  // VEHICLES
  // ════════════════════════════════════════════════════════
  console.log('🚗 Creating vehicles...');
  const veh1 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05AA1001',
    vehicleType: 'Car',
    model: 'Honda City ZX',
    color: 'Pearl White',
    status: 'ACTIVE',
    parkingSlot: 'A-01',
    stickerNumber: 'DH-1001',
    lastSeen: hoursAgo(2),
    userId: res1.id,
    flatId: flat('A101').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh2 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05AA1002',
    vehicleType: 'Bike',
    model: 'Royal Enfield Bullet 350',
    color: 'Matte Black',
    status: 'ACTIVE',
    parkingSlot: 'A-02',
    stickerNumber: 'DH-1002',
    lastSeen: daysAgo(1),
    userId: res1.id,
    flatId: flat('A101').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh3 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05BB2001',
    vehicleType: 'Car',
    model: 'Toyota Innova Crysta',
    color: 'Silky Silver',
    status: 'ACTIVE',
    parkingSlot: 'A-03',
    stickerNumber: 'DH-2001',
    lastSeen: hoursAgo(4),
    userId: res2.id,
    flatId: flat('A301').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh4 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05CC3001',
    vehicleType: 'Car',
    model: 'Maruti Suzuki Swift VXI',
    color: 'Solid Red',
    status: 'ACTIVE',
    parkingSlot: 'B-01',
    stickerNumber: 'DH-3001',
    lastSeen: daysAgo(2),
    userId: res3.id,
    flatId: flat('B102').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh5 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05DD4001',
    vehicleType: 'Car',
    model: 'Hyundai Creta SX',
    color: 'Typhoon Silver',
    status: 'ACTIVE',
    parkingSlot: 'B-02',
    stickerNumber: 'DH-4001',
    lastSeen: hoursAgo(8),
    userId: res4.id,
    flatId: flat('B401').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh6 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05EE5001',
    vehicleType: 'Car',
    model: 'Tata Nexon EV Max',
    color: 'Intensi-Teal',
    status: 'ACTIVE',
    parkingSlot: 'C-01',
    stickerNumber: 'DH-5001',
    lastSeen: daysAgo(1),
    userId: res5.id,
    flatId: flat('C201').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh7 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05FF6001',
    vehicleType: 'Car',
    model: 'Kia Seltos HTX',
    color: 'Intelligency Blue',
    status: 'PENDING',
    parkingSlot: 'C-02',
    stickerNumber: 'DH-6001-P',
    userId: res6.id,
    flatId: flat('C401').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh8 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05GG7001',
    vehicleType: 'Bike',
    model: 'Honda Activa 6G',
    color: 'Pearl Sunbeam White',
    status: 'ACTIVE',
    parkingSlot: 'C-03',
    stickerNumber: 'DH-7001',
    lastSeen: hoursAgo(12),
    userId: res7.id,
    flatId: flat('B201').id,
    societyId: society.id,
    isActive: true,
  }});

  const veh9 = await prisma.vehicle.create({ data: {
    vehicleNumber: 'JH05HH8001',
    vehicleType: 'Car',
    model: 'Mahindra XUV700 AX7',
    color: 'Dazzling Silver',
    status: 'ACTIVE',
    parkingSlot: 'A-04',
    stickerNumber: 'DH-8001',
    lastSeen: hoursAgo(6),
    userId: res8.id,
    flatId: flat('A201').id,
    societyId: society.id,
    isActive: true,
  }});

  console.log('✅ 9 vehicles\n');

  // ════════════════════════════════════════════════════════
  // AMENITIES
  // ════════════════════════════════════════════════════════
  console.log('🏊 Creating amenities...');
  const gym = await prisma.amenity.create({ data: {
    name: 'Dalma Fitness Studio',
    type: 'GYM',
    description: 'Fully-equipped gym with treadmills, ellipticals, cross-trainers and free weights. Personal trainer available 6–8 AM and 6–8 PM.',
    capacity: 25,
    openTime: '05:30',
    closeTime: '23:00',
    timings: '5:30 AM – 11:00 PM Daily',
    slotDurationHours: 1,
    rules: ['No outside food or drinks', 'Carry your own towel', 'Wipe equipment after use', 'Proper sportswear mandatory', 'No phone calls inside gym'],
    pricePerHour: 0,
    maxBookingsPerUser: 2,
    isActive: true,
    societyId: society.id,
    images: [],
  }});

  const pool = await prisma.amenity.create({ data: {
    name: 'Aqua Pool',
    type: 'SWIMMING_POOL',
    description: 'Semi-Olympic size pool (25m × 12m) with separate kids section. Lifeguard on duty 6 AM–9 PM.',
    capacity: 40,
    openTime: '06:00',
    closeTime: '21:00',
    timings: '6:00 AM – 9:00 PM Daily',
    slotDurationHours: 1,
    rules: ['Shower before entering', 'No diving in shallow end', 'Children below 10 need adult supervision', 'No food inside', 'Swim caps mandatory'],
    pricePerHour: 250,
    maxBookingsPerUser: 3,
    isActive: true,
    societyId: society.id,
    images: [],
  }});

  const clubhouse = await prisma.amenity.create({ data: {
    name: 'Grand Banquet Hall',
    type: 'CLUBHOUSE',
    description: 'AC banquet hall with stage, sound system, and catering area. Capacity 150 guests.',
    capacity: 150,
    openTime: '09:00',
    closeTime: '23:00',
    timings: '9:00 AM – 11:00 PM Daily',
    slotDurationHours: 4,
    rules: ['Advance booking mandatory', 'Security deposit ₹5000 required', 'Music off by 10:30 PM', 'Outside catering allowed with prior approval', 'No non-veg food in main hall'],
    pricePerHour: 3000,
    maxBookingsPerUser: 2,
    isActive: true,
    societyId: society.id,
    images: [],
  }});

  const court = await prisma.amenity.create({ data: {
    name: 'Multi-Sport Court',
    type: 'SPORTS_COURT',
    description: 'Badminton, basketball, and tennis court with flood lights. Equipment available on request.',
    capacity: 10,
    openTime: '06:00',
    closeTime: '22:00',
    timings: '6:00 AM – 10:00 PM Daily',
    slotDurationHours: 1,
    rules: ['Wear non-marking shoes', 'Advance booking during peak hours (7–9 AM and 6–9 PM)', 'Max 2 continuous slots per user'],
    pricePerHour: 200,
    maxBookingsPerUser: 3,
    isActive: true,
    societyId: society.id,
    images: [],
  }});

  const garden = await prisma.amenity.create({ data: {
    name: "Children's Play Zone",
    type: 'GARDEN',
    description: 'Safe outdoor play area with swings, slides, sandpit for kids aged 2–12. CCTV monitored.',
    capacity: 20,
    openTime: '07:00',
    closeTime: '20:00',
    timings: '7:00 AM – 8:00 PM Daily',
    slotDurationHours: 1,
    rules: ['Children must be accompanied by an adult', 'No bicycles or scooters inside', 'Keep area clean', 'No smoking near play zone'],
    pricePerHour: 0,
    maxBookingsPerUser: 5,
    isActive: true,
    societyId: society.id,
    images: [],
  }});

  const rooftop = await prisma.amenity.create({ data: {
    name: 'Rooftop Party Lounge',
    type: 'PARTY_HALL',
    description: 'Rooftop lounge with BBQ area, city views, and DJ console. Adults only after 9 PM.',
    capacity: 60,
    openTime: '17:00',
    closeTime: '23:00',
    timings: '5:00 PM – 11:00 PM Daily',
    slotDurationHours: 3,
    rules: ['Adults only (18+) after 9 PM', 'No glass bottles', 'DJ and loud music until 10:30 PM only', 'Cleaning charge ₹1000 applicable', 'Max 60 guests'],
    pricePerHour: 2000,
    maxBookingsPerUser: 1,
    isActive: true,
    societyId: society.id,
    images: [],
  }});

  console.log('✅ 6 amenities\n');

  // ════════════════════════════════════════════════════════
  // AMENITY BOOKINGS
  // ════════════════════════════════════════════════════════
  console.log('📅 Creating amenity bookings...');
  await prisma.amenityBooking.create({ data: {
    amenityId: clubhouse.id,
    userId: res1.id,
    flatId: flat('A101').id,
    societyId: society.id,
    bookingDate: daysFromNow(5),
    startTime: '18:00',
    endTime: '22:00',
    status: 'CONFIRMED',
    purpose: "Son's 8th birthday party — 40 guests",
    guestCount: 40,
    amount: 12000,
    isPaid: true,
  }});

  await prisma.amenityBooking.create({ data: {
    amenityId: pool.id,
    userId: res2.id,
    flatId: flat('A301').id,
    societyId: society.id,
    bookingDate: daysFromNow(3),
    startTime: '16:00',
    endTime: '18:00',
    status: 'CONFIRMED',
    purpose: 'Kids swimming practice with coaching',
    guestCount: 3,
    amount: 500,
    isPaid: true,
  }});

  await prisma.amenityBooking.create({ data: {
    amenityId: gym.id,
    userId: res3.id,
    flatId: flat('B102').id,
    societyId: society.id,
    bookingDate: daysFromNow(1),
    startTime: '06:00',
    endTime: '07:00',
    status: 'CONFIRMED',
    purpose: 'Morning strength workout',
    guestCount: 1,
    amount: 0,
    isPaid: true,
  }});

  await prisma.amenityBooking.create({ data: {
    amenityId: court.id,
    userId: res5.id,
    flatId: flat('C201').id,
    societyId: society.id,
    bookingDate: daysFromNow(2),
    startTime: '18:00',
    endTime: '19:00',
    status: 'CONFIRMED',
    purpose: 'Badminton doubles with friends',
    guestCount: 4,
    amount: 200,
    isPaid: true,
  }});

  await prisma.amenityBooking.create({ data: {
    amenityId: clubhouse.id,
    userId: res4.id,
    flatId: flat('B401').id,
    societyId: society.id,
    bookingDate: daysAgo(10),
    startTime: '10:00',
    endTime: '14:00',
    status: 'COMPLETED',
    purpose: 'Silver jubilee anniversary celebration — 80 guests',
    guestCount: 80,
    amount: 12000,
    isPaid: true,
  }});

  await prisma.amenityBooking.create({ data: {
    amenityId: pool.id,
    userId: res6.id,
    flatId: flat('C401').id,
    societyId: society.id,
    bookingDate: daysFromNow(4),
    startTime: '17:00',
    endTime: '19:00',
    status: 'CANCELLED',
    purpose: 'Pool party for office colleagues',
    guestCount: 10,
    amount: 500,
    isPaid: false,
    cancelledAt: daysAgo(1),
    cancellationReason: 'Weather forecast shows heavy rain — rescheduling for next week',
  }});

  await prisma.amenityBooking.create({ data: {
    amenityId: rooftop.id,
    userId: res8.id,
    flatId: flat('A201').id,
    societyId: society.id,
    bookingDate: daysFromNow(7),
    startTime: '19:00',
    endTime: '22:00',
    status: 'CONFIRMED',
    purpose: 'House warming party',
    guestCount: 35,
    amount: 6000,
    isPaid: true,
  }});

  await prisma.amenityBooking.create({ data: {
    amenityId: gym.id,
    userId: res7.id,
    flatId: flat('B201').id,
    societyId: society.id,
    bookingDate: daysAgo(3),
    startTime: '07:00',
    endTime: '08:00',
    status: 'COMPLETED',
    purpose: 'Morning cardio session',
    guestCount: 1,
    amount: 0,
    isPaid: true,
  }});

  console.log('✅ 8 amenity bookings\n');

  // ════════════════════════════════════════════════════════
  // DOMESTIC STAFF
  // ════════════════════════════════════════════════════════
  console.log('👨‍🔧 Creating domestic staff...');

  const maid1 = await prisma.domesticStaff.create({ data: {
    name: 'Savita Bai',
    phone: '9700000001',
    email: 'savita.bai@work.in',
    staffType: 'MAID',
    experienceYears: 8,
    description: 'Experienced maid specialising in deep cleaning and kitchen work. References available.',
    languages: ['Hindi', 'Bengali'],
    idProofType: 'Aadhaar',
    idProofNumber: '2345 6789 0123',
    address: 'Bistupur Main Road, near Reliance Fresh, Jamshedpur 831001',
    emergencyContact: '9700000099',
    isFullTime: false,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    workStartTime: '08:00',
    workEndTime: '12:00',
    availabilityStatus: 'AVAILABLE',
    hourlyRate: 80,
    dailyRate: 350,
    monthlyRate: 7000,
    rating: 4.8,
    totalReviews: 24,
    isVerified: true,
    verifiedAt: daysAgo(60),
    verifiedBy: admin.id,
    isActive: true,
    isCurrentlyWorking: false,
    lastCheckIn: hoursAgo(4),
    lastCheckOut: hoursAgo(2),
    qrToken: rand6() + rand6(),
    societyId: society.id,
    addedById: admin.id,
  }});

  const cook1 = await prisma.domesticStaff.create({ data: {
    name: 'Ramesh Tiwari',
    phone: '9700000002',
    email: 'ramesh.cook@work.in',
    staffType: 'COOK',
    experienceYears: 12,
    description: 'Expert in North Indian, South Indian and Continental cuisines. Hygiene certified.',
    languages: ['Hindi', 'English'],
    idProofType: 'Aadhaar',
    idProofNumber: '3456 7890 1234',
    address: 'Mango, Jamshedpur 831012',
    emergencyContact: '9700000098',
    isFullTime: true,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    workStartTime: '07:00',
    workEndTime: '10:00',
    availabilityStatus: 'BUSY',
    hourlyRate: 120,
    dailyRate: 500,
    monthlyRate: 12000,
    rating: 4.6,
    totalReviews: 31,
    isVerified: true,
    verifiedAt: daysAgo(90),
    verifiedBy: admin.id,
    isActive: true,
    isCurrentlyWorking: true,
    lastCheckIn: hoursAgo(1),
    qrToken: rand6() + rand6(),
    societyId: society.id,
    addedById: admin.id,
  }});

  const driver1 = await prisma.domesticStaff.create({ data: {
    name: 'Ganesh Prasad',
    phone: '9700000003',
    email: 'ganesh.prasad.driver@work.in',
    staffType: 'DRIVER',
    experienceYears: 15,
    description: 'Experienced driver with clean record. Knows Jamshedpur, Ranchi and Kolkata routes well. Available for outstation.',
    languages: ['Hindi', 'Bengali'],
    idProofType: 'Driving License',
    idProofNumber: 'JH0520220012345',
    address: 'Kadma, Jamshedpur 831005',
    emergencyContact: '9700000097',
    isFullTime: true,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    workStartTime: '07:00',
    workEndTime: '21:00',
    availabilityStatus: 'AVAILABLE',
    hourlyRate: 150,
    dailyRate: 700,
    monthlyRate: 18000,
    rating: 4.9,
    totalReviews: 18,
    isVerified: true,
    verifiedAt: daysAgo(45),
    verifiedBy: admin.id,
    isActive: true,
    isCurrentlyWorking: false,
    lastCheckIn: daysAgo(1),
    lastCheckOut: daysAgo(1),
    qrToken: rand6() + rand6(),
    societyId: society.id,
    addedById: admin.id,
  }});

  const laundry1 = await prisma.domesticStaff.create({ data: {
    name: 'Sunita Devi',
    phone: '9700000004',
    email: 'sunita.laundry@work.in',
    staffType: 'LAUNDRY',
    experienceYears: 5,
    description: 'Pickup and delivery laundry service. Ironing and dry-cleaning included. 24-hour turnaround.',
    languages: ['Hindi'],
    idProofType: 'Aadhaar',
    idProofNumber: '4567 8901 2345',
    address: 'Sakchi, Jamshedpur 831001',
    emergencyContact: '9700000096',
    isFullTime: false,
    workingDays: ['MON', 'WED', 'FRI'],
    workStartTime: '09:00',
    workEndTime: '17:00',
    availabilityStatus: 'AVAILABLE',
    hourlyRate: 60,
    dailyRate: 300,
    monthlyRate: 4000,
    rating: 4.4,
    totalReviews: 12,
    isVerified: true,
    verifiedAt: daysAgo(30),
    verifiedBy: admin.id,
    isActive: true,
    isCurrentlyWorking: false,
    lastCheckIn: daysAgo(2),
    lastCheckOut: daysAgo(2),
    qrToken: rand6() + rand6(),
    societyId: society.id,
    addedById: admin.id,
  }});

  const nanny1 = await prisma.domesticStaff.create({ data: {
    name: 'Kavita Devi',
    phone: '9700000005',
    email: 'kavita.devi.nanny@work.in',
    staffType: 'NANNY',
    experienceYears: 6,
    description: 'Trained child caretaker with first aid certification. Specialist for 0–6 years. Montessori trained.',
    languages: ['Hindi', 'Odia'],
    idProofType: 'Aadhaar',
    idProofNumber: '5678 9012 3456',
    address: 'Bistupur, Jamshedpur 831001',
    emergencyContact: '9700000095',
    isFullTime: true,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    workStartTime: '08:00',
    workEndTime: '18:00',
    availabilityStatus: 'AVAILABLE',
    hourlyRate: 100,
    dailyRate: 450,
    monthlyRate: 10000,
    rating: 4.7,
    totalReviews: 9,
    isVerified: true,
    verifiedAt: daysAgo(20),
    verifiedBy: admin.id,
    isActive: true,
    isCurrentlyWorking: false,
    lastCheckIn: daysAgo(1),
    lastCheckOut: daysAgo(1),
    qrToken: rand6() + rand6(),
    societyId: society.id,
    addedById: admin.id,
  }});

  const gardener1 = await prisma.domesticStaff.create({ data: {
    name: 'Balaji Das',
    phone: '9700000006',
    email: 'balaji.das.garden@work.in',
    staffType: 'GARDENER',
    experienceYears: 10,
    description: 'Society-level gardening, plant care, and landscaping. Maintains 3 societies. Terrace garden specialist.',
    languages: ['Hindi', 'Bengali', 'Odia'],
    idProofType: 'Voter ID',
    idProofNumber: 'JH/05/234/567890',
    address: 'Mango, Jamshedpur 831012',
    emergencyContact: '9700000094',
    isFullTime: false,
    workingDays: ['MON', 'WED', 'FRI', 'SAT'],
    workStartTime: '06:00',
    workEndTime: '10:00',
    availabilityStatus: 'ON_LEAVE',
    hourlyRate: 70,
    dailyRate: 280,
    monthlyRate: 5000,
    rating: 4.5,
    totalReviews: 15,
    isVerified: true,
    verifiedAt: daysAgo(50),
    verifiedBy: admin.id,
    isActive: true,
    isCurrentlyWorking: false,
    lastCheckIn: daysAgo(3),
    lastCheckOut: daysAgo(3),
    qrToken: rand6() + rand6(),
    societyId: society.id,
    addedById: admin.id,
  }});

  const cleaner1 = await prisma.domesticStaff.create({ data: {
    name: 'Pradeep Oraon',
    phone: '9700000007',
    email: 'pradeep.oraon.clean@work.in',
    staffType: 'CLEANER',
    experienceYears: 4,
    description: 'Society common area cleaning specialist. Handles lobby, corridors, parking area cleaning.',
    languages: ['Hindi', 'Odia'],
    idProofType: 'Aadhaar',
    idProofNumber: '6789 0123 4567',
    address: 'Bistupur Main Road, Jamshedpur 831001',
    emergencyContact: '9700000093',
    isFullTime: true,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    workStartTime: '06:00',
    workEndTime: '14:00',
    availabilityStatus: 'AVAILABLE',
    hourlyRate: 55,
    dailyRate: 250,
    monthlyRate: 6000,
    rating: 4.3,
    totalReviews: 7,
    isVerified: true,
    verifiedAt: daysAgo(15),
    verifiedBy: admin.id,
    isActive: true,
    isCurrentlyWorking: true,
    lastCheckIn: hoursAgo(2),
    qrToken: rand6() + rand6(),
    societyId: society.id,
    addedById: admin.id,
  }});

  console.log('✅ 7 domestic staff\n');

  // ════════════════════════════════════════════════════════
  // STAFF ASSIGNMENTS
  // ════════════════════════════════════════════════════════
  console.log('🔗 Creating staff assignments...');
  await prisma.staffFlatAssignment.createMany({ data: [
    { domesticStaffId: maid1.id,     flatId: flat('A101').id, isPrimary: true,  workingDays: ['MON','WED','FRI'],                          workStartTime: '08:00', workEndTime: '10:00', agreedRate: 2500,  rateType: 'monthly', isActive: true },
    { domesticStaffId: maid1.id,     flatId: flat('A301').id, isPrimary: false, workingDays: ['TUE','THU','SAT'],                          workStartTime: '10:30', workEndTime: '12:30', agreedRate: 2500,  rateType: 'monthly', isActive: true },
    { domesticStaffId: maid1.id,     flatId: flat('A201').id, isPrimary: false, workingDays: ['MON','WED'],                                workStartTime: '12:45', workEndTime: '14:00', agreedRate: 1800,  rateType: 'monthly', isActive: true },
    { domesticStaffId: cook1.id,     flatId: flat('B102').id, isPrimary: true,  workingDays: ['MON','TUE','WED','THU','FRI','SAT','SUN'], workStartTime: '07:30', workEndTime: '09:30', agreedRate: 5000,  rateType: 'monthly', isActive: true },
    { domesticStaffId: cook1.id,     flatId: flat('B401').id, isPrimary: false, workingDays: ['MON','TUE','WED','THU','FRI'],             workStartTime: '10:00', workEndTime: '12:00', agreedRate: 4500,  rateType: 'monthly', isActive: true },
    { domesticStaffId: driver1.id,   flatId: flat('B401').id, isPrimary: true,  workingDays: ['MON','TUE','WED','THU','FRI'],             workStartTime: '08:00', workEndTime: '10:00', agreedRate: 8000,  rateType: 'monthly', isActive: true },
    { domesticStaffId: laundry1.id,  flatId: flat('A101').id, isPrimary: false, workingDays: ['MON','WED','FRI'],                          workStartTime: '10:00', workEndTime: '11:00', agreedRate: 1500,  rateType: 'monthly', isActive: true },
    { domesticStaffId: laundry1.id,  flatId: flat('C401').id, isPrimary: true,  workingDays: ['MON','WED','FRI'],                          workStartTime: '11:30', workEndTime: '12:30', agreedRate: 1500,  rateType: 'monthly', isActive: true },
    { domesticStaffId: nanny1.id,    flatId: flat('C201').id, isPrimary: true,  workingDays: ['MON','TUE','WED','THU','FRI'],             workStartTime: '09:00', workEndTime: '17:00', agreedRate: 9000,  rateType: 'monthly', isActive: true },
    { domesticStaffId: gardener1.id, flatId: flat('B201').id, isPrimary: false, workingDays: ['MON','WED'],                                workStartTime: '06:30', workEndTime: '08:30', agreedRate: 800,   rateType: 'monthly', isActive: true },
    { domesticStaffId: cleaner1.id,  flatId: flat('A101').id, isPrimary: false, workingDays: ['MON','TUE','WED','THU','FRI','SAT','SUN'], workStartTime: '06:00', workEndTime: '07:00', agreedRate: 500,   rateType: 'monthly', isActive: true },
  ]});
  console.log('✅ 11 staff assignments\n');

  // ════════════════════════════════════════════════════════
  // STAFF ATTENDANCE (last 7 days)
  // ════════════════════════════════════════════════════════
  console.log('📋 Creating staff attendance...');
  for (let d = 6; d >= 1; d--) {
    const date = daysAgo(d);
    const ci1 = new Date(date); ci1.setHours(8, 5, 0, 0);
    const co1 = new Date(date); co1.setHours(10, 10, 0, 0);
    await prisma.staffAttendance.create({ data: {
      domesticStaffId: maid1.id,
      flatId: flat('A101').id,
      societyId: society.id,
      checkInTime: ci1,
      checkOutTime: co1,
      checkInMethod: 'QR',
      checkOutMethod: 'QR',
      duration: 125,
      notes: 'On time. Completed cleaning and mopping.',
      workCompleted: 'Kitchen deep clean, living room vacuuming, bathrooms scrubbed',
      verifiedByGuardId: guard1.id,
    }});

    const ci2 = new Date(date); ci2.setHours(7, 30, 0, 0);
    const co2 = new Date(date); co2.setHours(9, 35, 0, 0);
    await prisma.staffAttendance.create({ data: {
      domesticStaffId: cook1.id,
      flatId: flat('B102').id,
      societyId: society.id,
      checkInTime: ci2,
      checkOutTime: co2,
      checkInMethod: 'QR',
      checkOutMethod: 'MANUAL',
      duration: 125,
      notes: 'Prepared breakfast and packed lunch tiffin.',
      workCompleted: 'Aloo paratha breakfast, dal-rice lunch tiffin, kitchen cleaned',
      verifiedByGuardId: guard2.id,
    }});

    const ci3 = new Date(date); ci3.setHours(6, 10, 0, 0);
    const co3 = new Date(date); co3.setHours(13, 55, 0, 0);
    await prisma.staffAttendance.create({ data: {
      domesticStaffId: cleaner1.id,
      flatId: flat('A101').id,
      societyId: society.id,
      checkInTime: ci3,
      checkOutTime: co3,
      checkInMethod: 'QR',
      checkOutMethod: 'QR',
      duration: 465,
      notes: 'Society common area cleaning done.',
      workCompleted: 'Lobby sweep and mop, staircase cleaning, parking area sweep, corridor dusting',
      verifiedByGuardId: guard1.id,
    }});
  }
  console.log('✅ Attendance records created (7 days × 3 staff)\n');

  // ════════════════════════════════════════════════════════
  // STAFF REVIEWS
  // ════════════════════════════════════════════════════════
  console.log('⭐ Creating staff reviews...');
  await prisma.staffReview.create({ data: {
    domesticStaffId: maid1.id,
    reviewerId: res1.id,
    flatId: flat('A101').id,
    rating: 5,
    review: 'Excellent work, very punctual and thorough. Highly recommend to everyone in the society!',
    workQuality: 5,
    punctuality: 5,
    behavior: 5,
    workType: 'Daily cleaning',
    workDate: daysAgo(7),
  }});

  await prisma.staffReview.create({ data: {
    domesticStaffId: maid1.id,
    reviewerId: res2.id,
    flatId: flat('A301').id,
    rating: 4,
    review: 'Very good cleaning. Occasionally needs reminders for deep cleaning. Overall satisfied.',
    workQuality: 4,
    punctuality: 5,
    behavior: 5,
    workType: 'Daily cleaning',
    workDate: daysAgo(5),
  }});

  await prisma.staffReview.create({ data: {
    domesticStaffId: cook1.id,
    reviewerId: res3.id,
    flatId: flat('B102').id,
    rating: 4,
    review: 'Great food, especially the dal tadka and biryani. Slightly late sometimes but overall great cook.',
    workQuality: 5,
    punctuality: 3,
    behavior: 5,
    workType: 'Daily cooking',
    workDate: daysAgo(5),
  }});

  await prisma.staffReview.create({ data: {
    domesticStaffId: driver1.id,
    reviewerId: res4.id,
    flatId: flat('B401').id,
    rating: 5,
    review: 'Very safe and reliable driver. Knows all routes in Jamshedpur, Ranchi and Kolkata. Never been late.',
    workQuality: 5,
    punctuality: 5,
    behavior: 5,
    workType: 'Office and school drops',
    workDate: daysAgo(3),
  }});

  await prisma.staffReview.create({ data: {
    domesticStaffId: nanny1.id,
    reviewerId: res5.id,
    flatId: flat('C201').id,
    rating: 5,
    review: 'Outstanding nanny! My 2-year-old loves her. Very caring, educational activities every day.',
    workQuality: 5,
    punctuality: 5,
    behavior: 5,
    workType: 'Child care — full day',
    workDate: daysAgo(4),
  }});

  await prisma.staffReview.create({ data: {
    domesticStaffId: gardener1.id,
    reviewerId: res7.id,
    flatId: flat('B201').id,
    rating: 4,
    review: 'Good knowledge of plants. Transformed our balcony garden completely. Would recommend.',
    workQuality: 4,
    punctuality: 4,
    behavior: 5,
    workType: 'Balcony garden setup',
    workDate: daysAgo(10),
  }});

  console.log('✅ 6 staff reviews\n');

  // ════════════════════════════════════════════════════════
  // STAFF BOOKINGS
  // ════════════════════════════════════════════════════════
  console.log('📅 Creating staff bookings...');
  await prisma.staffBooking.create({ data: {
    domesticStaffId: maid1.id,
    bookedById: res2.id,
    flatId: flat('A301').id,
    societyId: society.id,
    bookingDate: daysFromNow(2),
    startTime: '09:00',
    endTime: '12:00',
    durationHours: 3,
    workType: 'Deep cleaning',
    requirements: 'Kitchen and both bathrooms priority. Use eco-friendly products.',
    estimatedCost: 240,
    status: 'CONFIRMED',
    acceptedAt: hoursAgo(2),
    isPaid: false,
  }});

  await prisma.staffBooking.create({ data: {
    domesticStaffId: cook1.id,
    bookedById: res5.id,
    flatId: flat('C201').id,
    societyId: society.id,
    bookingDate: daysFromNow(1),
    startTime: '11:00',
    endTime: '14:00',
    durationHours: 3,
    workType: 'Party catering',
    requirements: 'South Indian menu for 15 people. Include idli, dosa, sambar and chutneys.',
    estimatedCost: 360,
    status: 'CONFIRMED',
    acceptedAt: hoursAgo(5),
    isPaid: true,
  }});

  await prisma.staffBooking.create({ data: {
    domesticStaffId: driver1.id,
    bookedById: res8.id,
    flatId: flat('A201').id,
    societyId: society.id,
    bookingDate: daysFromNow(3),
    startTime: '06:00',
    endTime: '22:00',
    durationHours: 16,
    workType: 'Full day outstation trip',
    requirements: 'Ranchi trip. Need driver from 6 AM. Car will be provided.',
    estimatedCost: 2500,
    status: 'PENDING',
    isPaid: false,
  }});

  await prisma.staffBooking.create({ data: {
    domesticStaffId: maid1.id,
    bookedById: res7.id,
    flatId: flat('B201').id,
    societyId: society.id,
    bookingDate: daysAgo(5),
    startTime: '10:00',
    endTime: '14:00',
    durationHours: 4,
    workType: 'Post-renovation cleaning',
    requirements: 'Complete flat cleaning after painting work. Dust removal from all surfaces.',
    estimatedCost: 320,
    status: 'COMPLETED',
    acceptedAt: daysAgo(6),
    completedAt: daysAgo(5),
    actualDuration: 4.5,
    finalCost: 360,
    isPaid: true,
  }});

  console.log('✅ 4 staff bookings\n');

  // ════════════════════════════════════════════════════════
  // GATE PASSES
  // ════════════════════════════════════════════════════════
  console.log('🎫 Creating gate passes...');
  await prisma.gatePass.create({ data: {
    type: 'MOVE_IN',
    status: 'APPROVED',
    title: 'New furniture delivery',
    description: 'Moving in new furniture set purchased from HomeTown — 3-seater sofa, dining table, TV unit',
    itemsList: ['Sofa set 3-seater (brown leather)', 'Dining table 6-seater with chairs', 'TV cabinet', 'King size mattress', 'Bookshelf'],
    vehicleNumber: 'JH05TK5678',
    driverName: 'Raju Movers & Packers',
    driverPhone: '9600000001',
    validFrom: daysFromNow(1),
    validUntil: daysFromNow(2),
    flatId: flat('A101').id,
    societyId: society.id,
    requestedById: res1.id,
    approvedById: admin.id,
    approvedAt: daysAgo(1),
    qrToken: rand6() + rand6(),
    attachments: [],
  }});

  await prisma.gatePass.create({ data: {
    type: 'MAINTENANCE',
    status: 'APPROVED',
    title: 'AC servicing and gas refill',
    description: 'Annual AC service by Cool Tech — 3 units to be serviced in flat B401',
    workerName: 'Sunil Technician',
    workerPhone: '9600000002',
    companyName: 'Cool Tech Service Pvt Ltd',
    itemsList: ['Toolkit', 'Refrigerant gas cylinder R32', 'Cleaning supplies', 'Replacement filters'],
    vehicleNumber: 'JH05SV1234',
    driverName: 'Sunil Technician',
    driverPhone: '9600000002',
    validFrom: daysFromNow(3),
    validUntil: daysFromNow(3),
    flatId: flat('B401').id,
    societyId: society.id,
    requestedById: res4.id,
    approvedById: admin.id,
    approvedAt: hoursAgo(5),
    qrToken: rand6() + rand6(),
    attachments: [],
  }});

  await prisma.gatePass.create({ data: {
    type: 'MATERIAL',
    status: 'PENDING',
    title: 'Old furniture removal',
    description: 'Removing old sofa, dining table and wardrobe from flat C201 to donate to NGO',
    itemsList: ['Old 2-seater sofa', 'Dining table 4-seater', 'Wooden wardrobe'],
    vehicleNumber: 'JH05RT4321',
    driverName: 'NGO Transport',
    driverPhone: '9600000003',
    validFrom: daysFromNow(2),
    validUntil: daysFromNow(2),
    flatId: flat('C201').id,
    societyId: society.id,
    requestedById: res5.id,
    qrToken: rand6() + rand6(),
    attachments: [],
  }});

  await prisma.gatePass.create({ data: {
    type: 'MOVE_OUT',
    status: 'APPROVED',
    title: 'Tenant vacating flat B102',
    description: 'Tenant moving out. Moving all household goods.',
    itemsList: ['All household furniture', 'Electronics — TV, refrigerator, washing machine', 'Beds and mattresses', 'Kitchen utensils', 'Personal belongings'],
    vehicleNumber: 'JH05MV9876',
    driverName: 'Express Packers',
    driverPhone: '9600000004',
    validFrom: daysFromNow(10),
    validUntil: daysFromNow(10),
    flatId: flat('B102').id,
    societyId: society.id,
    requestedById: res3.id,
    approvedById: admin.id,
    approvedAt: daysAgo(1),
    qrToken: rand6() + rand6(),
    attachments: [],
  }});

  console.log('✅ 4 gate passes\n');

  // ════════════════════════════════════════════════════════
  // ENTRIES (Log)
  // ════════════════════════════════════════════════════════
  console.log('🚪 Creating entries...');

  await prisma.entry.create({ data: {
    type: 'VISITOR',
    status: 'CHECKED_OUT',
    visitorName: 'Ravi Shankar',
    visitorPhone: '9840000001',
    visitorType: 'FRIEND',
    purpose: 'Social visit — lunch',
    vehicleNumber: 'JH05ZZ1111',
    wasAutoApproved: false,
    approvedById: res1.id,
    approvedAt: hoursAgo(5),
    checkInTime: hoursAgo(5),
    checkOutTime: hoursAgo(3),
    flatId: flat('A101').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard1.id,
    remarks: 'College friend of Amit Sinha. ID verified.',
  }});

  await prisma.entry.create({ data: {
    type: 'DELIVERY',
    status: 'CHECKED_OUT',
    visitorName: 'Swiggy Delivery — Ramu',
    visitorPhone: '9840000002',
    visitorType: 'DELIVERY_PERSON',
    purpose: 'Food delivery — Swiggy',
    companyName: 'Swiggy',
    packageCount: 1,
    wasAutoApproved: true,
    autoApprovalReason: 'Approved by resident via app notification',
    checkInTime: hoursAgo(3),
    checkOutTime: hoursAgo(2.8),
    flatId: flat('A301').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard1.id,
  }});

  await prisma.entry.create({ data: {
    type: 'DELIVERY',
    status: 'CHECKED_OUT',
    visitorName: 'Amazon Delivery — Vijay',
    visitorPhone: '9840000003',
    visitorType: 'DELIVERY_PERSON',
    purpose: 'Package delivery — Amazon',
    companyName: 'Amazon',
    packageCount: 2,
    wasAutoApproved: true,
    autoApprovalReason: 'Pre-approved delivery entry',
    checkInTime: hoursAgo(26),
    checkOutTime: hoursAgo(25.8),
    flatId: flat('A301').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard3.id,
  }});

  await prisma.entry.create({ data: {
    type: 'VISITOR',
    status: 'CHECKED_OUT',
    visitorName: 'Kumar Plumbing — Raju',
    visitorPhone: '9840000004',
    visitorType: 'SERVICE_PROVIDER',
    purpose: 'Bathroom tap repair — kitchen and bathroom',
    vehicleNumber: 'JH05PP7777',
    wasAutoApproved: false,
    approvedById: res4.id,
    approvedAt: hoursAgo(28),
    checkInTime: hoursAgo(28),
    checkOutTime: hoursAgo(26.5),
    flatId: flat('B401').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard1.id,
    remarks: 'Plumber from Singh Plumbing Services. Tools inspected at gate.',
  }});

  await prisma.entry.create({ data: {
    type: 'CAB',
    status: 'CHECKED_OUT',
    visitorName: 'Uber — Ravi Kumar',
    visitorPhone: '9840000005',
    visitorType: 'CAB_DRIVER',
    purpose: 'Cab pickup for resident',
    vehicleNumber: 'JH05XY9999',
    wasAutoApproved: true,
    autoApprovalReason: 'Pre-approved cab entry — vehicle digits matched',
    checkInTime: hoursAgo(25),
    checkOutTime: hoursAgo(24.9),
    flatId: flat('C201').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard1.id,
  }});

  await prisma.entry.create({ data: {
    type: 'DOMESTIC_STAFF',
    status: 'CHECKED_IN',
    visitorName: 'Savita Bai',
    visitorPhone: '9700000001',
    visitorType: 'OTHER',
    purpose: 'Daily maid service',
    wasAutoApproved: true,
    autoApprovalReason: 'Registered domestic staff — QR scan verified',
    checkInTime: hoursAgo(1),
    domesticStaffId: maid1.id,
    flatId: flat('A101').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard2.id,
  }});

  await prisma.entry.create({ data: {
    type: 'VISITOR',
    status: 'CHECKED_IN',
    visitorName: 'Neha Kapoor',
    visitorPhone: '9840000007',
    visitorType: 'FAMILY_MEMBER',
    purpose: 'Family visit — weekend stay',
    wasAutoApproved: false,
    approvedById: res2.id,
    approvedAt: hoursAgo(0.5),
    checkInTime: hoursAgo(0.5),
    flatId: flat('A301').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard2.id,
    remarks: 'Sister of Dr. Sneha Singh. Aadhaar verified.',
  }});

  await prisma.entry.create({ data: {
    type: 'DELIVERY',
    status: 'CHECKED_OUT',
    visitorName: 'Blinkit Delivery — Suresh',
    visitorPhone: '9840000008',
    visitorType: 'DELIVERY_PERSON',
    purpose: 'Grocery delivery — Blinkit',
    companyName: 'Blinkit',
    packageCount: 3,
    wasAutoApproved: true,
    autoApprovalReason: 'Approved by resident via app',
    checkInTime: hoursAgo(6),
    checkOutTime: hoursAgo(5.9),
    flatId: flat('B102').id,
    societyId: society.id,
    gatePointId: serviceGate.id,
    createdById: guard3.id,
  }});

  await prisma.entry.create({ data: {
    type: 'VENDOR',
    status: 'CHECKED_OUT',
    visitorName: 'PowerFix Electrician — Mohit',
    visitorPhone: '9840000009',
    visitorType: 'SERVICE_PROVIDER',
    purpose: 'Electrical work — MCB replacement and wiring check',
    vehicleNumber: 'JH05EL2222',
    wasAutoApproved: false,
    approvedById: res8.id,
    approvedAt: daysAgo(2),
    checkInTime: daysAgo(2),
    checkOutTime: daysAgo(2),
    flatId: flat('A201').id,
    societyId: society.id,
    gatePointId: mainGate.id,
    createdById: guard1.id,
    remarks: 'Authorized vendor from PowerFix Electricals.',
  }});

  console.log('✅ 9 entries\n');

  // ════════════════════════════════════════════════════════
  // ENTRY REQUESTS
  // ════════════════════════════════════════════════════════
  console.log('📸 Creating entry requests...');

  // PENDING — waiting for resident approval
  await prisma.entryRequest.create({ data: {
    type: 'DELIVERY',
    status: 'PENDING',
    visitorName: 'Swiggy Delivery Boy',
    visitorPhone: '9850000001',
    providerTag: 'SWIGGY',
    flatId: flat('A301').id,
    societyId: society.id,
    guardId: guard1.id,
    expiresAt: hoursFromNow(0.25),
  }});

  await prisma.entryRequest.create({ data: {
    type: 'VISITOR',
    status: 'PENDING',
    visitorName: 'Rahul Mehta',
    visitorPhone: '9850000002',
    flatId: flat('B102').id,
    societyId: society.id,
    guardId: guard2.id,
    expiresAt: hoursFromNow(0.2),
  }});

  await prisma.entryRequest.create({ data: {
    type: 'DELIVERY',
    status: 'PENDING',
    visitorName: 'Blinkit Delivery — Arun',
    visitorPhone: '9850000007',
    providerTag: 'BLINKIT',
    flatId: flat('C201').id,
    societyId: society.id,
    guardId: guard3.id,
    expiresAt: hoursFromNow(0.15),
  }});

  await prisma.entryRequest.create({ data: {
    type: 'CAB',
    status: 'PENDING',
    visitorName: 'Ola Cab — Suresh Rathod',
    visitorPhone: '9850000008',
    flatId: flat('A101').id,
    societyId: society.id,
    guardId: guard1.id,
    expiresAt: hoursFromNow(0.12),
  }});

  // APPROVED
  await prisma.entryRequest.create({ data: {
    type: 'VISITOR',
    status: 'APPROVED',
    visitorName: 'Priya Nair',
    visitorPhone: '9850000003',
    approvedById: res2.id,
    approvedAt: hoursAgo(1),
    flatId: flat('A301').id,
    societyId: society.id,
    guardId: guard1.id,
    expiresAt: hoursFromNow(0.25),
  }});

  await prisma.entryRequest.create({ data: {
    type: 'DELIVERY',
    status: 'APPROVED',
    visitorName: 'Amazon Delivery — Vinod',
    visitorPhone: '9850000005',
    providerTag: 'AMAZON',
    approvedById: res3.id,
    approvedAt: hoursAgo(2),
    flatId: flat('B102').id,
    societyId: society.id,
    guardId: guard2.id,
    expiresAt: hoursFromNow(0.1),
  }});

  // REJECTED
  await prisma.entryRequest.create({ data: {
    type: 'VISITOR',
    status: 'REJECTED',
    visitorName: 'Unknown Person',
    visitorPhone: '9850000004',
    rejectedAt: hoursAgo(1),
    rejectionReason: 'Not expecting any visitors today. Please verify before allowing.',
    flatId: flat('B401').id,
    societyId: society.id,
    guardId: guard3.id,
    expiresAt: hoursAgo(0.5),
  }});

  // EXPIRED
  await prisma.entryRequest.create({ data: {
    type: 'DELIVERY',
    status: 'EXPIRED',
    visitorName: 'Flipkart Delivery — Ramesh',
    visitorPhone: '9850000006',
    providerTag: 'FLIPKART',
    flatId: flat('C401').id,
    societyId: society.id,
    guardId: guard1.id,
    expiresAt: hoursAgo(1),
  }});

  console.log('✅ 8 entry requests (4 pending, 2 approved, 1 rejected, 1 expired)\n');

  // ════════════════════════════════════════════════════════
  // NOTICES
  // ════════════════════════════════════════════════════════
  console.log('📢 Creating notices...');

  await prisma.notice.create({ data: {
    title: 'Monthly Maintenance Due — April 2026',
    description: `Dear Residents,\n\nMonthly maintenance of ₹4,500 for April 2026 is due by 5th April 2026.\n\nPayment Options:\n• UPI: dalmaheights@sbi\n• Bank Transfer: A/C 9876543210, IFSC SBIN0012345\n• Cash at Admin Office (Mon–Sat 10 AM–1 PM)\n\nLate fee of ₹200 applicable after 10th April.\n\nRegards,\nManagement Committee`,
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
  }});

  await prisma.notice.create({ data: {
    title: 'Water Supply Disruption — 12th April (10 AM to 4 PM)',
    description: `Due to JNAC pipeline maintenance work on Bistupur Main Road:\n\nDate: 12th April 2026 (Sunday)\nTime: 10:00 AM to 4:00 PM\nAffected: All towers (A, B, C)\n\nPlease store sufficient water in advance. Emergency tanker will be arranged if outage extends beyond 4 PM.\n\nContact maintenance: 9820001234\n\n— Maintenance Team`,
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
  }});

  await prisma.notice.create({ data: {
    title: 'Summer Camp 2026 Registration Open — Dalma Kids Club',
    description: `Attention Parents!\n\nSummer Camp 2026 registration is now open for all Dalma Heights Residency children.\n\nActivities: Swimming, Art & Craft, Coding, Dance, Yoga\nAge Group: 5–15 years\nDates: 15 April to 15 May 2026\nFee: ₹8,000 (all inclusive)\n\nRegister at admin office or WhatsApp 9820001111.\nLimited seats — first come first served!\n\n— Cultural Committee`,
    type: 'EVENT',
    priority: 'MEDIUM',
    isActive: true,
    isPinned: true,
    isUrgent: false,
    publishAt: daysAgo(3),
    expiresAt: daysFromNow(20),
    societyId: society.id,
    createdById: admin.id,
    images: [],
    documents: [],
  }});

  await prisma.notice.create({ data: {
    title: 'New Parking Policy — Effective 1st April 2026',
    description: `New parking regulations effective immediately:\n\n1. All vehicles MUST display society stickers\n2. Visitor parking limited to 3 hours (Main Gate area only)\n3. No parking in fire lane — towing enforced at owner's cost (₹2000)\n4. Two-wheelers only in designated 2W zones\n5. Repeat violators will be fined ₹500 per incident\n\nSticker registration: Admin office or online portal.\n\n— Security Committee`,
    type: 'GENERAL',
    priority: 'MEDIUM',
    isActive: true,
    isPinned: false,
    isUrgent: false,
    publishAt: daysAgo(7),
    expiresAt: daysFromNow(30),
    societyId: society.id,
    createdById: admin.id,
    images: [],
    documents: [],
  }});

  await prisma.notice.create({ data: {
    title: 'Quarterly Pest Control — 8th & 9th April',
    description: `Scheduled pest control treatment:\n\nTower A: 8th April, 9 AM – 12 PM\nTower B: 8th April, 2 PM – 5 PM\nTower C: 9th April, 9 AM – 12 PM\nCommon Areas: 9th April, 2 PM – 4 PM\n\nPlease ensure:\n• Windows open during treatment\n• Cover food and utensils\n• Remove pets and plants indoors\n\nContact: 9820001234 to reschedule for unavoidable conflicts.\n\n— Maintenance Team`,
    type: 'MAINTENANCE',
    priority: 'MEDIUM',
    isActive: true,
    isPinned: false,
    isUrgent: false,
    publishAt: daysAgo(3),
    expiresAt: daysFromNow(10),
    societyId: society.id,
    createdById: admin.id,
    images: [],
    documents: [],
  }});

  await prisma.notice.create({ data: {
    title: 'Gym Upgrade Complete — New Equipment Added!',
    description: `We are happy to announce that the gym upgrade is now complete!\n\nNew equipment added:\n• 2 Commercial Treadmills (LifeFitness)\n• Rowing Machine\n• Additional Free Weights (up to 30 kg)\n• New Yoga and Exercise Mats\n• Smart TV with workout apps\n\nUpdated gym hours: 5:30 AM – 11:00 PM daily.\nPersonal trainer available Mon–Sat 6–8 AM and 6–8 PM.\n\nThanks for your patience during the 2-week upgrade.\n\n— Amenities Committee`,
    type: 'GENERAL',
    priority: 'LOW',
    isActive: true,
    isPinned: false,
    isUrgent: false,
    publishAt: daysAgo(4),
    societyId: society.id,
    createdById: admin.id,
    images: [],
    documents: [],
  }});

  await prisma.notice.create({ data: {
    title: 'Emergency Contact Update — Save These Numbers',
    description: `Please save these important emergency contacts:\n\nPolice: 100\nFire Brigade: 101\nAmbulance: 108\nSociety Emergency: 9820009999 (24x7)\nAdmin Office: 9820001234 (9 AM – 6 PM)\nMaintenance Emergency: 9820005678 (24x7)\nLift AMC (Otis): 1800 209 6000\n\nJamshedpur Notified Area Committee: 1800 345 6489\nJUSCO/TSUISL Utilities: 0657 664 6000\nGas Leak: 1906\n\nPlease save these numbers for quick access.\n\n— Management Committee`,
    type: 'GENERAL',
    priority: 'LOW',
    isActive: true,
    isPinned: true,
    isUrgent: false,
    publishAt: daysAgo(10),
    societyId: society.id,
    createdById: admin.id,
    images: [],
    documents: [],
  }});

  console.log('✅ 7 notices\n');

  // ════════════════════════════════════════════════════════
  // COMPLAINTS
  // ════════════════════════════════════════════════════════
  console.log('📝 Creating complaints...');

  await prisma.complaint.create({ data: {
    category: 'NOISE',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    title: 'Loud music after 11 PM from B303',
    description: 'Residents of B303 play loud music past midnight on weekends. This has been ongoing for 3 weeks. Multiple residents in Tower B have complained verbally but no action taken. This is affecting sleep and quality of life.',
    location: 'Tower B, 3rd floor, flat B303',
    images: [],
    reportedById: res3.id,
    flatId: flat('B102').id,
    societyId: society.id,
    assignedToId: admin.id,
    assignedAt: daysAgo(2),
  }});

  await prisma.complaint.create({ data: {
    category: 'PARKING',
    priority: 'MEDIUM',
    status: 'OPEN',
    title: 'Unknown vehicle blocking my allocated parking slot A-01',
    description: 'A white Maruti Swift with number DL3CAF1234 has been parked in my allocated slot A-01 for the past 2 days. No society sticker visible. No one knows who the vehicle belongs to. Please arrange for the vehicle to be moved immediately.',
    location: 'Parking Lot A, Slot A-01',
    images: [],
    reportedById: res1.id,
    flatId: flat('A101').id,
    societyId: society.id,
  }});

  await prisma.complaint.create({ data: {
    category: 'WATER',
    priority: 'URGENT',
    status: 'RESOLVED',
    title: 'Water leakage from ceiling — living room',
    description: 'There is a continuous water drip from the living room ceiling. The water seems to be coming from the flat above (A401). Brown stains visible on ceiling and wall. Flooring is getting wet. Please send a plumber urgently.',
    location: 'Flat A301, living room ceiling',
    images: [],
    reportedById: res2.id,
    flatId: flat('A301').id,
    societyId: society.id,
    assignedToId: admin.id,
    assignedAt: daysAgo(10),
    resolvedById: admin.id,
    resolvedAt: daysAgo(8),
    resolution: 'Plumber identified and fixed a leaking pipe joint in A401 bathroom. Ceiling patch repair completed. Stain painting scheduled.',
  }});

  await prisma.complaint.create({ data: {
    category: 'ELECTRICITY',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    title: 'Street light not working near main gate',
    description: 'The street light near the main gate has been non-functional for 5 days. The area is completely dark at night and poses a security and safety risk. Guards are using personal torches as a workaround.',
    location: 'Main Gate entrance area',
    images: [],
    reportedById: res4.id,
    flatId: flat('B401').id,
    societyId: society.id,
    assignedToId: admin.id,
    assignedAt: daysAgo(1),
  }});

  await prisma.complaint.create({ data: {
    category: 'CLEANLINESS',
    priority: 'MEDIUM',
    status: 'OPEN',
    title: 'Garbage not collected from Tower C 2nd floor corridor',
    description: 'Garbage bags have been left in the Tower C 2nd floor corridor since yesterday evening. Foul smell is spreading to adjacent flats. Housekeeping staff seems to have missed this area.',
    location: 'Tower C, 2nd floor corridor near lift lobby',
    images: [],
    reportedById: res5.id,
    flatId: flat('C201').id,
    societyId: society.id,
  }});

  await prisma.complaint.create({ data: {
    category: 'SECURITY',
    priority: 'HIGH',
    status: 'CLOSED',
    title: 'Unknown person loitering near parking area at 2 AM',
    description: 'Security camera near parking lot A showed an unknown person loitering near vehicles at 2:15 AM last Sunday. The guard on duty did not notice this person. Please review CCTV footage and improve night patrol schedule.',
    location: 'Parking Lot A, near Tower A entrance',
    images: [],
    reportedById: res6.id,
    flatId: flat('C401').id,
    societyId: society.id,
    assignedToId: admin.id,
    assignedAt: daysAgo(5),
    resolvedById: admin.id,
    resolvedAt: daysAgo(3),
    resolution: 'CCTV reviewed — person was a delivery vendor collecting his parked scooter. No security threat. Night patrol schedule updated to 30-min rounds.',
  }});

  await prisma.complaint.create({ data: {
    category: 'PLUMBING',
    priority: 'MEDIUM',
    status: 'OPEN',
    title: 'Low water pressure on Tower A 4th floor',
    description: 'Water pressure on Tower A 4th floor has been very low for the past 3 days. Morning shower barely works. Other floors seem to have normal pressure. Issue seems to be isolated to this floor.',
    location: 'Tower A, 4th floor — flats A401, A402, A403, A404',
    images: [],
    reportedById: res7.id,
    flatId: flat('B201').id,
    societyId: society.id,
  }});

  await prisma.complaint.create({ data: {
    category: 'MAINTENANCE',
    priority: 'LOW',
    status: 'OPEN',
    title: 'Broken gym treadmill handle',
    description: 'The handle grip on treadmill #2 in the gym is broken. One side of the handle has completely come off. This is a safety hazard. Please get it repaired or replaced before someone gets hurt.',
    location: 'Dalma Fitness Studio — treadmill #2',
    images: [],
    reportedById: res8.id,
    flatId: flat('A201').id,
    societyId: society.id,
  }});

  console.log('✅ 8 complaints\n');

  // ════════════════════════════════════════════════════════
  // EMERGENCIES
  // ════════════════════════════════════════════════════════
  console.log('🚨 Creating emergencies...');

  await prisma.emergency.create({ data: {
    type: 'LIFT_STUCK',
    status: 'RESOLVED',
    description: '3 residents stuck in Tower B lift between 4th and 5th floor. Lift stopped without warning. Resident called from inside. Technician called immediately.',
    location: 'Tower B lift — between floors 4 and 5',
    flatId: flat('B102').id,
    societyId: society.id,
    reportedById: res3.id,
    respondedById: admin.id,
    respondedAt: hoursAgo(48),
    resolvedAt: hoursAgo(47),
    notes: 'AMC technician arrived in 45 mins. Faulty relay replaced. Lift operational. Residents were safe throughout.',
    alertsSent: true,
    notifiedUsers: [admin.id, guard1.id, guard2.id],
  }});

  await prisma.emergency.create({ data: {
    type: 'MEDICAL',
    status: 'RESOLVED',
    description: 'Elderly resident in A501 collapsed in the corridor. Unconscious. Ambulance called immediately. Guard administered first aid using society first aid kit.',
    location: 'Tower A, 5th floor corridor near flat A501',
    societyId: society.id,
    reportedById: res1.id,
    respondedById: guard1.id,
    respondedAt: daysAgo(14),
    resolvedAt: daysAgo(14),
    notes: 'Resident taken to Ruby Hall Clinic. Fully recovered from low blood pressure episode. Family notified.',
    alertsSent: true,
    notifiedUsers: [admin.id, guard1.id, guard2.id, guard3.id],
  }});

  await prisma.emergency.create({ data: {
    type: 'FIRE',
    status: 'RESOLVED',
    description: 'Small fire in Tower C parking area. Resident noticed smoke from parked scooter. Fire extinguisher used immediately.',
    location: 'Tower C basement parking — near exit ramp',
    flatId: flat('C201').id,
    societyId: society.id,
    reportedById: res5.id,
    respondedById: guard3.id,
    respondedAt: daysAgo(5),
    resolvedAt: daysAgo(5),
    notes: 'Scooter electrical fire extinguished using dry powder extinguisher. No injuries. Vehicle owner (outside visitor) informed. CCTV footage saved.',
    alertsSent: true,
    notifiedUsers: [admin.id, guard1.id, guard2.id, guard3.id, res5.id],
  }});

  console.log('✅ 3 emergencies\n');

  // ════════════════════════════════════════════════════════
  // VENDORS
  // ════════════════════════════════════════════════════════
  console.log('🏪 Creating vendors...');
  const vendors = await Promise.all([
    prisma.vendor.create({ data: {
      name: 'Singh Plumbing Services',
      category: 'PLUMBER',
      phone: '9500000001',
      email: 'singh.plumbing@gmail.com',
      address: 'Shop 12, Bistupur Market, Jamshedpur 831001',
      description: '24x7 plumbing services. 15 years experience. Emergency calls accepted. All plumbing repairs and installations.',
      rating: 4.5,
      totalReviews: 62,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: '8:00 AM – 8:00 PM (Emergency 24x7)',
      hourlyRate: 500,
      minCharge: 300,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 24,
    }}),
    prisma.vendor.create({ data: {
      name: 'PowerFix Electricals',
      category: 'ELECTRICIAN',
      phone: '9500000002',
      email: 'powerfix@gmail.com',
      address: 'Mango Main Road, Jamshedpur 831012',
      description: 'Licensed electrician. Wiring, MCB replacement, inverter installation and all electrical repairs.',
      rating: 4.7,
      totalReviews: 48,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: '9:00 AM – 7:00 PM',
      hourlyRate: 600,
      minCharge: 400,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 31,
    }}),
    prisma.vendor.create({ data: {
      name: 'WoodCraft Carpentry',
      category: 'CARPENTER',
      phone: '9500000003',
      email: 'woodcraft@gmail.com',
      address: 'Sakchi, Jamshedpur 831001',
      description: 'Custom furniture, modular kitchen, wardrobes and all carpentry work. Free home visit for quotation.',
      rating: 4.3,
      totalReviews: 35,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: '9:00 AM – 6:00 PM',
      hourlyRate: 450,
      minCharge: 500,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 18,
    }}),
    prisma.vendor.create({ data: {
      name: 'ColourCraft Painters',
      category: 'PAINTER',
      phone: '9500000004',
      email: 'colourcraft@gmail.com',
      address: 'Bistupur, Jamshedpur 831001',
      description: 'Interior and exterior painting. Asian Paints and Berger authorized dealer. Free colour consultation and quotation.',
      rating: 4.6,
      totalReviews: 27,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: '8:00 AM – 6:00 PM',
      hourlyRate: 350,
      minCharge: 2000,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 15,
    }}),
    prisma.vendor.create({ data: {
      name: 'SparkClean Services',
      category: 'CLEANER',
      phone: '9500000005',
      email: 'sparkclean@gmail.com',
      address: 'Kadma, Jamshedpur 831005',
      description: 'Professional deep cleaning, sofa cleaning, carpet shampooing. Eco-friendly certified products used.',
      rating: 4.4,
      totalReviews: 41,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      workingHours: '7:00 AM – 8:00 PM',
      hourlyRate: 300,
      minCharge: 800,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 22,
    }}),
    prisma.vendor.create({ data: {
      name: 'GreenThumb Gardeners',
      category: 'GARDENER',
      phone: '9500000006',
      email: 'greenthumb@gmail.com',
      address: 'Mango, Jamshedpur 831012',
      description: 'Terrace gardens, indoor plants, society landscaping. Monthly AMC available. Plant supply also.',
      rating: 4.2,
      totalReviews: 19,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: '7:00 AM – 5:00 PM',
      hourlyRate: 250,
      minCharge: 500,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 11,
    }}),
    prisma.vendor.create({ data: {
      name: 'PestAway Solutions',
      category: 'PEST_CONTROL',
      phone: '9500000007',
      email: 'pestaway@gmail.com',
      address: 'Sonari, Jamshedpur 831001',
      description: 'AMC and one-time pest control. Government certified. Cockroach, termite, rat, and mosquito control.',
      rating: 4.8,
      totalReviews: 53,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: '8:00 AM – 6:00 PM',
      hourlyRate: 0,
      minCharge: 1500,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 38,
    }}),
    prisma.vendor.create({ data: {
      name: 'AppliFix Repair Centre',
      category: 'APPLIANCE_REPAIR',
      phone: '9500000008',
      email: 'applifix@gmail.com',
      address: 'Bistupur Main Road, Jamshedpur 831001',
      description: 'AC, washing machine, refrigerator, microwave and all appliance repair. All brands. Same-day service.',
      rating: 4.6,
      totalReviews: 76,
      isVerified: true,
      isActive: true,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      workingHours: '8:00 AM – 8:00 PM',
      hourlyRate: 0,
      minCharge: 350,
      societyId: society.id,
      addedById: admin.id,
      likesCount: 45,
    }}),
  ]);

  await prisma.vendorLike.createMany({ data: [
    { vendorId: vendors[0].id, userId: res1.id },
    { vendorId: vendors[1].id, userId: res2.id },
    { vendorId: vendors[1].id, userId: res3.id },
    { vendorId: vendors[1].id, userId: res8.id },
    { vendorId: vendors[6].id, userId: res4.id },
    { vendorId: vendors[6].id, userId: res5.id },
    { vendorId: vendors[7].id, userId: res6.id },
    { vendorId: vendors[7].id, userId: res7.id },
  ]});

  console.log('✅ 8 vendors + 8 likes\n');

  // ════════════════════════════════════════════════════════
  // VISITOR FREQUENCY
  // ════════════════════════════════════════════════════════
  console.log('👥 Creating visitor frequency...');
  await prisma.visitorFrequency.create({ data: {
    visitorPhone: '9840000001',
    visitorName: 'Ravi Shankar',
    flatId: flat('A101').id,
    societyId: society.id,
    visitCount: 8,
    lastVisit: hoursAgo(5),
    isFrequent: true,
  }});

  await prisma.visitorFrequency.create({ data: {
    visitorPhone: '9840000004',
    visitorName: 'Kumar Plumbing — Raju',
    flatId: flat('B401').id,
    societyId: society.id,
    visitCount: 3,
    lastVisit: hoursAgo(26),
    isFrequent: false,
  }});

  await prisma.visitorFrequency.create({ data: {
    visitorPhone: '9840000007',
    visitorName: 'Neha Kapoor',
    flatId: flat('A301').id,
    societyId: society.id,
    visitCount: 5,
    lastVisit: hoursAgo(0.5),
    isFrequent: true,
  }});

  await prisma.visitorFrequency.create({ data: {
    visitorPhone: '9840000009',
    visitorName: 'PowerFix Electrician',
    flatId: flat('A201').id,
    societyId: society.id,
    visitCount: 2,
    lastVisit: daysAgo(2),
    isFrequent: false,
  }});

  console.log('✅ 4 visitor frequency records\n');

  // ════════════════════════════════════════════════════════
  // COMMUNITY POSTS
  // ════════════════════════════════════════════════════════
  console.log('📣 Creating community posts...');

  const post1 = await prisma.communityPost.create({ data: {
    title: 'Diwali Celebration 2026 — Join Us!',
    content: 'Dear Dalma Heights family,\n\nWe are organizing a grand Diwali celebration on 20th October 2026 in the clubhouse. Rangoli competition, cultural performances, potluck dinner, and fireworks display!\n\nRSVP by 10th October at the admin office. Families with kids please register children for the drawing competition too.\n\nLet us celebrate together!',
    category: 'EVENT',
    isActive: true,
    isPinned: true,
    authorId: res1.id,
    societyId: society.id,
    likesCount: 18,
    commentsCount: 3,
  }});

  const post2 = await prisma.communityPost.create({ data: {
    title: 'LOST: Golden Retriever puppy — REWARD ₹5000',
    content: 'Our 8-month-old golden retriever "Mango" went missing from the C-block garden area yesterday around 6 PM. He is golden coloured, wearing a blue collar with a name tag.\n\nIf anyone has seen him please contact 9811000010 immediately. ₹5000 reward for information leading to his return.\n\nPlease check your parking areas, gardens, and stairwells.',
    category: 'LOST_FOUND',
    isActive: true,
    isPinned: false,
    authorId: res5.id,
    societyId: society.id,
    likesCount: 11,
    commentsCount: 2,
  }});

  const post3 = await prisma.communityPost.create({ data: {
    title: 'FREE: Books and children\'s toys — 3rd floor Tower A',
    content: 'Doing a spring clean! Giving away:\n• Around 50 books (English novels, management, science)\n• Children\'s toys: board games, Lego sets, puzzles\n• Some kitchen items in good condition\n\nAll free. Please take what you need. Items kept outside A301 from 6 PM to 9 PM today and tomorrow.',
    category: 'GENERAL',
    isActive: true,
    isPinned: false,
    authorId: res2.id,
    societyId: society.id,
    likesCount: 9,
    commentsCount: 1,
  }});

  const post4 = await prisma.communityPost.create({ data: {
    title: 'Free Yoga & Meditation — Every Weekday 6:30 AM',
    content: 'Starting a free yoga and meditation session every weekday morning at 6:30 AM in the garden area near Tower A.\n\nSuitable for all ages. No prior experience needed. Just bring a yoga mat.\n\nCall 9811000001 if interested. Let us start the day healthy together!',
    category: 'EVENT',
    isActive: true,
    isPinned: false,
    authorId: res1.id,
    societyId: society.id,
    likesCount: 15,
    commentsCount: 2,
  }});

  await prisma.communityPost.create({ data: {
    title: 'New Gym Equipment — Absolutely Fantastic!',
    content: 'Just wanted to share that the new gym equipment is absolutely fantastic! The LifeFitness treadmills are top-of-the-line. Big thanks to the management committee for this investment. The gym now genuinely feels like a proper fitness studio. Keep up the great work team!',
    category: 'APPRECIATION',
    isActive: true,
    isPinned: false,
    authorId: res3.id,
    societyId: society.id,
    likesCount: 7,
    commentsCount: 0,
  }});

  await prisma.communityPost.create({ data: {
    title: 'Summer Water Conservation — Let\'s All Do Our Part',
    content: 'With summer approaching, water scarcity is a real concern. Here are a few small things we can all do:\n\n1. Fix leaking taps and report them immediately\n2. Use washing machine only with full loads\n3. Water plants in the evening to reduce evaporation\n4. Report any common area water wastage to admin\n5. Consider fitting water-saving aerators on taps\n\nLet us be responsible. Every drop counts.',
    category: 'GENERAL',
    isActive: true,
    isPinned: false,
    authorId: admin.id,
    societyId: society.id,
    likesCount: 22,
    commentsCount: 0,
  }});

  await prisma.communityPost.create({ data: {
    title: 'Annual Badminton Tournament — Registrations Open!',
    content: 'Annual Dalma Heights Badminton Tournament 2026!\n\nCategories: Men\'s Singles, Ladies\' Singles, Mixed Doubles\nDate: 25th April 2026\nVenue: Multi-Sport Court\nEntry fee: ₹100 per category\n\nPrize money: ₹3000, ₹1500, ₹750 for top 3 positions.\n\nRegister by 20th April at admin office. Only 16 slots per category — register early!',
    category: 'EVENT',
    isActive: true,
    isPinned: false,
    authorId: res6.id,
    societyId: society.id,
    likesCount: 13,
    commentsCount: 0,
  }});

  await prisma.communityPost.create({ data: {
    title: 'Reminder — Please Respect Allocated Parking Slots',
    content: 'We have been receiving multiple complaints about vehicles parked in wrong slots or visitor areas for extended periods.\n\nAs per society rules:\n• Use ONLY your allocated parking slot\n• Visitors: maximum 3 hours in the visitor bay\n• Do NOT block fire lanes or emergency access\n• Display society sticker at all times\n\nViolators will be fined ₹500 per incident. Repeat offenders will have vehicles towed at owner\'s expense.\n\nCooperation appreciated.\n— Security Committee',
    category: 'ANNOUNCEMENT',
    isActive: true,
    isPinned: true,
    authorId: admin.id,
    societyId: society.id,
    likesCount: 8,
    commentsCount: 0,
  }});

  // Likes
  await prisma.postLike.createMany({ data: [
    { postId: post1.id, userId: res2.id },
    { postId: post1.id, userId: res3.id },
    { postId: post1.id, userId: res4.id },
    { postId: post2.id, userId: res1.id },
    { postId: post2.id, userId: res3.id },
    { postId: post3.id, userId: res4.id },
    { postId: post4.id, userId: res5.id },
    { postId: post4.id, userId: res6.id },
  ]});

  // Comments
  await prisma.postComment.createMany({ data: [
    { postId: post1.id, authorId: res2.id, content: 'Count us in! Our kids are super excited for the rangoli competition.', societyId: society.id },
    { postId: post1.id, authorId: res3.id, content: 'Will there be a dress code? We are planning to wear traditional outfits.', societyId: society.id },
    { postId: post1.id, authorId: res1.id, content: 'No mandatory dress code but traditional attire is preferred! Looking forward to it.', societyId: society.id },
    { postId: post2.id, authorId: res2.id, content: 'I will keep an eye out from my window. Hope Mango comes home soon!', societyId: society.id },
    { postId: post2.id, authorId: res4.id, content: 'Informed the building watchman. Will call you immediately if spotted.', societyId: society.id },
    { postId: post3.id, authorId: res1.id, content: 'Great initiative! Will swing by this evening. Very thoughtful of you.', societyId: society.id },
    { postId: post4.id, authorId: res2.id, content: 'Wonderful idea! I will join from tomorrow morning. See you there!', societyId: society.id },
    { postId: post4.id, authorId: res6.id, content: 'I have been wanting to start yoga for months. Perfect timing — count me in!', societyId: society.id },
  ]});

  console.log('✅ 8 posts + 8 likes + 8 comments\n');

  // ════════════════════════════════════════════════════════
  // SOCIETY DOCUMENTS
  // ════════════════════════════════════════════════════════
  console.log('📄 Creating society documents...');
  await prisma.societyDocument.createMany({ data: [
    {
      name: 'Society Bylaws 2024',
      description: 'Official bylaws governing Dalma Heights Residency society operations, rules, and regulations.',
      category: 'RULES_AND_BYLAWS',
      fileUrl: 'https://storage.dalmaheights.in/docs/bylaws-2024.pdf',
      fileKey: 'docs/bylaws-2024.pdf',
      fileName: 'Society_Bylaws_2024.pdf',
      fileSizeMB: 1.95,
      fileType: 'application/pdf',
      isAdminDoc: true,
      societyId: society.id,
      uploadedById: admin.id,
    },
    {
      name: 'Annual Maintenance Budget 2025-26',
      description: 'Detailed budget for society maintenance, infrastructure, and operations for FY 2025-26.',
      category: 'FINANCIAL',
      fileUrl: 'https://storage.dalmaheights.in/docs/budget-2025-26.pdf',
      fileKey: 'docs/budget-2025-26.pdf',
      fileName: 'Annual_Budget_2025-26.pdf',
      fileSizeMB: 1.46,
      fileType: 'application/pdf',
      isAdminDoc: true,
      societyId: society.id,
      uploadedById: admin.id,
    },
    {
      name: 'AGM Minutes — March 2026',
      description: 'Minutes of the Annual General Meeting held on 15 March 2026. Decisions and resolutions.',
      category: 'MEETING_MINUTES',
      fileUrl: 'https://storage.dalmaheights.in/docs/agm-march-2026.pdf',
      fileKey: 'docs/agm-march-2026.pdf',
      fileName: 'AGM_Minutes_March2026.pdf',
      fileSizeMB: 0.49,
      fileType: 'application/pdf',
      isAdminDoc: true,
      societyId: society.id,
      uploadedById: admin.id,
    },
    {
      name: 'Emergency Contact Directory 2026',
      description: 'Directory of all emergency contacts including hospitals, fire, police, and utility services.',
      category: 'OTHER',
      fileUrl: 'https://storage.dalmaheights.in/docs/emergency-contacts.pdf',
      fileKey: 'docs/emergency-contacts.pdf',
      fileName: 'Emergency_Contacts_2026.pdf',
      fileSizeMB: 0.24,
      fileType: 'application/pdf',
      isAdminDoc: false,
      societyId: society.id,
      uploadedById: admin.id,
    },
    {
      name: 'Flat A101 Sale Agreement',
      description: 'Registered sale agreement for Flat A101 — Amit Sinha.',
      category: 'LEGAL',
      fileUrl: 'https://storage.dalmaheights.in/docs/a101-sale-agreement.pdf',
      fileKey: 'docs/a101-sale-agreement.pdf',
      fileName: 'A101_Sale_Agreement.pdf',
      fileSizeMB: 2.93,
      fileType: 'application/pdf',
      isAdminDoc: false,
      societyId: society.id,
      uploadedById: res1.id,
    },
    {
      name: 'Flat B102 Rent Agreement',
      description: 'Rental agreement for Flat B102 — Vikram Prasad as tenant.',
      category: 'LEGAL',
      fileUrl: 'https://storage.dalmaheights.in/docs/b102-rent-agreement.pdf',
      fileKey: 'docs/b102-rent-agreement.pdf',
      fileName: 'B102_Rent_Agreement.pdf',
      fileSizeMB: 0.98,
      fileType: 'application/pdf',
      isAdminDoc: false,
      societyId: society.id,
      uploadedById: res3.id,
    },
    {
      name: 'Society Maintenance Schedule 2026',
      description: 'Annual maintenance schedule for lifts, generators, water tanks, and common areas.',
      category: 'MAINTENANCE',
      fileUrl: 'https://storage.dalmaheights.in/docs/maintenance-schedule-2026.pdf',
      fileKey: 'docs/maintenance-schedule-2026.pdf',
      fileName: 'Maintenance_Schedule_2026.pdf',
      fileSizeMB: 0.62,
      fileType: 'application/pdf',
      isAdminDoc: true,
      societyId: society.id,
      uploadedById: admin.id,
    },
  ]});
  console.log('✅ 7 documents\n');

  // ════════════════════════════════════════════════════════
  // POLLS
  // ════════════════════════════════════════════════════════
  console.log('🗳️ Creating polls...');

  const poll1 = await prisma.poll.create({ data: {
    title: 'Which day works best for the Diwali celebration?',
    description: 'Please vote for your preferred date so we can finalise the banquet hall booking and catering.',
    status: 'ACTIVE',
    isAnonymous: false,
    allowMultiple: false,
    votingEndsAt: daysFromNow(7),
    societyId: society.id,
    createdById: admin.id,
  }});

  await prisma.pollOption.createMany({ data: [
    { pollId: poll1.id, text: '18th October (Saturday)', votes: 12 },
    { pollId: poll1.id, text: '20th October (Monday — Diwali day)', votes: 28 },
    { pollId: poll1.id, text: '25th October (Saturday after Diwali)', votes: 7 },
  ]});

  const p1optsList = await prisma.pollOption.findMany({ where: { pollId: poll1.id } });
  await prisma.pollVote.createMany({ data: [
    { pollId: poll1.id, optionId: p1optsList[1].id, votedById: res1.id },
    { pollId: poll1.id, optionId: p1optsList[1].id, votedById: res2.id },
    { pollId: poll1.id, optionId: p1optsList[0].id, votedById: res3.id },
    { pollId: poll1.id, optionId: p1optsList[1].id, votedById: res4.id },
  ]});

  const poll2 = await prisma.poll.create({ data: {
    title: 'Should we install CCTV cameras in lift lobbies?',
    description: 'Following recent security concerns, the committee proposes installing CCTV cameras in all lift lobbies of Tower A, B, and C.',
    status: 'ACTIVE',
    isAnonymous: true,
    allowMultiple: false,
    votingEndsAt: daysFromNow(14),
    societyId: society.id,
    createdById: admin.id,
  }});

  await prisma.pollOption.createMany({ data: [
    { pollId: poll2.id, text: 'Yes — strongly support this', votes: 35 },
    { pollId: poll2.id, text: 'Yes — but with proper privacy safeguards', votes: 18 },
    { pollId: poll2.id, text: 'No — privacy concerns outweigh benefits', votes: 4 },
    { pollId: poll2.id, text: 'Need more information before deciding', votes: 9 },
  ]});

  const p2optsList = await prisma.pollOption.findMany({ where: { pollId: poll2.id } });
  await prisma.pollVote.createMany({ data: [
    { pollId: poll2.id, optionId: p2optsList[0].id, votedById: res1.id },
    { pollId: poll2.id, optionId: p2optsList[0].id, votedById: res2.id },
    { pollId: poll2.id, optionId: p2optsList[1].id, votedById: res3.id },
    { pollId: poll2.id, optionId: p2optsList[2].id, votedById: res5.id },
  ]});

  const poll3 = await prisma.poll.create({ data: {
    title: 'Rate the new gym equipment upgrade',
    description: 'Share your honest feedback on the newly upgraded gym equipment to help us plan future improvements.',
    status: 'CLOSED',
    isAnonymous: false,
    allowMultiple: false,
    votingEndsAt: daysAgo(1),
    societyId: society.id,
    createdById: admin.id,
  }});

  await prisma.pollOption.createMany({ data: [
    { pollId: poll3.id, text: 'Poor — expected much better quality', votes: 2 },
    { pollId: poll3.id, text: 'Good — usable but needs improvements', votes: 8 },
    { pollId: poll3.id, text: 'Very Good — happy with the upgrade', votes: 19 },
    { pollId: poll3.id, text: 'Excellent — best upgrade we have had!', votes: 31 },
  ]});

  console.log('✅ 3 polls + votes\n');

  // ════════════════════════════════════════════════════════
  // INVOICES
  // ════════════════════════════════════════════════════════
  console.log('💰 Creating invoices...');

  let paymentSeq = 1;
  const createPaymentTransaction = async (invoiceId: string, amount: number, paidAt: Date, label: string) => {
    const seq = String(paymentSeq++).padStart(3, '0');
    await prisma.paymentTransaction.create({ data: {
      status: 'SUCCESS',
      amount,
      currency: 'INR',
      cashfreeOrderId: `cf_order_${label}_${seq}`,
      cashfreeCfOrderId: `cf_${label}_${seq}`,
      cashfreePaymentId: `pay_${label}_${seq}`,
      paymentSessionId: `session_${label}_${seq}`,
      idempotencyKey: `seed_${label}_${seq}`,
      webhookEventType: 'PAYMENT_SUCCESS_WEBHOOK',
      webhookReceivedAt: paidAt,
      rawResponse: {
        order_status: 'PAID',
        payment_method: 'upi',
        payer_city: 'Jamshedpur',
      },
      rawWebhook: {
        event: 'PAYMENT_SUCCESS_WEBHOOK',
        source: 'seed',
        society: 'Dalma Heights Residency',
      },
      invoiceId,
      createdAt: paidAt,
    }});
  };
  const createUnpaidPaymentAttempt = async (
    invoiceId: string,
    amount: number,
    status: 'ACTIVE' | 'FAILED' | 'USER_DROPPED' | 'EXPIRED',
    label: string,
  ) => {
    const seq = String(paymentSeq++).padStart(3, '0');
    await prisma.paymentTransaction.create({ data: {
      status,
      amount,
      currency: 'INR',
      cashfreeOrderId: `cf_order_${label}_${seq}`,
      cashfreeCfOrderId: `cf_${label}_${seq}`,
      cashfreePaymentId: `pay_${label}_${seq}`,
      paymentSessionId: `session_${label}_${seq}`,
      idempotencyKey: `seed_${label}_${seq}`,
      webhookEventType: status === 'ACTIVE' ? 'PAYMENT_LINK_CREATED' : `PAYMENT_${status}`,
      webhookReceivedAt: hoursAgo(12),
      rawResponse: {
        order_status: status,
        payment_method: 'upi',
        payer_city: 'Jamshedpur',
      },
      rawWebhook: {
        event: status === 'ACTIVE' ? 'PAYMENT_LINK_CREATED' : `PAYMENT_${status}`,
        source: 'seed',
        society: 'Dalma Heights Residency',
      },
      invoiceId,
      createdAt: hoursAgo(12),
    }});
  };

  const invoiceFlats: Array<{ flat: any; status: 'PAID' | 'PENDING' | 'OVERDUE'; paidAt?: Date; penalty: number }> = [
    { flat: flat('A101'), status: 'PAID'    as const, paidAt: daysAgo(5),  penalty: 0   },
    { flat: flat('A201'), status: 'PAID'    as const, paidAt: daysAgo(3),  penalty: 0   },
    { flat: flat('A301'), status: 'PENDING' as const,                       penalty: 0   },
    { flat: flat('B102'), status: 'OVERDUE' as const,                       penalty: 200 },
    { flat: flat('B201'), status: 'PAID'    as const, paidAt: daysAgo(8),  penalty: 0   },
    { flat: flat('B401'), status: 'PAID'    as const, paidAt: daysAgo(10), penalty: 0   },
    { flat: flat('C201'), status: 'PENDING' as const,                       penalty: 0   },
    { flat: flat('C401'), status: 'OVERDUE' as const,                       penalty: 200 },
  ];

  for (const entry of invoiceFlats) {
    const inv = await prisma.invoice.create({ data: {
      month: 'April 2026',
      amount: 4500,
      penalty: entry.penalty,
      totalAmount: 4500 + entry.penalty,
      status: entry.status,
      description: 'Monthly maintenance fee — April 2026',
      dueDate: new Date('2026-04-05'),
      ...(entry.paidAt ? { paidAt: entry.paidAt } : {}),
      flatId: entry.flat.id,
      societyId: society.id,
    }});

    await prisma.invoiceLineItem.createMany({ data: [
      { invoiceId: inv.id, description: 'Monthly Maintenance Fee', amount: 4500 },
      ...(entry.penalty > 0 ? [{ invoiceId: inv.id, description: 'Late Payment Fee', amount: entry.penalty }] : []),
    ]});

    if (entry.status === 'PAID' && entry.paidAt) {
      await createPaymentTransaction(inv.id, 4500 + entry.penalty, entry.paidAt, `apr_${entry.flat.flatNumber.toLowerCase()}`);
    } else {
      const attemptStatusByFlat: Record<string, 'ACTIVE' | 'FAILED' | 'USER_DROPPED' | 'EXPIRED'> = {
        A301: 'ACTIVE',
        B102: 'FAILED',
        C201: 'USER_DROPPED',
        C401: 'EXPIRED',
      };
      await createUnpaidPaymentAttempt(
        inv.id,
        4500 + entry.penalty,
        attemptStatusByFlat[entry.flat.flatNumber],
        `apr_${entry.flat.flatNumber.toLowerCase()}_unpaid`,
      );
    }
  }

  // Also create March invoices (all PAID) for history
  const marchFlats = [flat('A101'), flat('A201'), flat('A301'), flat('B102'), flat('B201'), flat('B401'), flat('C201'), flat('C401')];
  for (const f of marchFlats) {
    const paidAt = daysAgo(35);
    const inv = await prisma.invoice.create({ data: {
      month: 'March 2026',
      amount: 4500,
      penalty: 0,
      totalAmount: 4500,
      status: 'PAID',
      description: 'Monthly maintenance fee — March 2026',
      dueDate: new Date('2026-03-05'),
      paidAt,
      flatId: f.id,
      societyId: society.id,
    }});
    await prisma.invoiceLineItem.create({ data: {
      invoiceId: inv.id,
      description: 'Monthly Maintenance Fee',
      amount: 4500,
    }});
    await createPaymentTransaction(inv.id, 4500, paidAt, `mar_${f.flatNumber.toLowerCase()}`);
  }

  console.log('✅ 16 invoices (8 April + 8 March) + 16 payment transactions (12 successful + 4 unpaid attempts)\n');

  // ════════════════════════════════════════════════════════
  // PAYMENT REMINDERS
  // ════════════════════════════════════════════════════════
  console.log('💳 Creating payment reminders...');
  await prisma.paymentReminder.createMany({ data: [
    { amount: 4500,   dueDate: new Date('2026-04-05'), isPaid: false,  societyId: society.id },
    { amount: 85000,  dueDate: daysFromNow(30),        isPaid: false,  societyId: society.id },
    { amount: 125000, dueDate: daysFromNow(45),        isPaid: false,  societyId: society.id },
    { amount: 4500,   dueDate: new Date('2026-03-05'), isPaid: true,   paidAt: daysAgo(35), societyId: society.id },
  ]});
  console.log('✅ 4 payment reminders\n');

  // ════════════════════════════════════════════════════════
  // GUEST INVITES
  // ════════════════════════════════════════════════════════
  console.log('🎟️ Creating guest invites...');

  const gi1 = await prisma.guestInvite.create({ data: {
    type: 'QUICK',
    status: 'ACTIVE',
    visitorName: 'Rahul Sinha',
    visitorPhone: '9900001111',
    validFrom: hoursFromNow(1),
    validUntil: hoursFromNow(6),
    allowedDays: [],
    timeFrom: '12:00',
    timeUntil: '20:00',
    passcode: rand6(),
    maxUses: 1,
    usedCount: 0,
    note: 'College friend visiting for lunch today',
    isPrivate: false,
    flatId: flat('A101').id,
    societyId: society.id,
    residentId: res1.id,
  }});

  await prisma.guestInvite.create({ data: {
    type: 'FREQUENT',
    status: 'ACTIVE',
    visitorName: 'Kavya Iyer',
    visitorPhone: '9900002222',
    validFrom: daysAgo(30),
    validUntil: daysFromNow(60),
    allowedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    timeFrom: '14:00',
    timeUntil: '19:00',
    passcode: rand6(),
    maxUses: 365,
    usedCount: 12,
    note: 'Piano teacher — visits twice weekly on Tuesday and Thursday',
    isPrivate: false,
    flatId: flat('B401').id,
    societyId: society.id,
    residentId: res4.id,
  }});

  await prisma.guestInvite.create({ data: {
    type: 'PRIVATE',
    status: 'ACTIVE',
    visitorName: 'Amazon Delivery Person',
    visitorPhone: '9900003333',
    validFrom: daysAgo(1),
    validUntil: daysFromNow(5),
    allowedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    timeFrom: '09:00',
    timeUntil: '19:00',
    passcode: rand6(),
    maxUses: 5,
    usedCount: 1,
    note: 'Expected Amazon deliveries this week — let in without calling resident',
    isPrivate: true,
    flatId: flat('C201').id,
    societyId: society.id,
    residentId: res5.id,
  }});

  await prisma.guestInvite.create({ data: {
    type: 'QUICK',
    status: 'EXPIRED',
    visitorName: 'Sundar Kumar',
    visitorPhone: '9900004444',
    validFrom: daysAgo(3),
    validUntil: daysAgo(2),
    allowedDays: [],
    timeFrom: '10:00',
    timeUntil: '18:00',
    passcode: rand6(),
    maxUses: 1,
    usedCount: 1,
    note: 'Brother visiting for a day',
    isPrivate: false,
    flatId: flat('A301').id,
    societyId: society.id,
    residentId: res2.id,
  }});

  // Guest entry log
  await prisma.guestEntryLog.create({ data: {
    guestInviteId: gi1.id,
    inviteType: 'GUEST_INVITE',
    flatId: flat('A101').id,
    guardId: guard1.id,
    visitorName: 'Rahul Sinha',
    visitorPhone: '9900001111',
    passcode: gi1.passcode,
    entryTime: hoursAgo(2),
    status: 'ALLOWED',
    societyId: society.id,
  }});

  console.log('✅ 4 guest invites + 1 entry log\n');

  // ════════════════════════════════════════════════════════
  // PARTY INVITE
  // ════════════════════════════════════════════════════════
  console.log('🎉 Creating party invite...');

  const partyCode = 'GRP-' + rand6().slice(0, 4);
  const party = await prisma.partyInvite.create({ data: {
    hostName: 'Amit & Kavita Sinha',
    validFrom: daysFromNow(5),
    validUntil: daysFromNow(5),
    venue: 'Grand Banquet Hall, Dalma Heights Residency',
    note: 'Dress code: Festive attire. No outside food or drinks.',
    theme: 1,
    maxGuests: 40,
    usedSlots: 5,
    status: 'ACTIVE',
    inviteCode: partyCode,
    inviteLink: `https://sgate.app/invite/${partyCode.toLowerCase()}`,
    flatId: flat('A101').id,
    societyId: society.id,
    residentId: res1.id,
  }});

  await prisma.partySlot.createMany({ data: [
    { partyInviteId: party.id, code: rand6(), phone: '9900005555', name: 'Rohan Mehta',    addedByResident: true,  claimedAt: daysAgo(1) },
    { partyInviteId: party.id, code: rand6(), phone: '9900006666', name: 'Sunita Tiwary',  addedByResident: true,  claimedAt: daysAgo(2) },
    { partyInviteId: party.id, code: rand6(), phone: '9900007777', name: 'Arjun Kapoor',   addedByResident: false, claimedAt: daysAgo(1) },
    { partyInviteId: party.id, code: rand6(), phone: '9900008888', name: 'Divya Singh',    addedByResident: false, claimedAt: daysAgo(1) },
    { partyInviteId: party.id, code: rand6(), phone: '9900009999', name: 'Sameer Gupta',   addedByResident: false, claimedAt: hoursAgo(3) },
  ]});

  console.log('✅ 1 party invite + 5 claimed slots\n');

  // ════════════════════════════════════════════════════════
  // PRE-APPROVED ENTRIES
  // ════════════════════════════════════════════════════════
  console.log('✅ Creating pre-approved entries...');

  // CAB — SAFE mode (vehicle digits verification)
  const preApproved1 = await prisma.preApprovedEntry.create({ data: {
    type: 'CAB',
    mode: 'SAFE',
    scheduleType: 'ONCE',
    status: 'ACTIVE',
    visitorName: 'Ola Cab Driver',
    visitorPhone: '9870000001',
    userId: res1.id,
    flatId: flat('A101').id,
    societyId: society.id,
  }});

  await prisma.preApprovedSchedule.create({ data: {
    entryId: preApproved1.id,
    validFrom: daysAgo(1),
    validUntil: daysFromNow(1),
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    timeFrom: '06:00',
    timeTo: '23:00',
  }});

  await prisma.preApprovedMeta.create({ data: {
    entryId: preApproved1.id,
    vehicleLast4Digits: '9999',
    companyName: 'Ola Cabs',
  }});

  await prisma.preApprovedVerification.create({ data: {
    entryId: preApproved1.id,
    verificationType: 'VEHICLE_LAST4',
    verificationValue: '9999',
  }});

  // DELIVERY — SURPRISE mode (resident not notified)
  const preApproved2 = await prisma.preApprovedEntry.create({ data: {
    type: 'DELIVERY',
    mode: 'SURPRISE',
    scheduleType: 'RECURRING',
    status: 'ACTIVE',
    visitorName: 'Amazon Delivery',
    visitorPhone: '9870000002',
    userId: res2.id,
    flatId: flat('A301').id,
    societyId: society.id,
  }});

  await prisma.preApprovedSchedule.create({ data: {
    entryId: preApproved2.id,
    validFrom: daysAgo(30),
    validUntil: daysFromNow(60),
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    timeFrom: '09:00',
    timeTo: '20:00',
  }});

  await prisma.preApprovedMeta.create({ data: {
    entryId: preApproved2.id,
    companyName: 'Amazon',
    isSurprise: true,
  }});

  await prisma.preApprovedVerification.create({ data: {
    entryId: preApproved2.id,
    verificationType: 'NONE',
  }});

  // HELP — NORMAL mode (personal driver, QR verification)
  const preApproved3 = await prisma.preApprovedEntry.create({ data: {
    type: 'HELP',
    mode: 'NORMAL',
    scheduleType: 'RECURRING',
    status: 'ACTIVE',
    visitorName: 'Ganesh Prasad',
    visitorPhone: '9700000003',
    userId: res4.id,
    flatId: flat('B401').id,
    societyId: society.id,
  }});

  await prisma.preApprovedSchedule.create({ data: {
    entryId: preApproved3.id,
    validFrom: daysAgo(60),
    validUntil: daysFromNow(120),
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    timeFrom: '07:30',
    timeTo: '10:30',
  }});

  await prisma.preApprovedMeta.create({ data: {
    entryId: preApproved3.id,
    category: 'OTHER',
    customCategory: 'Personal Driver',
    companyName: 'Personal Driver',
  }});

  await prisma.preApprovedVerification.create({ data: {
    entryId: preApproved3.id,
    verificationType: 'QR',
    verificationValue: driver1.qrToken,
  }});

  // DELIVERY — NORMAL mode (Swiggy/food delivery)
  const preApproved4 = await prisma.preApprovedEntry.create({ data: {
    type: 'DELIVERY',
    mode: 'NORMAL',
    scheduleType: 'RECURRING',
    status: 'ACTIVE',
    visitorName: 'Swiggy / Zomato Delivery',
    visitorPhone: '9870000004',
    userId: res5.id,
    flatId: flat('C201').id,
    societyId: society.id,
  }});

  await prisma.preApprovedSchedule.create({ data: {
    entryId: preApproved4.id,
    validFrom: daysAgo(7),
    validUntil: daysFromNow(30),
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    timeFrom: '12:00',
    timeTo: '22:00',
  }});

  await prisma.preApprovedMeta.create({ data: {
    entryId: preApproved4.id,
    companyName: 'Food Delivery',
  }});

  await prisma.preApprovedVerification.create({ data: {
    entryId: preApproved4.id,
    verificationType: 'OTP',
  }});

  console.log('✅ 4 pre-approved entries\n');

  // ════════════════════════════════════════════════════════
  // PARKING VIOLATIONS
  // ════════════════════════════════════════════════════════
  console.log('🚫 Creating parking violations...');

  await prisma.parkingViolation.create({ data: {
    vehicleId: veh5.id,
    vehicleNumber: 'JH05DD4001',
    type: 'WRONG_PARKING',
    source: 'OFFICIAL',
    status: 'RESOLVED',
    description: 'Vehicle parked in visitor bay for more than 3 hours during peak hours. Allocated slot was empty.',
    penaltyAmount: 500,
    addedToInvoice: false,
    reportedById: guard1.id,
    societyId: society.id,
    resolvedById: admin.id,
    resolvedAt: daysAgo(2),
    resolutionNote: 'Owner notified via app. Vehicle moved within 30 minutes. First offence — warning issued.',
  }});

  await prisma.parkingViolation.create({ data: {
    vehicleId: veh9.id,
    vehicleNumber: 'JH05HH8001',
    type: 'UNAUTHORIZED_SPOT',
    source: 'OFFICIAL',
    status: 'OPEN',
    description: 'Resident vehicle parked in allocated slot A-01 for 2 consecutive days without prior parking approval for that bay.',
    penaltyAmount: 1000,
    addedToInvoice: false,
    reportedById: guard2.id,
    societyId: society.id,
  }});

  await prisma.parkingViolation.create({ data: {
    vehicleId: veh4.id,
    vehicleNumber: 'JH05CC3001',
    type: 'NO_STICKER',
    source: 'COMPLAINT',
    status: 'NOTIFIED',
    description: 'Vehicle parked in Tower B area without a visible society sticker. Difficult to verify vehicle ownership or authorization.',
    reportedById: res3.id,
    societyId: society.id,
  }});

  await prisma.parkingViolation.create({ data: {
    vehicleId: veh2.id,
    vehicleNumber: 'JH05AA1002',
    type: 'BLOCKING_GATE',
    source: 'OFFICIAL',
    status: 'NOTIFIED',
    description: 'Bike parked blocking service gate access for more than 1 hour. Delivery van unable to enter. Guard had to manually manage traffic.',
    penaltyAmount: 300,
    addedToInvoice: false,
    reportedById: guard3.id,
    societyId: society.id,
  }});

  await prisma.parkingViolation.create({ data: {
    vehicleId: veh7.id,
    vehicleNumber: 'JH05FF6001',
    type: 'DOUBLE_PARKING',
    source: 'COMPLAINT',
    status: 'OPEN',
    description: "Resident's new car (pending sticker approval) found double parked — blocking two adjacent slots since yesterday night.",
    reportedById: res1.id,
    societyId: society.id,
  }});

  console.log('✅ 5 parking violations\n');

  // ════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ════════════════════════════════════════════════════════
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({ data: [
    {
      type: 'ENTRY_REQUEST',
      title: 'Visitor at Main Gate',
      message: 'Swiggy delivery boy is waiting at the main gate for your approval.',
      userId: res2.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'EntryRequest',
    },
    {
      type: 'ENTRY_REQUEST',
      title: 'Entry Request Approved',
      message: 'Priya Nair has been approved entry to your flat A301.',
      userId: res2.id,
      societyId: society.id,
      isRead: true,
      readAt: hoursAgo(1),
      referenceType: 'EntryRequest',
    },
    {
      type: 'EMERGENCY_ALERT',
      title: 'Emergency Alert — Lift Stuck',
      message: 'Residents stuck in Tower B lift. Technician has been called. Estimated time 45 minutes.',
      userId: res3.id,
      societyId: society.id,
      isRead: true,
      readAt: daysAgo(2),
      referenceType: 'Emergency',
    },
    {
      type: 'ONBOARDING_STATUS',
      title: 'Onboarding Approved',
      message: 'Congratulations! Your onboarding request has been approved. Welcome to Dalma Heights Residency!',
      userId: res1.id,
      societyId: society.id,
      isRead: true,
      readAt: daysAgo(30),
      referenceType: 'OnboardingRequest',
    },
    {
      type: 'STAFF_CHECKIN',
      title: 'Savita Bai Checked In',
      message: 'Your maid Savita Bai has checked in at your flat A101 at 8:05 AM.',
      userId: res1.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'DomesticStaff',
    },
    {
      type: 'PARKING_VIOLATION',
      title: 'Parking Violation Issued',
      message: 'Your vehicle JH05AA1002 has received a parking violation for blocking the service gate. Penalty: ₹300.',
      userId: res1.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'ParkingViolation',
    },
    {
      type: 'PARKING_COMPLAINT',
      title: 'New Parking Complaint Received',
      message: 'Vikram Prasad reported vehicle JH05CC3001 for missing society sticker.',
      userId: admin.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'ParkingViolation',
    },
    {
      type: 'SYSTEM',
      title: 'Gym Now Open for Bookings',
      message: 'The upgraded Dalma Fitness Studio is now available for slot booking via the app.',
      userId: res3.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'System',
    },
    {
      type: 'DELIVERY_REQUEST',
      title: 'Amazon Package Delivered',
      message: 'Your 2 Amazon packages have been delivered and logged at the main gate.',
      userId: res2.id,
      societyId: society.id,
      isRead: true,
      readAt: hoursAgo(26),
      referenceType: 'Entry',
    },
    {
      type: 'GUEST_ENTRY',
      title: 'Guest Entry Logged',
      message: 'Rahul Sinha entered your building using your guest invite passcode.',
      userId: res1.id,
      societyId: society.id,
      isRead: true,
      readAt: hoursAgo(2),
      referenceType: 'GuestEntryLog',
    },
    {
      type: 'ENTRY_REQUEST',
      title: 'Cab at Main Gate',
      message: 'Ola Cab driver Suresh Rathod is waiting at the main gate for pickup.',
      userId: res1.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'EntryRequest',
    },
    {
      type: 'SYSTEM',
      title: 'Monthly Invoice Generated',
      message: 'Your April 2026 maintenance invoice of ₹4,500 has been generated. Due by 5th April.',
      userId: res3.id,
      societyId: society.id,
      isRead: false,
      referenceType: 'Invoice',
    },
  ]});
  console.log('✅ 12 notifications\n');

  // ════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════
  console.log('\n🎉 Seed completed successfully!\n');
  console.log('═'.repeat(55));
  console.log('       DALMA HEIGHTS RESIDENCY — JAMSHEDPUR');
  console.log('═'.repeat(55));
  console.log(`  Society:        Dalma Heights Residency, Jamshedpur`);
  console.log(`  Gate Points:    2 (Main Gate + Service Gate)`);
  console.log(`  Blocks:         4 (Tower A, B, C + Admin)`);
  console.log(`  Flats:          ${allFlats.length} residential + 1 Admin Office`);
  console.log(`  Users:          16 (1 super, 1 admin, 3 guards, 11 residents/family)`);
  console.log(`  Flat Members:   12`);
  console.log(`  Vehicles:       9`);
  console.log(`  Amenities:      6`);
  console.log(`  Bookings:       8`);
  console.log(`  Domestic Staff: 7`);
  console.log(`  Staff Assign:   11`);
  console.log(`  Attendance:     21 records`);
  console.log(`  Staff Reviews:  6`);
  console.log(`  Staff Bookings: 4`);
  console.log(`  Gate Passes:    4`);
  console.log(`  Entries:        9`);
  console.log(`  Entry Requests: 8 (4 pending, 2 approved, 1 rejected, 1 expired)`);
  console.log(`  Notices:        7`);
  console.log(`  Complaints:     8`);
  console.log(`  Emergencies:    3`);
  console.log(`  Vendors:        8`);
  console.log(`  Guest Invites:  4`);
  console.log(`  Party Invite:   1 (5 slots)`);
  console.log(`  Pre-Approved:   4`);
  console.log(`  Parking Viol:   5`);
  console.log(`  Invoices:       16 (8 April + 8 March)`);
  console.log(`  Payment Txns:   16 (12 success + 4 unpaid attempts)`);
  console.log(`  Posts:          8 + 8 likes + 8 comments`);
  console.log(`  Polls:          3`);
  console.log(`  Documents:      7`);
  console.log(`  Notifications:  12`);
  console.log('═'.repeat(55));
  console.log('\n🔑 LOGIN ACCOUNTS:');
  console.log('─'.repeat(55));
  console.log('SUPER ADMIN:     9999900000');
  console.log('ADMIN:           6202923165  (Agastya Kumar)');
  console.log('GUARD 1:         9800000001  (Rajendra Singh)');
  console.log('GUARD 2:         9800000002  (Suresh Mahto)');
  console.log('GUARD 3:         9800000003  (Manoj Kumar)');
  console.log('─'.repeat(55));
  console.log('RESIDENTS:');
  console.log('  9811000001  Amit Sinha           A101  (Owner, Primary)');
  console.log('  9811000002  Kavita Sinha         A101  (Spouse)');
  console.log('  9811000013  Rajan Verma           A201  (Owner, Primary)');
  console.log('  9811000014  Aryan Verma           A201  (Son/Child)');
  console.log('  9811000004  Dr. Sneha Singh      A301  (Owner, Primary)');
  console.log('  9811000006  Vikram Prasad        B102  (Tenant, Primary)');
  console.log('  9811000012  Anita Gupta          B201  (Owner, Primary)');
  console.log('  9811000008  Mohan Agarwal        B401  (Owner, Primary)');
  console.log('  9811000010  Priya Kumari         C201  (Owner, Primary)');
  console.log('  9811000011  Kartik Mahto         C401  (Owner, Primary)');
  console.log('  9006412619  Javed Khan            B301  (Tenant, Primary)');
  console.log('═'.repeat(55));
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
