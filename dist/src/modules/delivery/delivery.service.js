"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryService = void 0;
const Client_1 = require("../../utils/Client");
class DeliveryService {
    // Resident creates expected delivery
    async createExpectedDelivery(data, userId) {
        const expectedDelivery = await Client_1.prisma.expectedDelivery.create({
            data: {
                ...data,
                createdById: userId,
            },
        });
        return expectedDelivery;
    }
    // Resident sets auto-approve rule
    async createAutoApproveRule(data, userId) {
        const rule = await Client_1.prisma.deliveryAutoApproveRule.create({
            data: {
                ...data,
                createdById: userId,
            },
        });
        return rule;
    }
    // Get auto-approve rules for a flat
    async getAutoApproveRules(flatId) {
        const rules = await Client_1.prisma.deliveryAutoApproveRule.findMany({
            where: { flatId, isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return rules;
    }
    // Toggle auto-approve rule
    async toggleAutoApproveRule(ruleId, isActive) {
        const rule = await Client_1.prisma.deliveryAutoApproveRule.update({
            where: { id: ruleId },
            data: { isActive },
        });
        return rule;
    }
    // Delete auto-approve rule
    async deleteAutoApproveRule(ruleId) {
        await Client_1.prisma.deliveryAutoApproveRule.delete({
            where: { id: ruleId },
        });
    }
    // Get expected deliveries for a flat
    async getExpectedDeliveries(flatId) {
        const deliveries = await Client_1.prisma.expectedDelivery.findMany({
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
exports.DeliveryService = DeliveryService;
