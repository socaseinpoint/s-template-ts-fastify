export interface TestItem {
  id: string
  name: string
  description: string
  price: number
  userId: string
  createdAt: Date
  updatedAt: Date
}

export const testItems: TestItem[] = [
  {
    id: '1',
    name: 'Test Item 1',
    description: 'Description for test item 1',
    price: 100,
    userId: '1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Test Item 2',
    description: 'Description for test item 2',
    price: 200,
    userId: '2',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: '3',
    name: 'Test Item 3',
    description: 'Description for test item 3',
    price: 300,
    userId: '1',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
]

export const createTestItem = (overrides?: Partial<TestItem>): TestItem => ({
  id: `${Date.now()}`,
  name: `Test Item ${Date.now()}`,
  description: 'Test item description',
  price: 99.99,
  userId: '1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

