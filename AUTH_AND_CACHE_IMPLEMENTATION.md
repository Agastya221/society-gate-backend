# Authentication & Caching Implementation Summary

## Overview
This document summarizes the implementation of JWT access/refresh tokens, user logout functionality, and Redis caching for the Society Gate Backend API.

---

## 1. JWT Access & Refresh Token System

### What Changed

#### **Token Types**
- **Access Token**: Short-lived (15 minutes) - Used for API requests
- **Refresh Token**: Long-lived (30 days for residents, 7 days for guards) - Used to obtain new access tokens

#### **Database Schema Updates**
Added to the `User` model in [prisma/schema.prisma](prisma/schema.prisma):
```prisma
refreshToken     String?   @db.Text     // Store current refresh token
tokenVersion     Int       @default(0)  // Increment to invalidate all tokens
lastTokenRefresh DateTime?              // Track when token was last refreshed
```

### Implementation Details

#### **Token Generation** ([src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts))
```typescript
// Generate access token (15 min expiry)
generateAccessToken(userId, role, societyId, flatId, appType)

// Generate refresh token (7-30 day expiry)
generateRefreshToken(userId, role, societyId, flatId, appType)
```

#### **Token Storage**
All login endpoints now:
1. Generate both access and refresh tokens
2. Store the refresh token in the database
3. Return both tokens to the client

Updated endpoints:
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/admin-app/login`
- `POST /api/v1/auth/guard-app/login`

#### **Token Refresh** ([src/modules/user/user.service.ts](src/modules/user/user.service.ts:474-534))
```typescript
POST /api/v1/auth/refresh-token
```

Features:
- Validates refresh token against database
- Checks if token is blacklisted
- Rotates refresh token (issues new one)
- Returns new access token + new refresh token

**Token Rotation**: Each refresh returns a NEW refresh token. The old one is invalidated.

---

## 2. User Logout Functionality

### What Changed

#### **Logout Endpoint**
```typescript
POST /api/v1/auth/logout
```

**Request**:
```json
{
  "refreshToken": "optional-refresh-token"
}
```

**Implementation** ([src/modules/user/user.service.ts](src/modules/user/user.service.ts:536-571)):
1. Clears refresh token from database
2. Blacklists access token in Redis
3. Blacklists refresh token in Redis (if provided)

#### **Token Blacklist** ([src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts))
Uses Redis to store blacklisted tokens:
```typescript
blacklistToken(token, expiresIn)  // Add token to blacklist
isTokenBlacklisted(token)         // Check if token is blacklisted
```

### Security Features
- Tokens are blacklisted until their natural expiry
- Database refresh token is cleared immediately
- All active sessions for a user can be invalidated by incrementing `tokenVersion`

---

## 3. Redis Caching System

### What Changed

#### **Cache Middleware** ([src/middlewares/cache.middleware.ts](src/middlewares/cache.middleware.ts))

**Features**:
- Caches GET requests automatically
- Configurable TTL (time to live)
- User-specific caching with `varyBy` parameter
- Automatic cache invalidation on mutations

**Usage**:
```typescript
// Cache for 60 seconds, vary by userId
router.get('/notifications',
  cache({ ttl: 60, keyPrefix: 'notifications', varyBy: ['userId'] }),
  getNotifications
);

// Clear cache after mutation
router.post('/notifications',
  clearCacheAfter(['notifications:*']),
  createNotification
);
```

### Cached Endpoints

#### **Notifications** ([src/modules/notification/notification.routes.ts](src/modules/notification/notification.routes.ts))
- `GET /api/v1/resident/notifications` - 60s cache (varies by user)
- `GET /api/v1/resident/notifications/unread-count` - 30s cache (varies by user)

#### **Society** ([src/modules/society/society.routes.ts](src/modules/society/society.routes.ts))
- `GET /api/v1/admin/societies` - 120s cache
- `GET /api/v1/admin/societies/:id` - 300s cache (varies by society)
- `GET /api/v1/admin/societies/:id/stats` - 180s cache (varies by society)

### Cache Invalidation
Mutations automatically clear related cache:
```typescript
// POST, PATCH, DELETE operations
clearCacheAfter(['notifications:*'])  // Clears all notification cache
clearCacheAfter(['society:*'])        // Clears all society cache
```

---

## 4. Environment Variables

### New Variables Added to [.env](.env)
```bash
JWT_REFRESH_SECRET="e8a4c9b2f7d6e1a3b5c8d2f9e4a7b3c6d1e5f2a8b7c4d9e3f1a6b2c5d8e4f7a1b"
```

### Existing Required Variables
```bash
JWT_SECRET="..."
REDIS_URL="redis://..."
DATABASE_URL="postgresql://..."
```

---

## 5. API Documentation Updates

Updated [API_DOCUMENTATION.md](API_DOCUMENTATION.md) with:
1. New token flow diagrams
2. Refresh token endpoint documentation
3. Logout endpoint documentation
4. Token rotation explanation
5. Redis caching section
6. Example client-side token refresh implementation

---

## 6. Client Integration Guide

### Token Storage
```javascript
// After login
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
```

### Making Authenticated Requests
```javascript
const accessToken = localStorage.getItem('accessToken');

fetch('/api/v1/resident/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### Handling Token Expiry
```javascript
async function fetchWithTokenRefresh(url, options = {}) {
  let accessToken = localStorage.getItem('accessToken');

  // Try request with current access token
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  // If 401, refresh token
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');

    const refreshResponse = await fetch('/api/v1/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();

      // Store new tokens
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);

      // Retry original request
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${data.data.accessToken}`
        }
      });
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
    }
  }

  return response;
}
```

### Logout
```javascript
async function logout() {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ refreshToken })
  });

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}
```

---

## 7. Security Best Practices

### Implemented
✅ Short-lived access tokens (15 minutes)
✅ Long-lived refresh tokens (7-30 days)
✅ Refresh token rotation on every refresh
✅ Token blacklisting on logout
✅ Database-backed refresh token validation
✅ Redis-based token blacklist
✅ Token versioning support

### Recommendations
- Use HTTPS in production
- Store tokens in httpOnly cookies (more secure than localStorage)
- Implement rate limiting on login/refresh endpoints
- Monitor for suspicious token refresh patterns
- Regularly rotate JWT secrets
- Consider implementing device fingerprinting

---

## 8. Performance Improvements

### Redis Caching Benefits
- **Faster Response Times**: Cached responses served in milliseconds
- **Reduced Database Load**: Frequently accessed data doesn't hit the database
- **Better Scalability**: Handle more concurrent users with same resources

### Cache Statistics (Example)
```
Notifications API:
- Without cache: ~150-200ms
- With cache: ~5-10ms
- 95% reduction in response time

Society Stats:
- Without cache: ~300-500ms
- With cache: ~5-10ms
- 98% reduction in response time
```

---

## 9. Testing

### Manual Testing Commands

#### Test Login & Get Tokens
```bash
curl -X POST http://localhost:4000/api/v1/auth/admin-app/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "password": "yourpassword"}'
```

#### Test Token Refresh
```bash
curl -X POST http://localhost:4000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

#### Test Logout
```bash
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

#### Test Cached Endpoint
```bash
# First request (database hit)
curl http://localhost:4000/api/v1/resident/notifications \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Second request (cache hit - faster)
curl http://localhost:4000/api/v1/resident/notifications \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 10. Files Modified

### Core Authentication
- [src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts) - Added token generation, validation, and blacklisting
- [src/modules/user/user.service.ts](src/modules/user/user.service.ts) - Updated all auth methods to use new token system
- [src/modules/user/user.controller.ts](src/modules/user/user.controller.ts) - Added refresh and logout endpoints
- [src/modules/user/user.routes.ts](src/modules/user/user.routes.ts) - Added routes for refresh and logout

### Database
- [prisma/schema.prisma](prisma/schema.prisma) - Added refresh token fields to User model

### Caching
- [src/middlewares/cache.middleware.ts](src/middlewares/cache.middleware.ts) - New cache middleware
- [src/modules/notification/notification.routes.ts](src/modules/notification/notification.routes.ts) - Added caching
- [src/modules/society/society.routes.ts](src/modules/society/society.routes.ts) - Added caching

### Configuration
- [.env](.env) - Added JWT_REFRESH_SECRET

### Documentation
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Updated with new endpoints and flows

---

## 11. Migration Steps

The database schema has been updated. Changes were pushed using:
```bash
npx prisma generate
npx prisma db push
```

---

## Next Steps

### Recommended Enhancements
1. **Add refresh token cleanup job** - Remove expired refresh tokens from database
2. **Implement device tracking** - Track which devices have active sessions
3. **Add session management UI** - Allow users to view and revoke active sessions
4. **Implement sliding sessions** - Extend session if user is active
5. **Add more endpoints to cache** - Identify slow endpoints and add caching
6. **Monitor cache hit rates** - Track cache effectiveness with Redis metrics
7. **Implement cache warming** - Pre-populate frequently accessed data

### Future Security Improvements
1. **Two-factor authentication (2FA)**
2. **Biometric authentication support**
3. **IP whitelisting for admin accounts**
4. **Anomaly detection for suspicious logins**
5. **Automated security audit logs**

---

## Support

For questions or issues:
- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
- Review code comments in modified files
- Test endpoints using the examples above

**Last Updated**: 2026-01-23
**Version**: 2.0
