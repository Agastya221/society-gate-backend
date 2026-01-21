import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// ============================================
// AUTH APIS
// ============================================

export const authAPI = {
    sendOTP: (phone: string) => api.post('/auth/otp/send', { phone }),

    verifyOTP: (phone: string, otp: string, name: string, email?: string) =>
        api.post('/auth/otp/verify', { phone, otp, name, email }),

    login: (phone: string, password: string) =>
        api.post('/auth/resident-app/login', { phone, password }),
};

// ============================================
// ONBOARDING APIS
// ============================================

export const onboardingAPI = {
    getSocieties: (params?: { city?: string; search?: string }) =>
        api.get('/onboarding/societies', { params }),

    getBlocks: (societyId: string) =>
        api.get(`/onboarding/societies/${societyId}/blocks`),

    getFlats: (societyId: string, blockId: string) =>
        api.get(`/onboarding/societies/${societyId}/blocks/${blockId}/flats`),

    submitRequest: (data: {
        societyId: string;
        blockId: string;
        flatId: string;
        residentType: 'OWNER' | 'TENANT';
        documents: Array<{
            type: string;
            url: string;
            fileName: string;
            fileSize: number;
            mimeType: string;
        }>;
    }) => api.post('/onboarding/request', data),

    getStatus: () => api.get('/onboarding/status'),
};

// ============================================
// ADMIN ONBOARDING APIS
// ============================================

export const adminOnboardingAPI = {
    getPendingRequests: (params?: {
        status?: string;
        residentType?: string;
        page?: number;
        limit?: number;
    }) => api.get('/onboarding/admin/pending', { params }),

    getRequestDetails: (requestId: string) =>
        api.get(`/onboarding/admin/${requestId}`),

    approveRequest: (requestId: string, notes?: string) =>
        api.patch(`/onboarding/admin/${requestId}/approve`, { notes }),

    rejectRequest: (requestId: string, reason: string) =>
        api.patch(`/onboarding/admin/${requestId}/reject`, { reason }),

    requestResubmit: (requestId: string, reason: string, documentsToResubmit?: string[]) =>
        api.patch(`/onboarding/admin/${requestId}/request-resubmit`, {
            reason,
            documentsToResubmit,
        }),
};

// ============================================
// UPLOAD API (Mock for now)
// ============================================

export const uploadAPI = {
    uploadDocument: async (file: File): Promise<{
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
    }> => {
        // Mock upload - in real app, upload to S3/Cloudinary
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    url: `https://storage.example.com/docs/${file.name}`,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                });
            }, 1000);
        });
    },
};
