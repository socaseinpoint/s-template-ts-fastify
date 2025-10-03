# Testing Guide

Comprehensive testing guide for the TypeScript Service Template.

## Overview

The project uses a **two-tier testing strategy**:

1. **Unit Tests** - Fast, isolated tests with mocked dependencies
2. **E2E Tests** - End-to-end tests with real database and server

```
tests/
├── unit/           # Unit tests - Fast, isolated, mocked
│   ├── services/   # Business logic tests
│   ├── utils/      # Utility function tests
│   ├── middleware/ # Middleware tests
│   └── routes/     # Route handler tests
├── e2e/            # End-to-end tests - Real server, real database
│   └── *.e2e.test.ts
├── fixtures/       # Test data
├── mocks/          # Mock implementations
├── helpers/        # Test utilities
└── setup/          # Setup and teardown
```

## Quick Start

```bash
# Run unit tests (fastest)
npm test

# Run E2E tests (automated - recommended)
npm run test:e2e:full

# Run with coverage
npm run test:coverage
```

## Unit Tests

**43 tests ✅** - Fast execution (< 1 second)

### Running Unit Tests

```bash
# Run once
npm test
npm run test:unit

# Watch mode (auto-rerun on changes)
npm run test:unit:watch

# With coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Features

- ⚡ **Fast** - No external dependencies
- 🎯 **Isolated** - All dependencies mocked
- 💯 **Coverage** - 80%+ required (enforced)
- ✅ **Reliable** - Always pass (no flakiness)

### Coverage Requirements

Configured in `vitest.config.mts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  }
}
```

View coverage report:
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

### Writing Unit Tests

**Example:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '@/services/auth.service'

describe('AuthService', () => {
  let authService: AuthService
  let mockUserRepo: any
  let mockTokenRepo: any

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      create: vi.fn(),
    }
    mockTokenRepo = {
      addToSet: vi.fn(),
      getSet: vi.fn(),
    }
    authService = new AuthService(mockUserRepo, mockTokenRepo)
  })

  it('should login with valid credentials', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      password: 'hashed-password',
      role: 'USER',
    })

    const result = await authService.login({
      email: 'test@example.com',
      password: 'password123',
    })

    expect(result).toHaveProperty('accessToken')
    expect(result).toHaveProperty('refreshToken')
  })
})
```

## E2E Tests

**15 tests** - Complete user flows with real database

### Running E2E Tests

**Automated (Recommended):**
```bash
npm run test:e2e:full
```

This script automatically:
1. ✅ Starts PostgreSQL on port 5433 (Docker)
2. ✅ Runs migrations
3. ✅ Seeds test data
4. ✅ Starts test server on port 3001
5. ✅ Runs E2E tests
6. ✅ Cleans up everything

**Manual Setup:**
```bash
# 1. Start test database
npm run docker:test:up

# 2. Run migrations and seed
export DATABASE_URL="postgresql://testuser:testpassword@localhost:5433/fastify_test"
npm run prisma:migrate
npm run prisma:seed

# 3. Start test server (in separate terminal)
DATABASE_URL="postgresql://testuser:testpassword@localhost:5433/fastify_test" \
PORT=3001 npm run start:dev

# 4. Run E2E tests (in another terminal)
npm run test:e2e

# 5. Cleanup
npm run docker:test:down
```

### E2E Test Coverage

- ✅ Complete authentication flow (register → login → refresh → logout)
- ✅ Protected routes access
- ✅ Role-based access control (RBAC)
- ✅ Token expiration and refresh
- ✅ Security headers and CORS
- ✅ Input validation
- ✅ Error handling

### Writing E2E Tests

**Example:**

```typescript
import { describe, it, expect } from 'vitest'
import axios from 'axios'

describe('Auth Flow', () => {
  const api = axios.create({ 
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001' 
  })

  it('should complete full auth flow', async () => {
    // Register
    const registerRes = await api.post('/v1/auth/register', {
      email: 'newuser@example.com',
      password: 'Password123!',
      name: 'New User'
    })
    expect(registerRes.status).toBe(201)
    
    // Login
    const loginRes = await api.post('/v1/auth/login', {
      email: 'newuser@example.com',
      password: 'Password123!'
    })
    const { accessToken } = loginRes.data
    
    // Access protected route
    const itemsRes = await api.get('/v1/items', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    expect(itemsRes.status).toBe(200)
  })
})
```

## Test Fixtures and Helpers

### Using Fixtures

```typescript
import { testUsers } from '@tests/fixtures/users.fixture'

const adminUser = testUsers.admin
```

### Using Helpers

```typescript
import { getAuthToken, wait } from '@tests/helpers/test-utils'

const token = await getAuthToken(server, 'admin@example.com', 'Admin123!')
await wait(1000)
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linting
        run: npm run lint:check
        
      - name: Run type checking
        run: npm run type-check
        
      - name: Run unit tests
        run: npm run test:ci
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Best Practices

### 1. **Arrange-Act-Assert**
```typescript
it('should do something', async () => {
  // Arrange
  const input = 'test'
  
  // Act
  const result = doSomething(input)
  
  // Assert
  expect(result).toBe('expected')
})
```

### 2. **Descriptive Names**
```typescript
// ❌ Bad
it('test login', ...)

// ✅ Good
it('should return access token when credentials are valid', ...)
```

### 3. **One Thing Per Test**
```typescript
// ❌ Bad - tests multiple things
it('should handle user operations', async () => {
  await createUser()
  await updateUser()
  await deleteUser()
})

// ✅ Good - focused tests
it('should create user', ...)
it('should update user', ...)
it('should delete user', ...)
```

### 4. **Mock External Dependencies**
```typescript
// Always mock in unit tests
vi.mock('@/repositories/user.repository')
vi.mock('axios')
```

### 5. **Clean Up After Tests**
```typescript
afterEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await server.close()
})
```

## Troubleshooting

### Tests Failing Locally

```bash
# Clean everything and start fresh
npm run reset

# Reinstall dependencies
npm install

# Regenerate Prisma client
npm run prisma:generate
```

### E2E Tests Port Conflict

If port 3001 or 5433 are in use:

```bash
# Check what's using the port
lsof -i :3001
lsof -i :5433

# Kill the process
kill -9 <PID>

# Or change ports in test-e2e.sh and docker-compose.test.yml
```

### E2E Database Issues

```bash
# Reset test database
npm run docker:test:down
npm run docker:test:up

# Check database is healthy
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose.test.yml logs postgres-test
```

### Test Coverage Not Meeting Thresholds

```bash
# Generate detailed coverage report
npm run test:coverage

# Open in browser
open coverage/index.html

# Focus on untested files
# Add tests for services, repositories, utils
```

## Advanced Testing

### Test Only Changed Files

```bash
npm run test:changed
```

### Watch Mode

```bash
# Watch all tests
npm run test:watch

# Watch only unit tests
npm run test:unit:watch

# Watch only E2E tests
npm run test:e2e:watch
```

### Interactive UI

```bash
npm run test:ui
# Opens browser at http://localhost:51204
```

### Debug Tests

```bash
# Add debugger statement in test
it('should debug', async () => {
  debugger
  const result = await service.doSomething()
  expect(result).toBe('expected')
})

# Run with inspector
node --inspect-brk ./node_modules/.bin/vitest run
```

## Performance Tips

1. **Use beforeAll for expensive setup**
   ```typescript
   beforeAll(async () => {
     server = await createTestServer()
   })
   ```

2. **Run tests in parallel** (Vitest does this by default)

3. **Mock heavy operations** in unit tests

4. **Reuse test database** (test-e2e.sh keeps volumes by design)

## Test Data Management

### Seed Data

Test seeds are defined in `prisma/seed.ts`:
- 3 users (admin, moderator, user)
- 5 items (various categories)

### Fixtures

Reusable test data in `tests/fixtures/`:
- `users.fixture.ts` - User test data
- `items.fixture.ts` - Item test data

### Random Data Generation

```typescript
import { generateUniqueEmail } from '@tests/helpers/test-utils'

const email = generateUniqueEmail('test')
// Returns: test_1234567890_abc@example.com
```

## Summary

| Command | Purpose | Speed | Dependencies |
|---------|---------|-------|--------------|
| `npm test` | Unit tests | ⚡ Fast (~1s) | None |
| `npm run test:e2e:full` | E2E tests | 🐢 Slow (~2min) | Docker |
| `npm run test:coverage` | Coverage report | ⚡ Fast (~1s) | None |
| `npm run test:ui` | Interactive UI | ⚡ Fast | Browser |

**Recommended workflow:**
1. Write code
2. Run `npm test` frequently (fast feedback)
3. Before commit: `npm run test:e2e:full` (full validation)
4. CI/CD runs everything automatically

