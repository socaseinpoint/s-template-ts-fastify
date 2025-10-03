import { z } from 'zod'

// ============================================
// Password validation
// ============================================

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password too long (max 72 characters for bcrypt)')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')

const emailSchema = z.string().email('Invalid email format').toLowerCase()

// ============================================
// Response DTOs
// ============================================

export interface UserDto {
  id: string
  email: string
  name: string
  role: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: UserDto
}

// ============================================
// Request DTOs
// ============================================

export const loginDtoSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(72, 'Password too long'),
})

export type LoginDto = z.infer<typeof loginDtoSchema>

export const registerDtoSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').trim(),
  phone: z
    .string()
    .regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number format')
    .optional(),
})

export type RegisterDto = z.infer<typeof registerDtoSchema>

export const refreshTokenDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export type RefreshTokenDto = z.infer<typeof refreshTokenDtoSchema>

export const changePasswordDtoSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
})

export type ChangePasswordDto = z.infer<typeof changePasswordDtoSchema>

