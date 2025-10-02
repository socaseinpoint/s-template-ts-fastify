export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { 
        type: 'string', 
        format: 'email',
        description: 'User email address',
      },
      password: { 
        type: 'string', 
        minLength: 6,
        description: 'User password',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  },
} as const

export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { 
        type: 'string', 
        format: 'email',
        description: 'User email address',
      },
      password: { 
        type: 'string', 
        minLength: 6,
        description: 'User password',
      },
      name: { 
        type: 'string', 
        minLength: 2,
        maxLength: 100,
        description: 'User full name',
      },
      phone: { 
        type: 'string',
        pattern: '^[+]?[0-9]{10,15}$',
        description: 'User phone number',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  },
} as const

export const refreshSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { 
        type: 'string',
        description: 'JWT refresh token',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  },
} as const
