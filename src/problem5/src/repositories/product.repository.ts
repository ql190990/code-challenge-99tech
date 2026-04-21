import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import type {
  CreateProductInput,
  Product,
  UpdateProductInput,
} from '../types/product.types';

/**
 * Filters accepted by {@link productRepository.findMany}.
 *
 * `page` and `limit` are required here because the service layer always
 * resolves defaults before delegating to the repository — the repository
 * therefore never has to invent numbers.
 */
export interface FindManyProductsFilter {
  name?: string;
  category?: string;
  page: number;
  limit: number;
}

/**
 * Paginated result of {@link productRepository.findMany}.
 */
export interface FindManyProductsResult {
  items: Product[];
  total: number;
}

/**
 * Build a case-insensitive `contains` predicate for the product-name filter.
 * `mode: 'insensitive'` compiles to `ILIKE` on PostgreSQL, so the user can
 * search `ergo` and match stored values like `Ergo Keyboard`.
 */
function nameFilter(term: string | undefined): Prisma.StringFilter | undefined {
  if (!term) {
    return undefined;
  }
  return { contains: term, mode: 'insensitive' };
}

/**
 * The repository layer is the ONLY layer that talks to Prisma.
 *
 * Keeping all DB access here means the service layer can be tested with a
 * stubbed repository and the controller layer never needs to know which
 * ORM (if any) is in play. Update and delete translate Prisma's
 * `P2025 Record to update/delete not found` into a `null` return so the
 * service layer can map it to a clean 404 without coupling to Prisma error
 * codes outside this file.
 */
export const productRepository = {
  async create(data: CreateProductInput): Promise<Product> {
    return prisma.product.create({ data });
  },

  async findMany(filter: FindManyProductsFilter): Promise<FindManyProductsResult> {
    const where: Prisma.ProductWhereInput = {};

    const namePredicate = nameFilter(filter.name);
    if (namePredicate) {
      where.name = namePredicate;
    }
    if (filter.category) {
      where.category = filter.category;
    }

    const skip = (filter.page - 1) * filter.limit;
    const take = filter.limit;

    // Running the two queries concurrently keeps list latency roughly
    // equal to the slower of the two rather than their sum.
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  },

  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({ where: { id } });
  },

  /**
   * Update a product by id. Returns `null` when the record does not exist so
   * the service can map it to an {@link AppError.notFound} without this
   * module leaking Prisma error shapes. Any other failure is rethrown.
   */
  async update(id: string, data: UpdateProductInput): Promise<Product | null> {
    try {
      return await prisma.product.update({ where: { id }, data });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Delete a product by id. Returns `true` when a row was deleted, `false`
   * when the record did not exist. See {@link update} for rationale.
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.product.delete({ where: { id } });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return false;
      }
      throw err;
    }
  },
};

export type ProductRepository = typeof productRepository;
