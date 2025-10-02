import { Logger } from '@/utils/logger'

export interface DataItem {
  id: string
  name: string
  value: number
  timestamp: Date
}

export class DataService {
  private logger: Logger
  private cache: Map<string, DataItem>

  constructor() {
    this.logger = new Logger('DataService')
    this.cache = new Map()
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing data service...')
    // Add any initialization logic here
    // For example: connect to database, load initial data, etc.
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down data service...')
    this.cache.clear()
    // Add any cleanup logic here
  }

  async fetchData(): Promise<DataItem[]> {
    // Example data fetching logic
    const mockData: DataItem[] = [
      {
        id: '1',
        name: 'Item 1',
        value: Math.random() * 100,
        timestamp: new Date(),
      },
      {
        id: '2',
        name: 'Item 2',
        value: Math.random() * 100,
        timestamp: new Date(),
      },
    ]

    // Update cache
    mockData.forEach(item => {
      this.cache.set(item.id, item)
    })

    this.logger.debug(`Fetched ${mockData.length} items`)
    return mockData
  }

  async getById(id: string): Promise<DataItem | undefined> {
    const item = this.cache.get(id)
    if (!item) {
      this.logger.warn(`Item with id ${id} not found`)
    }
    return item
  }

  async save(item: DataItem): Promise<void> {
    this.cache.set(item.id, item)
    this.logger.info(`Saved item with id ${item.id}`)
    // In a real service, you would persist this to a database
  }

  async delete(id: string): Promise<boolean> {
    const result = this.cache.delete(id)
    if (result) {
      this.logger.info(`Deleted item with id ${id}`)
    } else {
      this.logger.warn(`Failed to delete item with id ${id}`)
    }
    return result
  }

  async getAll(): Promise<DataItem[]> {
    return Array.from(this.cache.values())
  }
}
