# Worker Service

Background job processing with BullMQ.

---

## What It Does

- Processes jobs from queues (async tasks)
- Automatic retries with exponential backoff
- Concurrency control (parallel processing)
- Horizontal scaling support

---

## Running

### Development
```bash
npm run dev:worker       # Workers only
npm run dev              # API + Workers
```

### Production
```bash
MODE=worker npm run start:worker
```

---

## Why Use Workers?

**Don't block API requests with:**
- Video/image generation (30s - 5min)
- AI processing (10s - 60s)
- Email sending (bulk)
- Data processing (heavy CPU/IO)
- External API calls (slow/unreliable)

**Instead:**
1. API receives request → adds job to queue → returns immediately
2. Worker picks up job → processes in background
3. User gets notified when done (webhook/polling)

---

## Creating a Job

### 1. Define Job Type

```typescript
// src/modules/jobs/video.queue.ts
export interface VideoJobData {
  userId: string
  scriptId: string
}

export const QUEUE_NAMES = {
  VIDEO: 'video-generation',
} as const
```

### 2. Create Processor

```typescript
// src/modules/jobs/video.worker.ts
import { Job } from 'bullmq'

export async function processVideoJob(job: Job<VideoJobData>) {
  const { userId, scriptId } = job.data
  
  // Your logic here
  await job.updateProgress(50)
  const video = await generateVideo(scriptId)
  await job.updateProgress(100)
  
  return { videoUrl: video.url }
}
```

### 3. Register Worker

```typescript
// src/worker.ts
import { processVideoJob } from '@/modules/jobs/video.worker'
import { QUEUE_NAMES } from '@/modules/jobs/video.queue'

workerService.createWorker(QUEUE_NAMES.VIDEO, processVideoJob)
```

### 4. Add Job from API

```typescript
// In API controller
const job = await videoQueue.add('generate', {
  userId: user.id,
  scriptId: script.id,
})

return { jobId: job.id, status: 'queued' }
```

---

## Configuration

### Environment

```bash
MODE=worker
REDIS_URL=redis://...
DATABASE_URL=postgresql://...   # If workers need DB
QUEUE_CONCURRENCY=10            # Jobs per worker
```

### Concurrency

```bash
# Low (CPU-heavy jobs)
QUEUE_CONCURRENCY=2

# Medium
QUEUE_CONCURRENCY=5

# High (I/O jobs)
QUEUE_CONCURRENCY=20
```

---

## Retry Logic

Default: 3 retries with exponential backoff (1s → 2s → 4s)

### Customize

```typescript
await queue.add('my-job', data, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,  // Start with 2s
  },
})
```

---

## Scaling

### Horizontal (Multiple Workers)

```bash
# Docker Compose
docker compose -f docker-compose.prod.worker.yml up -d --scale worker=5

# Manual
MODE=worker npm start:worker  # Terminal 1
MODE=worker npm start:worker  # Terminal 2
MODE=worker npm start:worker  # Terminal 3
```

All workers share same Redis queue → distributed processing.

### When to Scale

- Queue length > 100 → add workers
- Queue wait time > 60s → add workers
- Worker CPU > 80% → add workers

---

## Monitoring

### Logs

```bash
# Docker
docker logs worker -f

# Docker Compose
docker compose -f docker-compose.prod.worker.yml logs -f
```

Output:
```
INFO  [WorkerService] Worker ready
INFO  [VideoWorker] Job 123 started
INFO  [VideoWorker] Job 123 progress: 50%
INFO  [VideoWorker] Job 123 completed (45s)
```

### Queue Metrics

```bash
# Queue length
redis-cli LLEN "bull:video-generation:wait"

# Failed jobs
redis-cli LLEN "bull:video-generation:failed"

# Active jobs
redis-cli LLEN "bull:video-generation:active"
```

---

## Multi-Stage Pipeline

For complex workflows (video generation):

```typescript
// Stage 1: Generate script
const scriptJob = await scriptQueue.add('generate', { userId })

// Stage 2: Generate images (parallel)
scriptJob.waitUntilFinished().then(async (script) => {
  await Promise.all(
    script.scenes.map(scene =>
      imageQueue.add('generate', { sceneId: scene.id })
    )
  )
})

// Stage 3: Generate video chunks (parallel)
// Stage 4: Merge videos
```

---

## Docker

### Build
```bash
docker build -f Dockerfile.worker -t myapp-worker .
```

### Run
```bash
docker run \
  -e MODE=worker \
  -e REDIS_URL="redis://..." \
  -e QUEUE_CONCURRENCY=10 \
  myapp-worker
```

### Deploy
```bash
docker compose -f docker-compose.prod.worker.yml up -d
```

---

## Best Practices

### ✅ DO
- Keep jobs idempotent (safe to retry)
- Update progress for long jobs
- Log with context (jobId, userId)
- Handle errors (try/catch)
- Set timeouts

### ❌ DON'T
- Store large data in jobs (use URLs/IDs)
- Use global state
- Ignore failed jobs
- Set infinite retries
- Block on sync operations

---

## Troubleshooting

**Jobs not processing:**
```bash
# Check worker running
docker ps | grep worker

# Check Redis
redis-cli ping

# Check logs
docker logs worker --tail 50
```

**High memory:**
- Lower `QUEUE_CONCURRENCY`
- Optimize job processor
- Scale horizontally

**Jobs failing:**
- Check error logs
- Verify external API availability
- Check retry configuration

---

## Next Steps

- 📖 [Workers Guide](./WORKERS.md) - Advanced patterns
- 🚀 [Production Setup](./PRODUCTION_SETUP.md) - Deploy
- 🧪 [Testing](./TESTING.md) - Test your jobs
