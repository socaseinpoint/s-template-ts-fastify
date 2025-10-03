# Architecture Principles

Core design rules for worker/API separation.

---

## 🎯 Golden Rule

**Each database field has exactly ONE writer.**

Never let both API and Worker write to the same field.

---

## ✅ Worker Responsibilities

**Worker DOES:**
- Call external APIs (HTTP requests)
- Return result data
- Throw errors for retry
- Update job progress

**Worker DOES NOT:**
- Write to database
- Make business decisions
- Trigger other jobs directly
- Store state in memory

---

## 📋 Pattern: Worker Returns → API Writes

```typescript
// ========================================
// Worker (NO database)
// ========================================
export async function processJob(job: Job) {
  // Call external API
  const result = await externalAPI(job.data)
  
  // Return data (NO prisma.update!)
  return {
    entityId: job.data.entityId,
    externalId: result.id,
    data: result.data,
  }
}

// ========================================
// API Event Handler (writes to database)
// ========================================
myQueue.on('completed', async (job, result) => {
  // API is the ONLY writer
  await prisma.entity.update({
    where: { id: result.entityId },
    data: {
      externalId: result.externalId,
      resultData: result.data,
      status: 'completed',
    },
  })
})

myQueue.on('failed', async (job, error) => {
  await prisma.entity.update({
    where: { id: job.data.entityId },
    data: {
      status: 'failed',
      error: error.message,
    },
  })
})
```

---

## 🔒 Why This Separation?

### 1. **No Race Conditions**
```
Only API writes = predictable state
Multiple writers = chaos
```

### 2. **Lightweight Workers**
```
No DB connections = fast startup
Easy to scale = add more workers instantly
```

### 3. **Single Source of Truth**
```
All DB logic in one place (API)
Easy to debug and maintain
```

### 4. **Independent Scaling**
```
Scale workers without touching API
Scale API without touching workers
```

---

## 🚫 Anti-Patterns

### ❌ Worker Writing to Database

```typescript
// DON'T DO THIS
export async function processJob(job: Job) {
  const result = await externalAPI()
  
  // ❌ Worker writes to DB
  await prisma.update({ data: result })
  
  return result
}
```

### ❌ Multiple Writers

```typescript
// DON'T DO THIS
// Worker
await prisma.update({ status: 'processing' })

// API Webhook  
await prisma.update({ status: 'completed' })

// Which wins? Unpredictable!
```

### ❌ Worker Orchestration

```typescript
// DON'T DO THIS
export async function processJob(job: Job) {
  const result = await externalAPI()
  
  // ❌ Worker triggers next job
  await nextQueue.add('process', result)
  
  return result
}

// DO THIS INSTEAD
// Let API event handler orchestrate
myQueue.on('completed', async (job, result) => {
  // Save to DB
  await prisma.update({ data: result })
  
  // Trigger next step
  if (shouldProceed(result)) {
    await nextQueue.add('process', { ... })
  }
})
```

---

## 📚 Summary

**3 Simple Rules:**
1. Worker = External API calls
2. API = Database writes
3. Never mix them

This keeps code simple, scalable, and debuggable.

---

**Read:** [Worker Patterns](./WORKER_PATTERNS.md) for code examples
