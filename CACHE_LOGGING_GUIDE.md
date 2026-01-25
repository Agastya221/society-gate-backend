# Cache Logging Guide

## Overview
Added comprehensive console logging to track cache hits, misses, and invalidations for debugging and monitoring cache performance.

---

## Log Symbols and Meanings

### Cache Operations

| Symbol | Log Type | Meaning |
|--------|----------|---------|
| 📦 | `[CACHE HIT]` | Data served from Redis cache (fast) |
| 💾 | `[CACHE MISS]` | Cache not found, will fetch from database |
| ✅ | `[CACHE SET]` | Response cached successfully |
| ✅ | `[DATABASE]` | Data fetched from database |
| 🔍 | `[CACHE CHECK]` | Controller is fetching data |
| 🗑️ | `[CACHE INVALIDATION]` | Clearing cache pattern |
| ✅ | `[CACHE CLEARED]` | Cache entries deleted |

---

## Example Log Flow

### First Request (Cache Miss)
```
🔍 [CACHE CHECK] Fetching complaints from DATABASE... { userId: 'abc123', ... }
💾 [CACHE MISS] Will cache response: /api/v1/resident/complaints
✅ [DATABASE] Complaints fetched: 5
✅ [CACHE SET] Cached response for 60s: /api/v1/resident/complaints
```

**What happened:**
1. Controller receives request
2. Cache middleware checks Redis - not found
3. Request proceeds to database
4. Response is cached for 60 seconds
5. User receives data from database

**Response Time:** ~50-200ms (database query time)

---

### Second Request (Cache Hit)
```
📦 [CACHE HIT] Serving from CACHE: /api/v1/resident/complaints
```

**What happened:**
1. Cache middleware checks Redis - found!
2. Returns cached data immediately
3. Controller is never called
4. Database is not queried

**Response Time:** ~1-5ms (cache lookup time)

---

### Create/Update Request (Cache Invalidation)
```
🗑️  [CACHE INVALIDATION] Clearing cache pattern: complaints:*
✅ [CACHE CLEARED] Deleted 3 cache entries for pattern: complaints:*
```

**What happened:**
1. Complaint created/updated
2. Cache invalidation middleware triggered
3. All complaint-related caches cleared
4. Next request will be a cache miss (fresh data)

---

## Cache Logging in Complaints Module

### Files Modified

**1. [src/modules/complaint/complaint.controller.ts](src/modules/complaint/complaint.controller.ts)**

Added logging to track when database is queried:

```typescript
// List complaints
export const getComplaints = asyncHandler(async (req: Request, res: Response) => {
  // ... validation ...

  console.log('🔍 [CACHE CHECK] Fetching complaints from DATABASE...', {
    userId, userRole, userSocietyId, filters
  });

  const result = await complaintService.getComplaints(...);

  console.log('✅ [DATABASE] Complaints fetched:', result.pagination.total);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// Get complaint by ID
export const getComplaintById = asyncHandler(async (req: Request, res: Response) => {
  // ... validation ...

  console.log('🔍 [CACHE CHECK] Fetching complaint by ID from DATABASE...', {
    complaintId: id, userId, userRole
  });

  const complaint = await complaintService.getComplaintById(...);

  console.log('✅ [DATABASE] Complaint fetched:', complaint.id);

  res.status(200).json({
    success: true,
    data: complaint,
  });
});
```

**2. [src/middlewares/cache.middleware.ts](src/middlewares/cache.middleware.ts)**

Added logging to track cache operations:

```typescript
// Cache hit
if (cachedData) {
  console.log(`📦 [CACHE HIT] Serving from CACHE: ${req.originalUrl || req.url}`);
  const parsed = JSON.parse(cachedData);
  return res.json(parsed);
}

// Cache miss
console.log(`💾 [CACHE MISS] Will cache response: ${req.originalUrl || req.url}`);

// Cache set
redis.setex(cacheKey, ttl, JSON.stringify(body)).then(() => {
  console.log(`✅ [CACHE SET] Cached response for ${ttl}s: ${req.originalUrl || req.url}`);
}).catch(err => {
  console.error('Redis cache set error:', err);
});

// Cache invalidation
console.log(`🗑️  [CACHE INVALIDATION] Clearing cache pattern: ${pattern}`);
clearCacheByPattern(pattern).then(deletedCount => {
  console.log(`✅ [CACHE CLEARED] Deleted ${deletedCount} cache entries for pattern: ${pattern}`);
}).catch(err => {
  console.error('Clear cache after mutation error:', err);
});
```

---

## Testing Cache Performance

### Test Scenario 1: List Complaints

**First Request:**
```bash
curl http://localhost:4000/api/v1/resident/complaints
```

**Expected Logs:**
```
💾 [CACHE MISS] Will cache response: /api/v1/resident/complaints
🔍 [CACHE CHECK] Fetching complaints from DATABASE... { userId: '...', ... }
✅ [DATABASE] Complaints fetched: 5
✅ [CACHE SET] Cached response for 60s: /api/v1/resident/complaints
```

**Second Request (within 60s):**
```bash
curl http://localhost:4000/api/v1/resident/complaints
```

**Expected Logs:**
```
📦 [CACHE HIT] Serving from CACHE: /api/v1/resident/complaints
```

Notice: No database logs, controller was bypassed!

---

### Test Scenario 2: Get Complaint by ID

**First Request:**
```bash
curl http://localhost:4000/api/v1/resident/complaints/123
```

**Expected Logs:**
```
💾 [CACHE MISS] Will cache response: /api/v1/resident/complaints/123
🔍 [CACHE CHECK] Fetching complaint by ID from DATABASE... { complaintId: '123', ... }
✅ [DATABASE] Complaint fetched: 123
✅ [CACHE SET] Cached response for 120s: /api/v1/resident/complaints/123
```

**Second Request (within 120s):**
```bash
curl http://localhost:4000/api/v1/resident/complaints/123
```

**Expected Logs:**
```
📦 [CACHE HIT] Serving from CACHE: /api/v1/resident/complaints/123
```

---

### Test Scenario 3: Create Complaint (Cache Invalidation)

**Create Request:**
```bash
curl -X POST http://localhost:4000/api/v1/resident/complaints \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "description": "Test complaint"}'
```

**Expected Logs:**
```
🗑️  [CACHE INVALIDATION] Clearing cache pattern: complaints:*
✅ [CACHE CLEARED] Deleted 2 cache entries for pattern: complaints:*
```

**Next GET Request:**
```bash
curl http://localhost:4000/api/v1/resident/complaints
```

**Expected Logs:**
```
💾 [CACHE MISS] Will cache response: /api/v1/resident/complaints
🔍 [CACHE CHECK] Fetching complaints from DATABASE... { ... }
✅ [DATABASE] Complaints fetched: 6  ← Notice: Count increased!
✅ [CACHE SET] Cached response for 60s: /api/v1/resident/complaints
```

---

## Interpreting Performance Metrics

### Cache Hit Rate
Calculate cache efficiency:
```
Cache Hit Rate = (Cache Hits / Total Requests) × 100%
```

**Example from logs:**
- Total requests: 10
- Cache hits: 8
- Cache hit rate: 80%

**Good:** 70-90% cache hit rate
**Excellent:** 90%+ cache hit rate

---

### Response Time Analysis

| Scenario | Response Time | Source |
|----------|---------------|--------|
| Cache Hit | 1-5ms | Redis |
| Cache Miss | 50-200ms | Database |
| Cache Miss (complex) | 200-1000ms | Database |

**Performance Improvement:**
- 10-100x faster with cache hits
- Reduced database load
- Better user experience

---

## Monitoring Cache in Production

### 1. Count Cache Operations

**Cache Hits:**
```bash
# Count cache hits in logs
grep "[CACHE HIT]" server.log | wc -l
```

**Cache Misses:**
```bash
# Count cache misses in logs
grep "[CACHE MISS]" server.log | wc -l
```

**Cache Invalidations:**
```bash
# Count cache invalidations
grep "[CACHE INVALIDATION]" server.log | wc -l
```

### 2. Track Popular Endpoints

```bash
# Find most frequently cached endpoints
grep "[CACHE HIT]" server.log | awk '{print $NF}' | sort | uniq -c | sort -rn
```

### 3. Monitor Cache Effectiveness

```bash
# Compare hits vs misses
echo "Cache Hits: $(grep -c '[CACHE HIT]' server.log)"
echo "Cache Misses: $(grep -c '[CACHE MISS]' server.log)"
```

---

## Cache TTL Reference

From the complaints module:

| Endpoint | TTL | Cache Key Varies By |
|----------|-----|---------------------|
| `GET /complaints` | 60s | societyId, userId |
| `GET /complaints/:id` | 120s | - |

**Why different TTLs?**
- List endpoint: 60s (changes more frequently)
- Detail endpoint: 120s (individual complaints change less often)

---

## Troubleshooting

### Issue: No Cache Logs Appearing

**Possible Causes:**
1. Redis is not available (check health endpoint)
2. Request is not a GET request
3. Cache middleware not applied to route

**Solution:**
```bash
# Check Redis status
curl http://localhost:4000/health

# Expected response:
{
  "services": {
    "redis": "connected"  ← Should be "connected"
  }
}
```

---

### Issue: Cache Hit on Stale Data

**Possible Causes:**
1. Cache invalidation not triggered
2. Wrong cache pattern in `clearCacheAfter()`

**Solution:**
```typescript
// Ensure cache invalidation on mutations
router.post('/', clearCacheAfter(['complaints:*']), createComplaint);
router.patch('/:id', clearCacheAfter(['complaints:*']), updateComplaint);
router.delete('/:id', clearCacheAfter(['complaints:*']), deleteComplaint);
```

---

### Issue: Too Many Cache Misses

**Possible Causes:**
1. TTL too short
2. High invalidation rate
3. Vary keys too specific

**Solutions:**
1. Increase TTL for stable data
2. Review invalidation patterns
3. Simplify vary keys if appropriate

---

## Best Practices

### 1. Monitor Logs Regularly
```bash
# Watch logs in real-time
tail -f server.log | grep -E "CACHE|DATABASE"
```

### 2. Balance TTL Values
- Short TTL (10-30s): Real-time data (emergencies, pending approvals)
- Medium TTL (60-120s): Moderate data (complaints, entries)
- Long TTL (300-600s): Stable data (vendors, QR codes, reports)

### 3. Clear Cache Appropriately
- Clear specific patterns, not all caches
- Use wildcard patterns for related data
- Test invalidation after mutations

### 4. Use Vary Keys Wisely
- Vary by user/society for personalized data
- Avoid varying by fields that change frequently
- Balance personalization vs cache efficiency

---

## Summary

Cache logging has been added to:
- ✅ Cache middleware (hits, misses, sets)
- ✅ Complaint controller (database queries)
- ✅ Cache invalidation (pattern clearing)

**Benefits:**
- Easy debugging of cache behavior
- Performance monitoring
- Cache effectiveness tracking
- Quick identification of issues

**Next Steps:**
1. Test with real requests
2. Monitor cache hit rates
3. Tune TTL values based on usage
4. Add similar logging to other modules if needed

---

**Last Updated:** 2026-01-25
**Version:** 1.0
