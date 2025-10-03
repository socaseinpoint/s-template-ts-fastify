import { z } from 'zod'

// ============================================
// Response DTOs
// ============================================

export interface UserResponseDto {
  id: string
  email: string
  name: string
  phone?: string
  role: 'user' | 'admin' | 'moderator'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UsersPaginationResponse {
  users: UserResponseDto[]
  total: number
  page: number
  limit: number
}

// ============================================
// Request DTOs
// ============================================

export const updateUserDtoSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number format')
    .optional(),
  role: z.enum(['user', 'admin', 'moderator']).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateUserDto = z.infer<typeof updateUserDtoSchema>

// ============================================
// Query DTOs
// ============================================

export const getUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
})

export type GetUsersQueryDto = z.infer<typeof getUsersQuerySchema>
