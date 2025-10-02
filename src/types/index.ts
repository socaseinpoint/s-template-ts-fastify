export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: 'admin' | 'user' | 'moderator'
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
