# Redis Connection Setup

## ✅ Fixed Redis Connection Issues

### Changes Made:

1. **Updated Redis Configuration** ([src/utils/Otp.ts](src/utils/Otp.ts) and [src/config/redis.ts](src/config/redis.ts))
   - Added proper error handling
   - Added retry strategy with exponential backoff
   - Added lazy connection to avoid crashes on startup
   - Added connection status logging

2. **Updated .env File**
   - Changed from `redis://localhost:6379` to `redis://127.0.0.1:6379`
   - This fixes Windows Docker networking issues

### Why This Fix Works:

On Windows, Docker port forwarding sometimes doesn't work properly with `localhost`. Using `127.0.0.1` (the actual loopback IP) resolves this issue.

## 🚀 Quick Start

### Option 1: Start Redis with Docker

```bash
# Start Redis container
docker run -d --name redis -p 6379:6379 redis:alpine

# Verify Redis is running
docker ps | grep redis

# Test Redis connection
docker exec redis redis-cli ping
# Should return: PONG
```

### Option 2: Use Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  redis:
    image: redis:alpine
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

Then run:

```bash
docker-compose up -d redis
```

## 🔍 Verify Connection

After starting your Node.js server, you should see:

```
✅ Redis connected successfully
```

If Redis is not available, you'll see:

```
⚠️  Redis not available: [error message]
⚠️  App will run without Redis features
```

The app will continue to work, but OTP and rate limiting features will be disabled.

## 🧪 Test Redis Connection

You can test the Redis connection using redis-cli:

```bash
# From host machine (Windows)
docker exec -it redis redis-cli

# Inside redis-cli
127.0.0.1:6379> ping
PONG
127.0.0.1:6379> set test "hello"
OK
127.0.0.1:6379> get test
"hello"
127.0.0.1:6379> exit
```

## 📋 Environment Variables

Make sure your [.env](.env) file has:

```env
REDIS_URL="redis://127.0.0.1:6379"
```

### Other Redis URL Formats:

```env
# With password
REDIS_URL="redis://:password@127.0.0.1:6379"

# With database number
REDIS_URL="redis://127.0.0.1:6379/0"

# Redis Cloud or external service
REDIS_URL="redis://username:password@your-redis-host:6379"
```

## 🐛 Troubleshooting

### Error: "Connection refused"

**Solution 1**: Check if Redis is running
```bash
docker ps | grep redis
```

**Solution 2**: Check port mapping
```bash
docker port redis
# Should show: 6379/tcp -> 0.0.0.0:6379
```

**Solution 3**: Test Redis from container
```bash
docker exec redis redis-cli ping
```

### Error: "Unhandled error event"

This was the original issue. It's now fixed with proper error handling in the code.

### Redis Features Not Working

If Redis connection fails, the following features will be disabled:
- OTP storage (for phone-based authentication)
- Rate limiting (for OTP requests)
- Session management

The app will still work for other features like:
- Password-based login
- All CRUD operations
- Database operations
- Socket.IO notifications

## 🔄 Redis Data Persistence

By default, Redis in Docker doesn't persist data. To enable persistence:

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:alpine redis-server --appendonly yes
```

## 📊 Monitor Redis

### View Redis logs
```bash
docker logs redis -f
```

### Monitor Redis commands
```bash
docker exec -it redis redis-cli monitor
```

### View Redis info
```bash
docker exec redis redis-cli info
```

### Check memory usage
```bash
docker exec redis redis-cli info memory
```

## 🔐 Production Setup

For production, consider:

1. **Use Redis Cloud** or managed Redis service
2. **Enable authentication**:
   ```bash
   docker run -d --name redis -p 6379:6379 redis:alpine redis-server --requirepass your_password
   ```

   Update .env:
   ```env
   REDIS_URL="redis://:your_password@127.0.0.1:6379"
   ```

3. **Enable SSL/TLS** for secure connections
4. **Set memory limits**:
   ```bash
   docker run -d --name redis -p 6379:6379 redis:alpine redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
   ```

## 📝 What Redis is Used For in This App

1. **OTP Storage**: Temporary storage of OTPs for phone-based login
   - Key format: `otp:{phone}`
   - TTL: 5 minutes

2. **Rate Limiting**: Prevent OTP spam
   - Key format: `otp:attempts:phone:{phone}`
   - Key format: `otp:attempts:ip:{ip}`
   - TTL: 15 minutes

## ✅ Verification Checklist

- [x] Redis container is running
- [x] Port 6379 is exposed
- [x] REDIS_URL is set to `redis://127.0.0.1:6379`
- [x] Error handling is implemented
- [x] Server starts without crashes
- [x] Redis connection logs appear in console

## 🎉 Success!

Your Redis connection is now properly configured. The app will:
- ✅ Connect to Redis on startup
- ✅ Handle connection errors gracefully
- ✅ Continue running even if Redis is unavailable
- ✅ Log connection status for debugging
