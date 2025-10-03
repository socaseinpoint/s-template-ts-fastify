# Worker Patterns & Best Practices

Quick guide on worker responsibilities and patterns.

---

## 🎯 Worker Role (In 3 Sentences)

**Workers process background jobs by calling external APIs.**  
**They return results to BullMQ, and API event handlers write to database.**  
**This separation prevents race conditions and keeps workers lightweight.**

---

## ✅ Worker Checklist

### Worker SHOULD:
- ✅ Make HTTP calls to external APIs (Replicate, OpenAI, SendGrid, etc.)
- ✅ Return result data to BullMQ
- ✅ Throw errors for BullMQ to retry
- ✅ Update job progress (for UI feedback)
- ✅ Be stateless (no instance variables)

### Worker SHOULD NOT:
- ❌ Write to database (use API event handlers)
- ❌ Make business logic decisions (keep in services)
- ❌ Trigger other jobs directly (return data, let API orchestrate)
- ❌ Store state in memory (workers can be killed/restarted)

---

## 📝 Code Template

### Worker Template (External API Call)

```typescript
import { Job } from 'bullmq'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('MyWorker')

export interface MyJobData {
  entityId: string
  // ... other data needed for API call
}

export interface MyJobResult {
  entityId: string
  // ... data to be saved by API event handler
}

/**
 * Worker: Calls external API
 * NO database access
 */
export async function processMyJob(job: Job<MyJobData>): Promise<MyJobResult> {
  const { entityId } = job.data
  
  logger.info(`Processing job`, { jobId: job.id, entityId })
  
  try {
    // Update progress (optional - for UI)
    await job.updateProgress(10)
    
    // Call external API (main work)
    const result = await callExternalAPI(job.data)
    
    await job.updateProgress(100)
    
    logger.info(`✅ Job completed`, { jobId: job.id, entityId })
    
    // Return result (API will write to DB)
    return {
      entityId,
      ...result,
    }
  } catch (error) {
    logger.error(`❌ Job failed`, {
      jobId: job.id,
      entityId,
      error: error instanceof Error ? error.message : 'Unknown',
    })
    
    // Throw for BullMQ retry
    throw error
  }
}

async function callExternalAPI(data: MyJobData) {
  // Your external API logic here
  // Examples:
  // - await replicate.predictions.create(...)
  // - await openai.chat.completions.create(...)
  // - await sendgrid.send(...)
  
  return { success: true }
}
```

### API Event Handler Template

```typescript
// Setup in server.ts or app.ts
import { myQueue } from '@/modules/jobs'

/**
 * Setup queue event handlers
 * Call this during API initialization
 */
export function setupQueueEventHandlers() {
  // Success handler
  myQueue.on('completed', async (job, result) => {
    const { entityId, ...data } = result
    
    // Write to database
    await prisma.myEntity.update({
      where: { id: entityId },
      data: {
        status: 'completed',
        ...data,
        completedAt: new Date(),
      },
    })
    
    logger.info(`Job result saved to DB`, { jobId: job.id, entityId })
    
    // Trigger next step if needed
    await triggerNextStep(entityId)
  })
  
  // Failure handler
  myQueue.on('failed', async (job, error) => {
    if (!job) return
    
    const { entityId } = job.data
    
    // Write error to database
    await prisma.myEntity.update({
      where: { id: entityId },
      data: {
        status: 'failed',
        error: error.message,
        failedAt: new Date(),
      },
    })
    
    logger.error(`Job failed, error saved to DB`, { 
      jobId: job.id, 
      entityId,
      error: error.message,
    })
  })
}
```

### Register in Server

```typescript
// src/server.ts
async function startServer() {
  const { fastify, container } = await createApp()
  
  // Setup queue event handlers (if MODE=all)
  if (Config.MODE === 'all') {
    await startWorkers(container)
    setupQueueEventHandlers() // ← Add this
  }
  
  await fastify.listen({ port: Config.PORT })
}
```

---

## 🏗️ Architecture Diagram

```
User Request
     │
     ▼
┌─────────────────────┐
│   API Endpoint      │
│   - Create record   │
│   - Add job         │ ✅ Initial DB write
│   - Quick response  │
└──────────┬──────────┘
           │
           ▼
     [BullMQ Queue]
           │
           ▼
┌─────────────────────┐
│   Worker            │
│   - External API    │ ❌ NO DB write
│   - Return result   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Event Handler      │
│  - Save result      │ ✅ Final DB write
│  - Trigger next     │
└──────────┬──────────┘
           │
           ▼
   Database Updated
```

**Flow:**
1. API writes initial state
2. Worker calls external API
3. Event handler writes final state
4. Single writer = no conflicts

---

## 🔒 Anti-Patterns (Don't Do This)

### ❌ Worker Writing to Database

```typescript
// ❌ BAD
export async function processJob(job: Job) {
  const result = await externalAPI()
  
  // ❌ Don't do this in worker
  await prisma.update({ data: { status: 'completed' }})
  
  return result
}
```

### ❌ Multiple Status Updates

```typescript
// ❌ BAD - Race condition risk
// Worker
await prisma.update({ status: 'processing' })

// Webhook
await prisma.update({ status: 'completed' })

// Which one wins? Unpredictable!
```

### ❌ Worker Triggering Jobs Directly

```typescript
// ❌ BAD
export async function processImageJob(job: Job) {
  const result = await replicate.create(...)
  
  // ❌ Don't orchestrate from worker
  await videoQueue.add('generate', { ... })
  
  return result
}

// ✅ GOOD - Let API event handler orchestrate
imageQueue.on('completed', async (job, result) => {
  // Check conditions
  const allReady = await checkAllReady()
  
  if (allReady) {
    await videoQueue.add('generate', { ... })
  }
})
```

---

## 📚 Summary

**Golden Rules:**
1. Worker = External API calls ONLY
2. API/Event Handlers = Database writes ONLY
3. One writer per field = No race conditions
4. Worker returns data = API decides what to save

**For your AI agent:**
- Worker calls Replicate/OpenAI
- API event handlers write results to DB
- Webhooks update final state
- Clear, debuggable, scalable! 🎯

