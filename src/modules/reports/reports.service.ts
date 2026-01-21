import { prisma } from '../../utils/Client';

export class ReportsService {
  // Dashboard overview stats
  async getDashboardStats(societyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalResidents,
      totalFlats,
      totalGuards,
      todayEntries,
      pendingEntries,
      activeGatePasses,
      openComplaints,
      activeEmergencies,
      todayNotices,
    ] = await Promise.all([
      prisma.user.count({ where: { societyId, role: 'RESIDENT', isActive: true } }),
      prisma.flat.count({ where: { societyId } }),
      prisma.user.count({ where: { societyId, role: 'GUARD', isActive: true } }),
      prisma.entry.count({
        where: {
          societyId,
          checkInTime: { gte: today, lt: tomorrow },
        },
      }),
      prisma.entry.count({ where: { societyId, status: 'PENDING' } }),
      prisma.gatePass.count({ where: { societyId, status: 'APPROVED' } }),
      prisma.complaint.count({ where: { societyId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.emergency.count({ where: { societyId, status: 'ACTIVE' } }),
      prisma.notice.count({
        where: {
          societyId,
          publishAt: { gte: today, lt: tomorrow },
        },
      }),
    ]);

    return {
      users: {
        totalResidents,
        totalGuards,
      },
      totalFlats,
      entries: {
        today: todayEntries,
        pending: pendingEntries,
      },
      gatePasses: {
        active: activeGatePasses,
      },
      complaints: {
        open: openComplaints,
      },
      emergencies: {
        active: activeEmergencies,
      },
      notices: {
        today: todayNotices,
      },
    };
  }

  // Entry statistics
  async getEntryStatistics(societyId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const entries = await prisma.entry.findMany({
      where: {
        societyId,
        checkInTime: { gte: startDate },
      },
      select: {
        type: true,
        status: true,
        checkInTime: true,
      },
    });

    // Group by date
    const byDate: any = {};
    const byType: any = {};
    const byStatus: any = {};

    entries.forEach((entry) => {
      const date = entry.checkInTime.toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    });

    return {
      total: entries.length,
      byDate,
      byType,
      byStatus,
      avgPerDay: (entries.length / days).toFixed(1),
    };
  }

  // Peak hours analysis
  async getPeakHoursAnalysis(societyId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const entries = await prisma.entry.findMany({
      where: {
        societyId,
        checkInTime: { gte: startDate },
      },
      select: {
        checkInTime: true,
      },
    });

    const hourlyData: any = {};
    entries.forEach((entry) => {
      const hour = entry.checkInTime.getHours();
      hourlyData[hour] = (hourlyData[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourlyData)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }));

    return {
      hourlyData,
      peakHours,
    };
  }

  // Delivery patterns
  async getDeliveryPatterns(societyId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deliveries = await prisma.entry.findMany({
      where: {
        societyId,
        type: 'DELIVERY',
        checkInTime: { gte: startDate },
      },
      select: {
        companyName: true,
        checkInTime: true,
        wasAutoApproved: true,
      },
    });

    const byCompany: any = {};
    deliveries.forEach((delivery) => {
      if (delivery.companyName) {
        byCompany[delivery.companyName] = (byCompany[delivery.companyName] || 0) + 1;
      }
    });

    const topCompanies = Object.entries(byCompany)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 10)
      .map(([company, count]) => ({ company, count }));

    const autoApprovedCount = deliveries.filter((d) => d.wasAutoApproved).length;

    return {
      total: deliveries.length,
      byCompany,
      topCompanies,
      autoApproved: autoApprovedCount,
      autoApprovalRate: ((autoApprovedCount / deliveries.length) * 100).toFixed(1),
    };
  }

  // Complaint statistics
  async getComplaintStatistics(societyId: string) {
    const complaints = await prisma.complaint.findMany({
      where: { societyId },
      select: {
        category: true,
        status: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const byCategory: any = {};
    const byStatus: any = {};
    const byPriority: any = {};

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    complaints.forEach((complaint) => {
      byCategory[complaint.category] = (byCategory[complaint.category] || 0) + 1;
      byStatus[complaint.status] = (byStatus[complaint.status] || 0) + 1;
      byPriority[complaint.priority] = (byPriority[complaint.priority] || 0) + 1;

      if (complaint.resolvedAt) {
        const resolutionTime = complaint.resolvedAt.getTime() - complaint.createdAt.getTime();
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    });

    const avgResolutionHours = resolvedCount > 0
      ? (totalResolutionTime / resolvedCount / (1000 * 60 * 60)).toFixed(1)
      : 0;

    return {
      total: complaints.length,
      byCategory,
      byStatus,
      byPriority,
      avgResolutionHours,
      resolvedCount,
    };
  }

  // Visitor frequency report
  async getVisitorFrequencyReport(societyId: string) {
    const frequentVisitors = await prisma.visitorFrequency.findMany({
      where: {
        societyId,
        isFrequent: true,
      },
      include: {
        flat: true,
      },
      orderBy: { visitCount: 'desc' },
      take: 20,
    });

    return frequentVisitors;
  }

  // Society health score
  async getSocietyHealthScore(societyId: string) {
    const [
      openComplaints,
      totalComplaints,
      activeEmergencies,
      pendingEntries,
      totalEntries,
    ] = await Promise.all([
      prisma.complaint.count({ where: { societyId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.complaint.count({ where: { societyId } }),
      prisma.emergency.count({ where: { societyId, status: 'ACTIVE' } }),
      prisma.entry.count({ where: { societyId, status: 'PENDING' } }),
      prisma.entry.count({ where: { societyId } }),
    ]);

    let score = 100;

    // Deduct for open complaints
    if (totalComplaints > 0) {
      score -= (openComplaints / totalComplaints) * 20;
    }

    // Deduct for active emergencies
    score -= activeEmergencies * 10;

    // Deduct for pending entries backlog
    if (totalEntries > 0) {
      const pendingRate = pendingEntries / totalEntries;
      if (pendingRate > 0.1) {
        score -= 10;
      }
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score: score.toFixed(0),
      factors: {
        complaints: {
          open: openComplaints,
          total: totalComplaints,
        },
        emergencies: {
          active: activeEmergencies,
        },
        entries: {
          pending: pendingEntries,
          pendingRate: totalEntries > 0 ? ((pendingEntries / totalEntries) * 100).toFixed(1) : 0,
        },
      },
    };
  }
}
