# 🔴 Redis Setup Guide - Fix Connection Error

## ⚠️ Current Issue

You're seeing this error:
```
⚠️  Redis connection error: ...
```

This is because your application uses Redis for:
1. **OTP storage** (SMS verification codes)
2. **Rate limiting** (prevent spam)

---

## 🚀 QUICK SOLUTIONS

### ✅ Option 1: Docker (Easiest - 2 minutes)

If you have Docker installed:

```bash
# Start Redis in Docker
docker run -d --name society-redis -p 6379:6379 redis:alpine

# Verify it's running
docker ps

# Stop when done
docker stop society-redis

# Start again
docker start society-redis
```

**Then restart your backend:**
```bash
npm start
```

You should see: `✅ Redis connected successfully`

---

### ✅ Option 2: Windows Install (5 minutes)

#### Method A: WSL (Recommended)

```bash
# 1. Install WSL (if not installed)
wsl --install

# 2. Open WSL terminal
wsl

# 3. Install Redis
sudo apt-get update
sudo apt-get install redis-server

# 4. Start Redis
sudo service redis-server start

# 5. Verify it's running
redis-cli ping
# Should respond: PONG

# 6. Keep this terminal open or set to auto-start:
sudo service redis-server enable
```

#### Method B: Redis for Windows

```bash
# Download from:
# https://github.com/microsoftarchive/redis/releases

# Or use Chocolatey:
choco install redis-64

# Start Redis
redis-server
```

---

### ✅ Option 3: Cloud Redis (Best for Production)

Use **Upstash** (Free tier):

1. **Sign up:** https://upstash.com/
2. **Create Database:**
   - Click "Create Database"
   - Choose region closest to you
   - Select "Free" tier

3. **Get Connection URL:**
   - Copy the Redis URL (looks like: `rediss://default:password@host:6379`)

4. **Update `.env`:**
```env
REDIS_URL="rediss://default:YOUR_PASSWORD@your-endpoint.upstash.io:6379"
```

5. **Restart server:**
```bash
npm start
```

---

### ⚠️ Option 4: Mock Redis (Development Only)

If you just want to test without OTP features:

Create `src/utils/mock-redis.ts`:

```typescript
// Mock Redis for development without Redis server
export class MockRedis {
  private store = new Map<string, { value: string; expiry: number }>();

  async set(key: string, value: string, ex: string, ttl: number): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiry });
    console.log(`📝 Mock Redis SET: ${key} = ${value} (TTL: ${ttl}s)`);
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }

    console.log(`📖 Mock Redis GET: ${key} = ${item.value}`);
    return item.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    console.log(`🗑️  Mock Redis DEL: ${key}`);
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = (parseInt(current || '0') + 1).toString();
    await this.set(key, newValue, 'EX', 3600);
    return parseInt(newValue);
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;

    const remaining = Math.floor((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  on(event: string, handler: Function) {
    // Mock event handlers
  }

  connect() {
    console.log('📦 Using Mock Redis (in-memory storage)');
    return Promise.resolve();
  }
}
```

Then update `src/utils/Otp.ts`:

```typescript
import Redis from 'ioredis';
import { MockRedis } from './mock-redis';

// Use mock Redis if REDIS_URL is 'mock' or not set
const USE_MOCK = !process.env.REDIS_URL || process.env.REDIS_URL === 'mock';

const redis = USE_MOCK
  ? new MockRedis() as any
  : new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('❌ Redis connection failed after 10 attempts');
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

// ... rest of the code stays the same
```

Update `.env`:
```env
REDIS_URL="mock"  # Use mock Redis for development
```

**⚠️ WARNING:** Mock Redis is **NOT production-ready**:
- Data lost on server restart
- No persistence
- Not suitable for multiple server instances
- Use only for development/testing

---

## 🧪 Testing Redis Connection

After setting up, test it works:

```bash
# Option 1: Using redis-cli
redis-cli ping
# Should respond: PONG

# Option 2: Using Node.js
node -e "const Redis = require('ioredis'); const r = new Redis(); r.ping().then(console.log).catch(console.error).finally(() => r.quit());"
# Should print: PONG

# Option 3: Test OTP in your app
# Send OTP to a phone number and verify it works
```

---

## 📊 Which Option Should You Choose?

| Option | Best For | Pros | Cons |
|--------|----------|------|------|
| **Docker** | Quick setup | Fast, clean, easy | Requires Docker |
| **WSL Redis** | Windows dev | Native, no Docker | Requires WSL |
| **Upstash** | Production/Cloud | Managed, reliable | Needs internet |
| **Mock Redis** | Quick testing | No dependencies | Not production-ready |

**Recommendation:**
- **Development:** Docker or WSL Redis
- **Production:** Upstash or AWS ElastiCache
- **Quick Testing:** Mock Redis

---

## 🔧 Current State of Your Code

The good news: **Your code already handles Redis errors gracefully!**

Looking at `src/utils/Otp.ts`:
```typescript
redis.on('error', (err) => {
  console.warn('⚠️  Redis connection error:', err.message);
  console.warn('⚠️  OTP and rate limiting features may not work properly');
});
```

This means:
- ✅ Your app **won't crash** without Redis
- ⚠️ But **OTP features won't work**
- ⚠️ Rate limiting won't work

**You can proceed with testing other features**, but you'll need Redis for:
- Resident registration (OTP verification)
- Login via OTP
- Rate limiting on API calls

---

## 🚀 Quick Start for Testing

**For NOW (to test race conditions):**

You can test without Redis by:
1. Using **existing test accounts** (already in database via seed data)
2. Getting JWT tokens by direct login (password-based for guards)
3. Testing QR scanning, entry approval, society isolation

**Later (for full functionality):**

Set up Redis using **Option 1 (Docker)** - takes 2 minutes.

---

## 🎯 Next Steps

### Immediate (For Testing):

```bash
# 1. Use seed data credentials to get tokens
POST /api/auth/guard/login
{
  "username": "guard1",
  "password": "Guard@123"
}

# 2. Run your race condition tests with these tokens
node tests/race-condition-test.js
```

### Before Production:

```bash
# Set up proper Redis (Docker or Upstash)
docker run -d --name society-redis -p 6379:6379 redis:alpine

# Verify
redis-cli ping
```

---

## 📝 Summary

**Current Error:** Redis not running → OTP/rate limiting disabled

**Impact:**
- ⚠️ Can't register new residents via OTP
- ✅ Can test with existing accounts
- ✅ Can test race conditions
- ✅ Can test society isolation
- ✅ App still runs (won't crash)

**Quick Fix:**
```bash
docker run -d -p 6379:6379 redis:alpine
npm start
```

**For now:** Proceed with testing using existing accounts from seed data!

---

**Last Updated:** January 2026
**Priority:** MEDIUM (Required for OTP, but app runs without it)
