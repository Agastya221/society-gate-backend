"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("../src/utils/Client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const QrGenerate_1 = require("../src/utils/QrGenerate");
async function main() {
    console.log('🌱 Starting seed...');
    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await Client_1.prisma.$transaction([
        Client_1.prisma.staffReview.deleteMany(),
        Client_1.prisma.staffBooking.deleteMany(),
        Client_1.prisma.staffAttendance.deleteMany(),
        Client_1.prisma.staffFlatAssignment.deleteMany(),
        Client_1.prisma.domesticStaff.deleteMany(),
        Client_1.prisma.vendorReview.deleteMany(),
        Client_1.prisma.vendor.deleteMany(),
        Client_1.prisma.emergencyAlert.deleteMany(),
        Client_1.prisma.complaint.deleteMany(),
        Client_1.prisma.amenityBooking.deleteMany(),
        Client_1.prisma.amenity.deleteMany(),
        Client_1.prisma.notice.deleteMany(),
        Client_1.prisma.gatePass.deleteMany(),
        Client_1.prisma.deliveryAutoApproveRule.deleteMany(),
        Client_1.prisma.expectedDelivery.deleteMany(),
        Client_1.prisma.preApproval.deleteMany(),
        Client_1.prisma.entry.deleteMany(),
        Client_1.prisma.frequentVisitor.deleteMany(),
        Client_1.prisma.vehicle.deleteMany(),
        Client_1.prisma.user.deleteMany(),
        Client_1.prisma.flat.deleteMany(),
        Client_1.prisma.gatePoint.deleteMany(),
        Client_1.prisma.society.deleteMany(),
    ]);
    // Create society
    console.log('🏢 Creating society...');
    const society = await Client_1.prisma.society.create({
        data: {
            name: "Green Valley Apartments",
            address: "Boring Road, Patna",
            city: "Patna",
            state: "Bihar",
            pincode: "800001",
            contactName: "Rajesh Kumar",
            contactPhone: "9876543210",
            contactEmail: "contact@greenvalley.com",
            totalFlats: 50,
            monthlyFee: 500,
            nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }
    });
    // Create gate points
    const mainGate = await Client_1.prisma.gatePoint.create({
        data: {
            name: "Main Gate",
            societyId: society.id
        }
    });
    const backGate = await Client_1.prisma.gatePoint.create({
        data: {
            name: "Back Gate",
            societyId: society.id
        }
    });
    // Create flats
    console.log('🏠 Creating flats...');
    const flatA101 = await Client_1.prisma.flat.create({
        data: {
            flatNumber: "A-101",
            block: "A",
            floor: "1",
            ownerName: "Amit Kumar",
            ownerPhone: "9123456789",
            societyId: society.id
        }
    });
    const flatA102 = await Client_1.prisma.flat.create({
        data: {
            flatNumber: "A-102",
            block: "A",
            floor: "1",
            ownerName: "Priya Singh",
            ownerPhone: "9988776655",
            societyId: society.id
        }
    });
    const flatB201 = await Client_1.prisma.flat.create({
        data: {
            flatNumber: "B-201",
            block: "B",
            floor: "2",
            ownerName: "Rahul Sharma",
            ownerPhone: "9876501111",
            societyId: society.id
        }
    });
    // Create users
    console.log('👥 Creating users...');
    const superAdmin = await Client_1.prisma.user.create({
        data: {
            name: "Super Admin",
            phone: "9999999999",
            email: "admin@societygate.com",
            password: await bcryptjs_1.default.hash("admin123", 10),
            role: "SUPER_ADMIN",
            societyId: society.id
        }
    });
    const admin = await Client_1.prisma.user.create({
        data: {
            name: "Rajesh Kumar",
            phone: "9876543210",
            email: "rajesh@greenvalley.com",
            password: await bcryptjs_1.default.hash("admin123", 10),
            role: "ADMIN",
            societyId: society.id
        }
    });
    const guard = await Client_1.prisma.user.create({
        data: {
            name: "Ramesh Guard",
            phone: "9111222333",
            password: await bcryptjs_1.default.hash("guard123", 10),
            role: "GUARD",
            societyId: society.id
        }
    });
    const resident1 = await Client_1.prisma.user.create({
        data: {
            name: "Amit Kumar",
            phone: "9123456789",
            email: "amit@example.com",
            password: await bcryptjs_1.default.hash("resident123", 10),
            role: "RESIDENT",
            isOwner: true,
            flatId: flatA101.id,
            societyId: society.id
        }
    });
    const resident2 = await Client_1.prisma.user.create({
        data: {
            name: "Priya Singh",
            phone: "9988776655",
            email: "priya@example.com",
            password: await bcryptjs_1.default.hash("resident123", 10),
            role: "RESIDENT",
            isOwner: true,
            flatId: flatA102.id,
            societyId: society.id
        }
    });
    const resident3 = await Client_1.prisma.user.create({
        data: {
            name: "Rahul Sharma",
            phone: "9876501111",
            email: "rahul@example.com",
            password: await bcryptjs_1.default.hash("resident123", 10),
            role: "RESIDENT",
            isOwner: true,
            flatId: flatB201.id,
            societyId: society.id
        }
    });
    // Create domestic staff
    console.log('👩‍🔧 Creating domestic staff...');
    const maid1 = await Client_1.prisma.domesticStaff.create({
        data: {
            name: "Sunita Devi",
            phone: "9876501234",
            staffType: "MAID",
            workingDays: ["MON", "WED", "FRI"],
            workStartTime: "09:00",
            workEndTime: "17:00",
            qrToken: "STAFF-SUNITA",
            isActive: true,
            isVerified: true,
            hourlyRate: 150,
            dailyRate: 1000,
            monthlyRate: 25000,
            rating: 4.5,
            totalReviews: 12,
            experienceYears: 5,
            languages: ["Hindi", "English"],
            description: "Experienced house maid with 5 years of experience",
            societyId: society.id,
            addedById: resident1.id
        }
    });
    const cook = await Client_1.prisma.domesticStaff.create({
        data: {
            name: "Raju Chef",
            phone: "9876502345",
            staffType: "COOK",
            workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
            workStartTime: "08:00",
            workEndTime: "20:00",
            qrToken: "STAFF-RAJU",
            isActive: true,
            isVerified: true,
            hourlyRate: 200,
            dailyRate: 1500,
            monthlyRate: 35000,
            rating: 4.8,
            totalReviews: 20,
            experienceYears: 10,
            languages: ["Hindi", "English", "Punjabi"],
            description: "Expert cook specializing in North Indian cuisine",
            societyId: society.id,
            addedById: admin.id
        }
    });
    const nanny = await Client_1.prisma.domesticStaff.create({
        data: {
            name: "Geeta Devi",
            phone: "9876503456",
            staffType: "NANNY",
            workingDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
            workStartTime: "07:00",
            workEndTime: "19:00",
            qrToken: "STAFF-GEETA",
            isActive: true,
            isVerified: true,
            hourlyRate: 180,
            dailyRate: 1200,
            monthlyRate: 30000,
            rating: 4.9,
            totalReviews: 15,
            experienceYears: 8,
            languages: ["Hindi", "English"],
            description: "Caring and experienced nanny for children",
            availabilityStatus: "AVAILABLE",
            societyId: society.id,
            addedById: resident2.id
        }
    });
    // Assign staff to flats
    await Client_1.prisma.staffFlatAssignment.create({
        data: {
            domesticStaffId: maid1.id,
            flatId: flatA101.id,
            isPrimary: true,
            workingDays: ["MON", "WED", "FRI"],
            workStartTime: "09:00",
            workEndTime: "17:00",
            agreedRate: 25000,
            rateType: "MONTHLY",
            isActive: true
        }
    });
    await Client_1.prisma.staffFlatAssignment.create({
        data: {
            domesticStaffId: cook.id,
            flatId: flatA102.id,
            isPrimary: true,
            workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
            agreedRate: 35000,
            rateType: "MONTHLY",
            isActive: true
        }
    });
    // Create amenities
    console.log('🏊 Creating amenities...');
    const swimmingPool = await Client_1.prisma.amenity.create({
        data: {
            name: "Swimming Pool",
            description: "Olympic size swimming pool with changing rooms",
            amenityType: "SWIMMING_POOL",
            capacity: 50,
            bookingFee: 500,
            advanceBookingDays: 7,
            minBookingHours: 1,
            maxBookingHours: 3,
            availableFrom: "06:00",
            availableUntil: "22:00",
            maxBookingsPerUser: 2,
            isActive: true,
            societyId: society.id
        }
    });
    const clubhouse = await Client_1.prisma.amenity.create({
        data: {
            name: "Clubhouse",
            description: "Party hall for events and celebrations",
            amenityType: "CLUBHOUSE",
            capacity: 100,
            bookingFee: 2000,
            advanceBookingDays: 30,
            minBookingHours: 4,
            maxBookingHours: 12,
            availableFrom: "10:00",
            availableUntil: "23:00",
            maxBookingsPerUser: 1,
            isActive: true,
            societyId: society.id
        }
    });
    const gym = await Client_1.prisma.amenity.create({
        data: {
            name: "Fitness Center",
            description: "Fully equipped gym with trainer",
            amenityType: "GYM",
            capacity: 20,
            bookingFee: 0,
            advanceBookingDays: 1,
            minBookingHours: 1,
            maxBookingHours: 2,
            availableFrom: "05:00",
            availableUntil: "22:00",
            maxBookingsPerUser: 7,
            isActive: true,
            societyId: society.id
        }
    });
    // Create notices
    console.log('📢 Creating notices...');
    await Client_1.prisma.notice.create({
        data: {
            title: "Water Supply Maintenance",
            description: "Water supply will be suspended on Sunday from 10 AM to 2 PM for maintenance work.",
            category: "MAINTENANCE",
            priority: "HIGH",
            publishAt: new Date(),
            expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            isActive: true,
            isPinned: true,
            societyId: society.id,
            createdById: admin.id
        }
    });
    await Client_1.prisma.notice.create({
        data: {
            title: "Society Annual Meeting",
            description: "The annual general meeting will be held on 20th January at 6 PM in the clubhouse. All residents are requested to attend.",
            category: "MEETING",
            priority: "MEDIUM",
            publishAt: new Date(),
            expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            isActive: true,
            isPinned: true,
            societyId: society.id,
            createdById: admin.id
        }
    });
    await Client_1.prisma.notice.create({
        data: {
            title: "Holi Celebration",
            description: "Join us for Holi celebration on 15th March. Fun activities for kids and adults!",
            category: "EVENT",
            priority: "LOW",
            publishAt: new Date(),
            expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            isActive: true,
            societyId: society.id,
            createdById: admin.id
        }
    });
    // Create vendors
    console.log('🔧 Creating vendors...');
    await Client_1.prisma.vendor.create({
        data: {
            name: "Quick Plumber Services",
            phone: "9123450001",
            email: "quickplumber@example.com",
            category: "PLUMBER",
            description: "24/7 plumbing services for all your needs",
            rating: 4.5,
            totalReviews: 25,
            isVerified: true,
            isActive: true,
            societyId: society.id,
            addedById: admin.id
        }
    });
    await Client_1.prisma.vendor.create({
        data: {
            name: "City Electricians",
            phone: "9123450002",
            email: "cityelectric@example.com",
            category: "ELECTRICIAN",
            description: "Licensed electricians for all electrical work",
            rating: 4.7,
            totalReviews: 18,
            isVerified: true,
            isActive: true,
            societyId: society.id,
            addedById: admin.id
        }
    });
    // Create delivery auto-approve rules
    console.log('📦 Creating delivery rules...');
    await Client_1.prisma.deliveryAutoApproveRule.create({
        data: {
            companies: ["Swiggy", "Zomato", "Amazon"],
            timeFrom: "08:00",
            timeUntil: "23:00",
            flatId: flatA101.id,
            societyId: society.id,
            createdById: resident1.id
        }
    });
    // Create pre-approvals
    console.log('✅ Creating pre-approvals...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);
    await Client_1.prisma.preApproval.create({
        data: {
            visitorName: "Vikram Malhotra",
            visitorPhone: "9876599999",
            vehicleNumber: "BR01AB1234",
            purpose: "Family visit",
            validFrom: tomorrow,
            validUntil: nextWeek,
            maxUses: 5,
            usedCount: 0,
            status: "ACTIVE",
            qrToken: (0, QrGenerate_1.generateQRToken)({ name: "Vikram", phone: "9876599999", type: "PRE_APPROVAL" }),
            flatId: flatA101.id,
            societyId: society.id,
            createdById: resident1.id
        }
    });
    // Create some sample entries
    console.log('🚪 Creating sample entries...');
    await Client_1.prisma.entry.create({
        data: {
            type: "VISITOR",
            visitorName: "Deepak Sharma",
            visitorPhone: "9876588888",
            vehicleNumber: "BR01XY5678",
            purpose: "Personal visit",
            checkInTime: new Date(),
            status: "APPROVED",
            approvalStatus: "APPROVED",
            approvedAt: new Date(),
            flatId: flatA102.id,
            societyId: society.id,
            createdById: guard.id,
            approvedById: resident2.id,
            gatePointId: mainGate.id
        }
    });
    await Client_1.prisma.entry.create({
        data: {
            type: "DELIVERY",
            companyName: "Amazon",
            visitorName: "Delivery Boy",
            visitorPhone: "9876577777",
            purpose: "Package delivery",
            checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
            checkOutTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
            status: "CHECKED_OUT",
            approvalStatus: "APPROVED",
            wasAutoApproved: true,
            autoApprovalReason: "Standing rule",
            approvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            flatId: flatA101.id,
            societyId: society.id,
            createdById: guard.id,
            gatePointId: mainGate.id
        }
    });
    console.log('\n✅ Seed completed successfully!');
    console.log('\n📱 === TEST ACCOUNTS ===');
    console.log('─'.repeat(50));
    console.log('🔐 Super Admin:');
    console.log('   Email: admin@societygate.com');
    console.log('   Phone: 9999999999');
    console.log('   Password: admin123');
    console.log();
    console.log('🔐 Society Admin:');
    console.log('   Email: rajesh@greenvalley.com');
    console.log('   Phone: 9876543210');
    console.log('   Password: admin123');
    console.log();
    console.log('🔐 Guard:');
    console.log('   Phone: 9111222333');
    console.log('   Password: guard123');
    console.log();
    console.log('🔐 Residents:');
    console.log('   Amit Kumar (A-101)');
    console.log('   Phone: 9123456789');
    console.log('   Password: resident123');
    console.log();
    console.log('   Priya Singh (A-102)');
    console.log('   Phone: 9988776655');
    console.log('   Password: resident123');
    console.log();
    console.log('   Rahul Sharma (B-201)');
    console.log('   Phone: 9876501111');
    console.log('   Password: resident123');
    console.log('─'.repeat(50));
    console.log('\n🏢 Society: Green Valley Apartments');
    console.log('📍 Location: Patna, Bihar');
    console.log('🏠 Flats: A-101, A-102, B-201');
    console.log('👥 Staff: 3 domestic staff members');
    console.log('🏊 Amenities: Swimming Pool, Clubhouse, Gym');
    console.log('📢 Notices: 3 active notices');
    console.log('🔧 Vendors: 2 verified vendors');
    console.log('\n🚀 Start the server with: npm run dev');
    console.log('📖 API Docs: http://localhost:4000/api-docs');
    console.log();
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await Client_1.prisma.$disconnect();
});
