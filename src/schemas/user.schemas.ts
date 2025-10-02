export const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    phone: { type: 'string' },
    role: { 
      type: 'string',
      enum: ['admin', 'user', 'moderator'],
    },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const

export const updateUserSchema = {
  type: 'object',
  properties: {
    name: { 
      type: 'string', 
      minLength: 2,
      maxLength: 100,
    },
    phone: { 
      type: 'string',
      pattern: '^[+]?[0-9]{10,15}$',
    },
    role: { 
      type: 'string',
      enum: ['admin', 'user', 'moderator'],
    },
    isActive: { type: 'boolean' },
  },
} as const

export const createUserSchema = {
  type: 'object',
  required: ['email', 'name', 'password'],
  properties: {
    email: { 
      type: 'string', 
      format: 'email',
    },
    name: { 
      type: 'string', 
      minLength: 2,
      maxLength: 100,
    },
    password: { 
      type: 'string', 
      minLength: 6,
    },
    phone: { 
      type: 'string',
      pattern: '^[+]?[0-9]{10,15}$',
    },
    role: { 
      type: 'string',
      enum: ['admin', 'user', 'moderator'],
      default: 'user',
    },
  },
} as const
