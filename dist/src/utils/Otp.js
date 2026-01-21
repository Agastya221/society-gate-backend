"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// ============================================
// REDIS CLIENT (SINGLETON)
// ============================================
const redis = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
// ============================================
// OTP + RATE LIMIT UTILS (MATCHES UserService)
// ============================================
class OtpService {
    // --------------------------------
    // OTP STORAGE (used by UserService)
    // --------------------------------
    async setOtp(phone, otp, ttlSeconds) {
        await redis.set(`otp:${phone}`, otp, 'EX', ttlSeconds);
    }
    async getOtp(phone) {
        return redis.get(`otp:${phone}`);
    }
    async deleteOtp(phone) {
        await redis.del(`otp:${phone}`);
    }
    // --------------------------------
    // RATE LIMIT HELPERS (phone / IP)
    // --------------------------------
    async getCount(key) {
        const value = await redis.get(key);
        return value ? Number(value) : 0;
    }
    async increment(key, ttlSeconds) {
        const pipeline = redis.multi();
        pipeline.incr(key);
        pipeline.expire(key, ttlSeconds);
        await pipeline.exec();
    }
    // --------------------------------
    // OPTIONAL DEBUG / CLEANUP HELPERS
    // --------------------------------
    async clearOtpForPhone(phone) {
        await redis.del(`otp:${phone}`);
    }
    async clearRateLimits(phone, ip) {
        await redis.del(`otp:attempts:phone:${phone}`);
        if (ip) {
            await redis.del(`otp:attempts:ip:${ip}`);
        }
    }
}
exports.OtpService = OtpService;
// ============================================
// KEY FORMAT USED (IMPORTANT)
// ============================================
// OTP VALUE:
//   otp:{phone}
//
// RATE LIMIT:
//   otp:attempts:phone:{phone}
//   otp:attempts:ip:{ip}
//
// This EXACTLY matches UserService usage.
