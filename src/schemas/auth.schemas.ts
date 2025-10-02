import { z } from 'zod'

/**
 * Password validation with security requirements
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password too long (max 72 characters for bcrypt)') // Prevent DoS via bcrypt
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')

/**
 * Email validation
 */
const emailSchema = z.string().email('Invalid email format').toLowerCase()

/**
 * User object schema (response)
 */
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
})

export type User = z.infer<typeof userSchema>

/**
 * Login DTO schema
 */
export const loginDtoSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(72, 'Password too long'),
})

export type LoginDto = z.infer<typeof loginDtoSchema>

/**
 * Login response schema
 */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSchema,
})

export type LoginResponse = z.infer<typeof loginResponseSchema>

/**
 * Register DTO schema
 */
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

/**
 * Register response schema
 */
export const registerResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSchema,
})

export type RegisterResponse = z.infer<typeof registerResponseSchema>

/**
 * Refresh token DTO schema
 */
export const refreshTokenDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export type RefreshTokenDto = z.infer<typeof refreshTokenDtoSchema>

/**
 * Refresh token response schema
 */
export const refreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
})

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>

/**
 * Logout response schema
 */
export const logoutResponseSchema = z.object({
  message: z.string(),
})

export type LogoutResponse = z.infer<typeof logoutResponseSchema>

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.number(),
  details: z.array(z.any()).optional(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

/**
 * Change password DTO schema
 */
export const changePasswordDtoSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
})

export type ChangePasswordDto = z.infer<typeof changePasswordDtoSchema>
