# E2E Tests Guide

## 🚀 Quick Start

### Automated (Recommended)
```bash
# Starts services, runs tests, cleans up
npm run test:e2e:full
```

### Manual Control
```bash
# 1. Start test services
npm run docker:test:up

# 2. Start test server (in separate terminal)
ENABLE_RATE_LIMIT=false PORT=3001 npm run dev:api

# 3. Run tests (in another terminal)
ENABLE_RATE_LIMIT=false npm run test:e2e

# 4. Cleanup
npm run docker:test:down
```

### Individual Test Suites
```bash
# Queue tests only (no server needed)
npm run test:e2e:queue

# Auth tests only (server required)
ENABLE_RATE_LIMIT=false npm run test:e2e -- auth.full-flow
```

---

## 📋 Prerequisites

### Required Services
- ✅ **PostgreSQL** (test DB on port 5433)
- ✅ **Redis** (test Redis on port 6379 or 6380)

### Environment Setup

**For auth tests:**
```bash
export ENABLE_RATE_LIMIT=false  # CRITICAL for deterministic tests
export E2E_BASE_URL=http://localhost:3001
```

**For queue tests:**
```bash
export REDIS_URL=redis://localhost:6380
```

---

## 🧪 Test Suites

### 1. `auth.full-flow.test.ts`

**What it tests:**
- User registration flow
- Authentication (login/logout)
- Token refresh mechanism
- Password validation
- Security headers & CORS

**Dependencies:**
- Running API server on port 3001
- Database with migrations
- **Rate limiting DISABLED** (`ENABLE_RATE_LIMIT=false`)

**Expected behavior:**
```
✅ Deterministic success/failure (no random outcomes)
⚠️  Some tests document implementation-dependent behavior:
   - Token blacklisting after logout (depends on Redis)
   - Token type validation (depends on middleware)
```

### 2. `queue-worker.test.ts`

**What it tests:**
- Job queue and processing
- Worker retry logic
- Progress tracking
- Queue metrics

**Dependencies:**
- Redis on port 6380
- No external API server needed

**Expected behavior:**
```
✅ 100% deterministic
✅ No random failures
✅ Controlled test scenarios via payload flags
```

---

## 🐛 Troubleshooting

### "Rate limit exceeded" in auth tests
**Fix:** Set `ENABLE_RATE_LIMIT=false` before running tests

### "Connection refused" errors
**Fix:** Ensure services are running:
```bash
docker compose -f docker-compose.test.yml ps
```

### "Database connection failed"
**Fix:** Run migrations:
```bash
DATABASE_URL="postgresql://testuser:testpassword@localhost:5433/fastify_test" \
npm run prisma:migrate
```

### Tests timeout
**Fix:** Increase timeout in test or check logs:
```bash
cat test-server.log
```

---

## 📊 Test Results Interpretation

### ✅ Success Indicators
- `expect(status).toBe(201)` - Deterministic
- Clear pass/fail messages

### ⚠️ Implementation Notes
Some tests document optional features:

```typescript
// Example: Token blacklisting
if (response.status === 401) {
  console.log('✓ Token blacklisted (Redis enabled)')
} else if (response.status === 200) {
  console.log('⚠️  No blacklist (pure JWT)')
}
```

These are **not failures** - they document system behavior.

---

## 🔧 CI/CD Integration

### GitHub Actions
E2E tests run automatically on push to `develop` or `main`:

```yaml
env:
  ENABLE_RATE_LIMIT: false
  DATABASE_URL: postgresql://...
  REDIS_URL: redis://...
```

See `.github/workflows/test.yml` for full config.

---

## 📝 Writing New E2E Tests

### DO ✅
```typescript
// Deterministic expectations
expect(response.status).toBe(201)

// Clear test data setup
const testData = { /* ... */ }

// Proper cleanup
afterAll(async () => {
  await cleanup()
})
```

### DON'T ❌
```typescript
// NO random outcomes
expect([200, 401, 429]).toContain(status) // ❌

// NO mock data in E2E
const token = 'mock-token' // ❌

// NO shared state between tests
let globalUser // ❌
```

---

## 🎯 Best Practices

1. **Isolation** - Each test should be independent
2. **Determinism** - Same input = same output
3. **Cleanup** - Always clean up test data
4. **Documentation** - Comment implementation-dependent behavior
5. **Fast feedback** - Use `test:e2e:watch` during development

---

## 📚 Related Docs

- [Testing Guide](./docs/TESTING.md)
- [Architecture Principles](./docs/ARCHITECTURE_PRINCIPLES.md)
- [CI/CD Setup](./docs/DEPLOYMENT.md)

