/**
 * Items Module
 * Public API exports
 */

export { ItemService } from './item.service'
export { ItemRepository, type IItemRepository } from './item.repository'
export { default as itemController } from './item.controller'
export type { ItemResponseDto, ItemsPaginationResponse, GetItemsQueryDto, CreateItemDto, UpdateItemDto } from './item.dto'
export type { Item, GetItemsResponse } from './item.schemas'

