import api from './client';

export const residentAPI = {
    // Entries
    getPendingEntries: () => api.get('/entries/pending'),
    approveEntry: (id: string) => api.patch(`/entries/${id}/approve`),
    rejectEntry: (id: string, reason?: string) => api.patch(`/entries/${id}/reject`, { reason }),

    // Pre-Approvals
    createPreApproval: (data: any) => api.post('/preapprovals', data),
    getPreApprovals: () => api.get('/preapprovals?status=ACTIVE'),
    getPreApprovalQR: (id: string) => api.get(`/preapprovals/${id}/qr`),
    cancelPreApproval: (id: string) => api.delete(`/preapprovals/${id}`),

    // Gate Passes
    createGatePass: (data: any) => api.post('/gatepasses', data),
    getGatePasses: (flatId: string) => api.get(`/gatepasses?flatId=${flatId}`),

    // Profile
    getProfile: () => api.get('/auth/resident-app/profile'),
};
