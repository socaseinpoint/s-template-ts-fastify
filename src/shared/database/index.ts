/**
 * Database Module
 * Exports database services and base repository
 */

export { default as prisma } from './prisma.service'
export { connectDatabase, disconnectDatabase } from './prisma.service'
export { BaseRepository, type PaginationResponse } from './base.repository'

