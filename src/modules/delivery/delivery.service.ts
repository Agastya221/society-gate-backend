import { prisma } from '../../utils/Client';

export class DeliveryService {
  // Resident creates expected delivery
  async createExpectedDelivery(data: any, userId: string) {
    const expectedDelivery = await prisma.expectedDelivery.create({
      data: {
        ...data,
        createdById: userId,
      },
    });

    return expectedDelivery;
  }

  // Resident sets auto-approve rule
  async createAutoApproveRule(data: any, userId: string) {
    const rule = await prisma.deliveryAutoApproveRule.create({
      data: {
        ...data,
        createdById: userId,
      },
    });

    return rule;
  }

  // Get auto-approve rules for a flat
  async getAutoApproveRules(flatId: string) {
    const rules = await prisma.deliveryAutoApproveRule.findMany({
      where: { flatId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return rules;
  }

  // Toggle auto-approve rule
  async toggleAutoApproveRule(ruleId: string, isActive: boolean) {
    const rule = await prisma.deliveryAutoApproveRule.update({
      where: { id: ruleId },
      data: { isActive },
    });

    return rule;
  }

  // Delete auto-approve rule
  async deleteAutoApproveRule(ruleId: string) {
    await prisma.deliveryAutoApproveRule.delete({
      where: { id: ruleId },
    });
  }

  // Get expected deliveries for a flat
  async getExpectedDeliveries(flatId: string) {
    const deliveries = await prisma.expectedDelivery.findMany({
      where: {
        flatId,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { expectedDate: 'asc' },
    });

    return deliveries;
  }

  // Popular delivery companies in India
  getPopularCompanies() {
    return [
      { value: 'Swiggy', label: 'Swiggy', icon: '🍔' },
      { value: 'Zomato', label: 'Zomato', icon: '🍕' },
      { value: 'Amazon', label: 'Amazon', icon: '📦' },
      { value: 'Flipkart', label: 'Flipkart', icon: '🛒' },
      { value: 'BigBasket', label: 'BigBasket', icon: '🥬' },
      { value: 'Blinkit', label: 'Blinkit', icon: '⚡' },
      { value: 'Dunzo', label: 'Dunzo', icon: '🚴' },
      { value: 'Zepto', label: 'Zepto', icon: '⏱️' },
      { value: 'BlueDart', label: 'BlueDart', icon: '📮' },
      { value: 'DTDC', label: 'DTDC', icon: '📫' },
      { value: 'Delhivery', label: 'Delhivery', icon: '🚚' },
      { value: 'Other', label: 'Other', icon: '📦' },
    ];
  }
}