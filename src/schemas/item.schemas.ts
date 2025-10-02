export const itemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    category: { 
      type: 'string',
      enum: ['electronics', 'clothing', 'food', 'books', 'other'],
    },
    price: { 
      type: 'number',
      minimum: 0,
    },
    quantity: { 
      type: 'number',
      minimum: 0,
    },
    status: { 
      type: 'string',
      enum: ['available', 'out_of_stock', 'discontinued'],
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
    },
    userId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const

export const createItemSchema = {
  type: 'object',
  required: ['name', 'category', 'price'],
  properties: {
    name: { 
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    description: { 
      type: 'string',
      maxLength: 1000,
    },
    category: { 
      type: 'string',
      enum: ['electronics', 'clothing', 'food', 'books', 'other'],
    },
    price: { 
      type: 'number',
      minimum: 0,
    },
    quantity: { 
      type: 'number',
      minimum: 0,
      default: 0,
    },
    status: { 
      type: 'string',
      enum: ['available', 'out_of_stock', 'discontinued'],
      default: 'available',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 10,
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const

export const updateItemSchema = {
  type: 'object',
  properties: {
    name: { 
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    description: { 
      type: 'string',
      maxLength: 1000,
    },
    category: { 
      type: 'string',
      enum: ['electronics', 'clothing', 'food', 'books', 'other'],
    },
    price: { 
      type: 'number',
      minimum: 0,
    },
    quantity: { 
      type: 'number',
      minimum: 0,
    },
    status: { 
      type: 'string',
      enum: ['available', 'out_of_stock', 'discontinued'],
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 10,
    },
    metadata: {
      type: 'object',
      additionalProperties: true,
    },
  },
} as const
