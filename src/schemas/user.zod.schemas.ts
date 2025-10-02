import { z } from 'zod'

/**
 * User role enum
 */
export const userRoleSchema = z.enum(['admin', 'user', 'moderator'])
export type UserRole = z.infer<typeof userRoleSchema>

/**
 * User schema (response)
 */
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().optional(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})

export type UserResponse = z.infer<typeof userResponseSchema>

/**
 * Create user DTO schema
 */
export const createUserDtoSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z
    .string()
    .regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number format')
    .optional(),
  role: userRoleSchema.default('user'),
})

export type CreateUserDto = z.infer<typeof createUserDtoSchema>

/**
 * Update user DTO schema
 */
export const updateUserDtoSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .optional(),
  phone: z
    .string()
    .regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number format')
    .optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
})

export type UpdateUserDto = z.infer<typeof updateUserDtoSchema>

/**
 * Get users query parameters schema
 */
export const getUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
})

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>

/**
 * Get users response schema
 */
export const getUsersResponseSchema = z.object({
  users: z.array(userResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type GetUsersResponse = z.infer<typeof getUsersResponseSchema>

/**
 * User ID params schema
 */
export const userIdParamsSchema = z.object({
  id: z.string(),
})

export type UserIdParams = z.infer<typeof userIdParamsSchema>

/**
 * Delete user response schema
 */
export const deleteUserResponseSchema = z.object({
  message: z.string(),
})

export type DeleteUserResponse = z.infer<typeof deleteUserResponseSchema>

/**
 * Error response schema (403)
 */
export const forbiddenErrorSchema = z.object({
  error: z.string(),
  code: z.number(),
})

export type ForbiddenError = z.infer<typeof forbiddenErrorSchema>

/**
 * Error response schema (404)
 */
export const notFoundErrorSchema = z.object({
  error: z.string(),
  code: z.number(),
})

export type NotFoundError = z.infer<typeof notFoundErrorSchema>
