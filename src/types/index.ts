import { UserRole } from '@/constants'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Item {
  id: string
  name: string
  description?: string
  category: 'electronics' | 'clothing' | 'food' | 'books' | 'other'
  price: number
  quantity: number
  status: 'available' | 'out_of_stock' | 'discontinued'
  tags?: string[]
  metadata?: Record<string, any>
  userId: string
  createdAt: string
  updatedAt: string
}

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationResult<T> {
  items: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// JWT Payload
export interface TokenPayload {
  id: string
  email: string
  role: UserRole
  type: 'access' | 'refresh'
  [key: string]: unknown // Allow additional properties for JWT
}

// Auth DTOs
export interface LoginDto {
  email: string
  password: string
}

export interface RegisterDto {
  email: string
  password: string
  name: string
  phone?: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role: UserRole
  }
}

// Service Health
export interface ServiceHealth {
  redis: boolean
  postgres: boolean
}
