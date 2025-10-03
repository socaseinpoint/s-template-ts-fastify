# Workers & Background Jobs Guide

Comprehensive guide to using BullMQ workers and background job processing in this template.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Operating Modes](#operating-modes)
- [Creating Jobs](#creating-jobs)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [Monitoring & Debugging](#monitoring--debugging)
- [Best Practices](#best-practices)

---

## Overview

This template includes **BullMQ** for robust background job processing with:

✅ **Retry logic** - Exponential backoff for failed jobs  
✅ **Concurrency** - Process multiple jobs in parallel  
✅ **Priority queues** - Prioritize urgent tasks  
✅ **Job persistence** - Redis-backed durability  
✅ **Progress tracking** - Real-time job status  
✅ **Graceful shutdown** - No job data loss  
✅ **Flexible deployment** - All-in-one or separate workers

---

## Quick Start

### 1. Run Everything in One Process (Development)

```bash
# Start API + Workers together (MODE=all - default)
npm run dev
```

Access:
- API: http://localhost:3000
- Swagger: http://localhost:3000/docs

### 2. Run Workers Separately (Production-like)

```bash
# Terminal 1: API only
MODE=api npm run dev

# Terminal 2: Workers only
MODE=worker npm run dev:worker
```

### 3. Test the Example Job

```bash
# Add a webhook job via API
curl -X POST http://localhost:3000/v1/jobs/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/webhook",
    "payload": {"event": "test", "data": "hello"}
  }'
```

Check worker logs to see job processing!

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                  Your Application                    │
│                                                       │
│  ┌─────────────┐         ┌─────────────────────┐   │
│  │  API Server │ ──add──▶│  Queue (BullMQ)     │   │
│  │  (Fastify)  │         │  - webhook-processor│   │
│  └─────────────┘         │  - video-processor  │   │
│                          │  - email-sender     │   │
│                          └─────────────────────┘   │
│                                    │                 │
│                                    │ Redis           │
│                                    ▼                 │
│  ┌──────────────────────────────────────────────┐  │
│  │  Workers (BullMQ)                            │  │
│  │  - Process jobs with retry & concurrency     │  │
│  │  - Update progress                           │  │
│  │  - Handle failures                           │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Files Structure

```
src/
├── modules/
│   └── jobs/                      # Job definitions
│       ├── webhook-processor.queue.ts   # Queue setup
│       ├── webhook-processor.worker.ts  # Job processor
│       └── index.ts
├── shared/
│   └── queue/                     # Queue infrastructure
│       ├── queue.service.ts       # Queue management
│       ├── worker.service.ts      # Worker management
│       ├── redis-connection.ts    # BullMQ Redis setup
│       └── index.ts
├── server.ts                      # API entry point (can include workers)
└── worker.ts                      # Worker-only entry point
```

---

## Operating Modes

The service supports **3 modes** via the `MODE` environment variable:

### 1. `MODE=all` (Default - Development)

**One process runs both API + Workers**

```bash
npm run dev          # Development
npm run start:all    # Production
```

✅ **Pros:**
- Simple deployment (one container)
- Easy local development
- Good for MVP / low traffic

❌ **Cons:**
- Can't scale API and workers independently
- Higher memory usage per process

**Use when:**
- Local development
- MVP / small projects
- Single server deployment

---

### 2. `MODE=api` (API Only)

**Run only the API server, no workers**

```bash
MODE=api npm run dev       # Development
MODE=api npm run start     # Production
```

✅ **Pros:**
- Lightweight API instances
- Scale API independently
- No worker overhead

**Use when:**
- Multi-service deployment
- Need to scale API separately
- Workers run on different servers

---

### 3. `MODE=worker` (Workers Only)

**Run only workers, no API server**

```bash
MODE=worker npm run dev:worker    # Development
MODE=worker npm run start:worker  # Production
```

✅ **Pros:**
- Dedicated worker instances
- Scale workers independently
- Optimize resources per job type

**Use when:**
- High job volume
- Need multiple worker instances
- Separation of concerns (API vs background processing)

---

## Creating Jobs

### Step 1: Define Job Data Type

```typescript
// src/modules/jobs/my-job.queue.ts

export interface MyJobData {
  userId: string
  videoUrl: string
  options?: {
    quality: 'low' | 'medium' | 'high'
  }
}

export const QUEUE_NAMES = {
  MY_JOB: 'my-job-queue',
} as const
```

### Step 2: Create Queue Producer

```typescript
// src/modules/jobs/my-job.queue.ts (continued)

import { Queue } from 'bullmq'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('MyJobQueue')

export async function addMyJob(queue: Queue<MyJobData>, data: MyJobData) {
  logger.info('Adding job to queue', { userId: data.userId })

  const job = await queue.add('process-my-job', data, {
    attempts: 3,          // Retry up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,        // Start with 2s delay
    },
    priority: 1,          // Lower = higher priority
  })

  logger.info(`Job added: ${job.id}`)
  return job
}
```

### Step 3: Create Worker Processor

```typescript
// src/modules/jobs/my-job.worker.ts

import { Job } from 'bullmq'
import { MyJobData } from './my-job.queue'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('MyJobWorker')

export async function processMyJob(job: Job<MyJobData>): Promise<{ success: boolean }> {
  const { userId, videoUrl, options } = job.data

  logger.info(`Processing job ${job.id}`, { userId })

  try {
    // Report progress (optional)
    await job.updateProgress(10)

    // Your business logic here
    // Example: Generate video, send email, process data, etc.
    await doActualWork(videoUrl, options)

    await job.updateProgress(100)

    logger.info(`Job ${job.id} completed`)
    return { success: true }

  } catch (error) {
    logger.error(`Job ${job.id} failed`, error)
    throw error  // Re-throw to trigger retry
  }
}

async function doActualWork(url: string, options: any) {
  // Replace with actual implementation:
  // - Call Replicate API
  // - Send HTTP requests
  // - Process files
  // - Update database
  // etc.
}
```

### Step 4: Register Queue in Container

```typescript
// src/container.ts

// Add to ICradle interface
export interface ICradle {
  // ... existing
  myJobQueue?: Queue<MyJobData>
}

// In createDIContainer(), after other queues:
if (options.enableQueues && options.redisConnection) {
  // ... existing queue registrations

  const myJobQueue = queueService.createQueue<MyJobData>(QUEUE_NAMES.MY_JOB)
  
  container.register({
    myJobQueue: asValue(myJobQueue),
  })
}
```

### Step 5: Register Worker Processor

```typescript
// src/worker.ts (for MODE=worker)
// OR src/server.ts (for MODE=all)

import { processMyJob } from '@/modules/jobs/my-job.worker'
import { QUEUE_NAMES } from '@/modules/jobs/my-job.queue'

// In worker registration section:
workerService.createWorker(QUEUE_NAMES.MY_JOB, processMyJob, {
  concurrency: Config.QUEUE_CONCURRENCY,
})
```

### Step 6: Use in API Routes

```typescript
// src/modules/jobs/jobs.controller.ts

import { FastifyReply, FastifyRequest } from 'fastify'
import { addMyJob } from './my-job.queue'

export async function createJobHandler(
  request: FastifyRequest<{ Body: { userId: string; videoUrl: string } }>,
  reply: FastifyReply
) {
  const container = request.server.diContainer
  const myJobQueue = container.cradle.myJobQueue

  if (!myJobQueue) {
    return reply.code(503).send({ error: 'Queue service not available' })
  }

  const job = await addMyJob(myJobQueue, {
    userId: request.body.userId,
    videoUrl: request.body.videoUrl,
  })

  return reply.code(202).send({
    jobId: job.id,
    status: 'queued',
    message: 'Job added to queue',
  })
}
```

---

## Configuration

### Environment Variables

```bash
# Service mode
MODE=all                    # all | api | worker (default: all)

# Redis (required for queues)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Queue settings
QUEUE_CONCURRENCY=5              # Max concurrent jobs per worker (default: 5)
QUEUE_REMOVE_ON_COMPLETE=100     # Keep last N completed jobs (default: 100)
QUEUE_REMOVE_ON_FAIL=1000        # Keep last N failed jobs (default: 1000)
```

### Queue Options

Customize per-queue behavior:

```typescript
const queue = queueService.createQueue<MyJobData>('my-queue', {
  defaultJobOptions: {
    attempts: 5,              // Max retries
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 50,     // Override global setting
    removeOnFail: 500,
  },
})
```

### Worker Options

Customize per-worker behavior:

```typescript
workerService.createWorker('my-queue', processMyJob, {
  concurrency: 10,            // Process 10 jobs in parallel
  limiter: {
    max: 100,                 // Max 100 jobs
    duration: 60000,          // Per 60 seconds
  },
})
```

---

## Production Deployment

### Docker Compose Example

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    environment:
      MODE: api                # API only
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://...
    ports:
      - "3000:3000"
    depends_on:
      - redis

  worker:
    build: .
    command: npm run start:worker
    environment:
      MODE: worker             # Workers only
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://...
      QUEUE_CONCURRENCY: 10
    depends_on:
      - redis
    # Scale workers:
    # docker compose up --scale worker=3
```

### Kubernetes Example

```yaml
# API Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: myapp:latest
        env:
        - name: MODE
          value: "api"
        - name: REDIS_URL
          value: "redis://redis-service:6379"

---
# Worker Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 5  # Scale independently!
  template:
    spec:
      containers:
      - name: worker
        image: myapp:latest
        command: ["npm", "run", "start:worker"]
        env:
        - name: MODE
          value: "worker"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: QUEUE_CONCURRENCY
          value: "10"
```

---

## Monitoring & Debugging

### View Queue Status

Use **BullMQ Board** (optional UI):

```bash
npm install -g bull-board

# In your code or separate service:
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'

const serverAdapter = new FastifyAdapter()
createBullBoard({
  queues: [new BullMQAdapter(myQueue)],
  serverAdapter,
})

fastify.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })
```

Access: http://localhost:3000/admin/queues

### Logs

Workers emit detailed logs:

```
INFO  [WorkerService] Creating worker for queue: webhook-processor
INFO  [WorkerService] 🟢 Worker for queue 'webhook-processor' is ready
INFO  [WebhookWorker] ⚙️  Job 123 started in queue 'webhook-processor'
INFO  [WebhookWorker] ✅ Job 123 completed
ERROR [WebhookWorker] ❌ Job 456 failed (attempt 1/3)
```

### Redis CLI

Inspect queues manually:

```bash
redis-cli

# List all keys
KEYS bull:*

# Check queue length
LLEN bull:webhook-processor:wait

# View failed jobs
LRANGE bull:webhook-processor:failed 0 -1
```

---

## Best Practices

### ✅ DO

1. **Keep jobs idempotent** - Safe to retry
2. **Use progress updates** - For long-running jobs
3. **Log with context** - Include jobId, userId, etc.
4. **Set appropriate timeouts** - Don't block forever
5. **Handle failures gracefully** - Log errors, notify admins
6. **Use job priorities** - Urgent jobs first
7. **Monitor queue health** - Track queue length, failures
8. **Test job processors** - Unit test your worker logic

### ❌ DON'T

1. **Don't store large data in jobs** - Use references (URLs, IDs)
2. **Don't use global state** - Workers can run anywhere
3. **Don't ignore failed jobs** - Monitor and handle them
4. **Don't skip error handling** - Always try/catch
5. **Don't set infinite retries** - Limit attempts
6. **Don't block on external APIs** - Use timeouts
7. **Don't forget graceful shutdown** - Finish current jobs

---

## Common Patterns

### Pattern 1: Multi-Stage Pipeline

For complex workflows (like video generation):

```typescript
// Stage 1: Generate script
const scriptJob = await scriptQueue.add('generate', { userId })

// Stage 2: Generate images (parallel)
scriptJob.waitUntilFinished().then(async (result) => {
  await Promise.all(
    result.scenes.map(scene =>
      imageQueue.add('generate', { sceneId: scene.id })
    )
  )
})

// Stage 3: Generate video chunks
// Stage 4: Merge videos
// etc.
```

Or use **BullMQ Flows** (advanced):

```typescript
import { FlowProducer } from 'bullmq'

const flow = await flowProducer.add({
  name: 'video-generation',
  queueName: 'videos',
  children: [
    { name: 'generate-script', queueName: 'ai' },
    { name: 'generate-images', queueName: 'images' },
    { name: 'generate-video', queueName: 'video' },
  ],
})
```

### Pattern 2: Webhook Retry

```typescript
export async function processWebhook(job: Job<WebhookData>) {
  const { url, payload } = job.data

  try {
    const response = await axios.post(url, payload, {
      timeout: 10000,  // 10s timeout
    })

    if (response.status !== 200) {
      throw new Error(`Webhook failed: ${response.status}`)
    }

    return { success: true }
  } catch (error) {
    // BullMQ will auto-retry with exponential backoff
    throw error
  }
}
```

### Pattern 3: Rate Limiting

```typescript
workerService.createWorker('api-calls', processApiCall, {
  limiter: {
    max: 10,        // Max 10 requests
    duration: 1000, // Per second
  },
})
```

---

## Troubleshooting

### Jobs not processing

1. Check Redis connection: `redis-cli ping`
2. Verify worker is running: Check logs for "Worker ready"
3. Check MODE: Should be `all` or `worker`
4. Check queue name: Must match exactly

### Jobs failing silently

1. Check worker error logs
2. Verify job processor throws errors
3. Check `attempts` configuration
4. Look for failed jobs in Redis

### High memory usage

1. Lower `QUEUE_REMOVE_ON_COMPLETE`
2. Lower `QUEUE_REMOVE_ON_FAIL`
3. Process smaller batches
4. Scale workers horizontally

### Slow job processing

1. Increase `QUEUE_CONCURRENCY`
2. Scale worker instances
3. Optimize job processor code
4. Check external API latency

---

## Next Steps

- 📖 Read [BullMQ Documentation](https://docs.bullmq.io/)
- 🔧 Customize job examples for your use case
- 📊 Add monitoring (BullMQ Board, Prometheus, etc.)
- 🚀 Deploy to production with separate API/Worker instances

---

**Questions?** Check the main [README](../README.md) or open an issue!

