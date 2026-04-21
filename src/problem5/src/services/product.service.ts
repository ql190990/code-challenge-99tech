import { AppError } from '../utils/app-error';
import { productRepository } from '../repositories/product.repository';
import {
  toProductDto,
  type CreateProductInput,
  type ListProductQuery,
  type ProductDto,
  type UpdateProductInput,
} from '../types/product.types';

/**
 * Paginated result returned by {@link productService.list}.
 */
export interface ListProductsResult {
  items: ProductDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Business-logic layer for products.
 *
 * Responsibilities:
 * - Translate validated input into repository calls.
 * - Enforce resource-existence invariants (404 on missing records).
 * - Convert Prisma models into serialisable DTOs before returning.
 */
export const productService = {
  async create(input: CreateProductInput): Promise<ProductDto> {
    const created = await productRepository.create(input);
    return toProductDto(created);
  },

  async list(query: ListProductQuery): Promise<ListProductsResult> {
    const { items, total } = await productRepository.findMany({
      name: query.name,
      category: query.category,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: items.map(toProductDto),
      total,
      page: query.page,
      limit: query.limit,
    };
  },

  async getById(id: string): Promise<ProductDto> {
    const product = await productRepository.findById(id);
    if (!product) {
      throw AppError.notFound('Product');
    }
    return toProductDto(product);
  },

  async update(id: string, input: UpdateProductInput): Promise<ProductDto> {
    // Delegate existence + update to a single DB roundtrip. The repository
    // returns `null` iff the row was already gone, which we map to 404.
    // This pattern is race-free: concurrent deletes can no longer induce a
    // 500 from an unhandled `P2025` after the check-but-before-the-write
    // window that an explicit `findById` would open.
    const updated = await productRepository.update(id, input);
    if (!updated) {
      throw AppError.notFound('Product');
    }
    return toProductDto(updated);
  },

  async delete(id: string): Promise<void> {
    const deleted = await productRepository.delete(id);
    if (!deleted) {
      throw AppError.notFound('Product');
    }
  },
};

export type ProductService = typeof productService;
