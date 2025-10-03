/**
 * Job Processors (Workers)
 *
 * Pattern: One file per job type
 * - Simple to understand
 * - Easy to find
 * - Minimal boilerplate
 *
 * Add new jobs:
 *   1. Create src/jobs/my-task.ts
 *   2. Export from here
 *   3. Register in worker.ts
 */

export * from './webhook'

// Add your jobs here:
// export * from './replicate'
// export * from './openai'
// export * from './ffmpeg'
// export * from './s3-upload'
