import api from './client';

export const guardAPI = {
    // Entries
    getTodayEntries: () => api.get('/entries/today'),
    createEntry: (data: any) => api.post('/entries', data), // Visitor/Delivery
    checkoutEntry: (id: string) => api.patch(`/entries/${id}/checkout`),

    // Entry Requests (with photo)
    createEntryRequest: (data: any) => api.post('/entry-requests', data),
    getPendingEntryRequests: () => api.get('/entry-requests/pending-count'),

    // Scanner
    scanPreApproval: (qrToken: string) => api.post('/preapprovals/scan', { qrToken }),
    scanGatePass: (qrToken: string) => api.post('/gatepasses/scan', { qrToken }),
};
