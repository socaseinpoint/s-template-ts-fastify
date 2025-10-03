# Testing Guide

Unit and E2E testing with Vitest.

---

## Running Tests

```bash
npm test                 # Unit tests (fast)
npm run test:unit:watch  # Watch mode
npm run test:coverage    # Coverage
npm run test:e2e:full    # E2E tests (slow)
```

---

## Test Types

### Unit Tests
- **Speed:** ~250ms
- **Services:** Mocked
- **Coverage:** 80%+

### E2E Tests
- **Speed:** ~2min
- **Services:** Real (Docker)
- **Coverage:** Critical paths

---

## Writing Unit Tests

### Service Test

```typescript
// tests/unit/modules/users/user.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { UserService } from '@/modules/users/user.service'
import { createMockUserRepository } from '@tests/mocks/database.mock'

describe('UserService', () => {
  let service: UserService
  let mockRepo: IUserRepository

  beforeEach(() => {
    mockRepo = createMockUserRepository()
    service = new UserService(mockRepo)
  })

  it('should create user', async () => {
    mockRepo.create.mockResolvedValue(mockUser)
    
    const result = await service.create({ email: 'test@test.com' })
    
    expect(result).toBeDefined()
    expect(mockRepo.create).toHaveBeenCalledOnce()
  })
})
```

### Worker Test

```typescript
// tests/unit/modules/jobs/video.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processVideoJob } from '@/modules/jobs/video.worker'

describe('VideoWorker', () => {
  it('should process job', async () => {
    const mockJob = {
      id: '1',
      data: { userId: '123', scriptId: '456' },
      updateProgress: vi.fn(),
    } as any

    const result = await processVideoJob(mockJob)
    
    expect(result).toBeDefined()
    expect(mockJob.updateProgress).toHaveBeenCalledWith(50)
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
  })
})
```

---

## Writing E2E Tests

### API Test

```typescript
// tests/e2e/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import axios from 'axios'

describe('Auth E2E', () => {
  let api

  beforeAll(() => {
    api = axios.create({ baseURL: 'http://localhost:3001' })
  })

  it('should register and login', async () => {
    // Register
    const registerRes = await api.post('/v1/auth/register', {
      email: 'test@test.com',
      password: 'Test123!',
      name: 'Test User',
    })
    expect(registerRes.status).toBe(201)

    // Login
    const loginRes = await api.post('/v1/auth/login', {
      email: 'test@test.com',
      password: 'Test123!',
    })
    expect(loginRes.status).toBe(200)
    expect(loginRes.data).toHaveProperty('accessToken')
  })
})
```

### Queue Test

```typescript
// tests/e2e/queue.test.ts
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { processVideoJob } from '@/modules/jobs/video.worker'

describe('Queue E2E', () => {
  let redis, queue, worker

  beforeAll(async () => {
    redis = new IORedis('redis://localhost:6379')
    queue = new Queue('test-video', { connection: redis })
    worker = new Worker('test-video', processVideoJob, {
      connection: redis.duplicate(),
    })
  })

  afterAll(async () => {
    await worker.close()
    await queue.obliterate({ force: true })
    await queue.close()
    await redis.quit()
  })

  it('should process job end-to-end', async () => {
    const job = await queue.add('test', {
      userId: '123',
      scriptId: '456',
    })

    const result = await job.waitUntilFinished(queue.events, 5000)
    
    expect(result).toBeDefined()
    expect(result.videoUrl).toBeDefined()
  }, 10000)
})
```

---

## Mocking

### Database

```typescript
import { createMockPrisma } from '@tests/mocks/database.mock'

const mockPrisma = createMockPrisma()
mockPrisma.user.findUnique.mockResolvedValue(mockUser)
```

### Redis

```typescript
import { createMockRedis } from '@tests/mocks/redis.mock'

const mockRedis = createMockRedis()
```

### Queue

```typescript
import { MockQueue } from '@tests/mocks/bullmq.mock'

vi.mock('bullmq', () => ({ Queue: MockQueue }))
```

---

## Coverage

```bash
npm run test:coverage
```

Target: **80%+** for all metrics

---

## E2E Setup

E2E tests use real services via Docker:

```bash
# Start test services
npm run docker:test:up

# Run E2E tests
npm run test:e2e

# Stop services
npm run docker:test:down
```

Or use automated script:
```bash
npm run test:e2e:full   # Starts services, runs tests, stops services
```

---

## Debugging

### VS Code

`.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run"],
  "console": "integratedTerminal"
}
```

### CLI

```bash
# Verbose logs
LOG_LEVEL=debug npm test

# Specific test
npm test -- video.test

# Watch mode
npm run test:unit:watch
```

---

## Best Practices

### ✅ DO
- Test business logic
- Use mocks for external services
- Test error cases
- Clean up after E2E tests
- Use descriptive names

### ❌ DON'T
- Test framework code
- Share state between tests
- Skip E2E for critical features
- Ignore flaky tests
- Leave services running

---

## CI/CD

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ci
```

---

## Troubleshooting

**Tests timeout:**
```typescript
it('slow test', async () => {
  // ...
}, 10000)  // 10s timeout
```

**E2E fails:**
```bash
npm run docker:test:up
npm run test:e2e
```

**Coverage low:**
- Add tests for uncovered files
- Test error branches

---

## Next Steps

- Check examples in `tests/unit/` and `tests/e2e/`
- Write tests for your custom jobs
- Set up CI/CD pipeline
