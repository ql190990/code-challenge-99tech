import { z } from 'zod';

/**
 * Product-related Zod schemas and their derived TypeScript types.
 *
 * The schema names exported from this file are part of the contract between
 * the routing layer and this typed business-logic layer. Renaming any of the
 * four *schema exports is a breaking change.
 */

/**
 * Trim input strings before any length validation runs. Many clients send
 * strings padded with whitespace and we want validation errors to reflect
 * the logical value, not accidental padding.
 */
const trimmedString = (): z.ZodString => z.string().trim();

/**
 * Payload accepted by `POST /products`.
 *
 * `price` is modelled as a finite positive number. We explicitly refuse
 * non-finite values (Infinity, NaN) so bad JSON never reaches the DB.
 */
export const createProductSchema = z
  .object({
    name: trimmedString()
      .min(1, 'name must not be empty')
      .max(255, 'name must be at most 255 characters'),
    description: trimmedString()
      .max(1000, 'description must be at most 1000 characters')
      .optional(),
    price: z
      .number({ invalid_type_error: 'price must be a number' })
      .finite('price must be a finite number')
      .positive('price must be positive'),
    category: trimmedString()
      .min(1, 'category must not be empty')
      .max(100, 'category must be at most 100 characters'),
  })
  .strict();

/**
 * Payload accepted by `PATCH /products/:id`.
 *
 * All fields are optional individually but at least one must be supplied —
 * empty request bodies are rejected early to avoid round-tripping
 * meaningless updates to the database.
 */
export const updateProductSchema = createProductSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field must be provided',
  });

/**
 * URL params for routes that target a single product.
 *
 * Prisma generates IDs with `cuid()` so we validate accordingly — this
 * rejects malformed IDs before hitting the database and produces a clean
 * 400 instead of a 500 from Prisma.
 */
export const productIdParamSchema = z
  .object({
    id: z.string().cuid({ message: 'id must be a valid cuid' }),
  })
  .strict();

/**
 * Query parameters for `GET /products`.
 *
 * `page` and `limit` arrive as strings on the URL, so we coerce them to
 * positive integers with sensible defaults and a hard upper bound on
 * `limit` to prevent denial-of-service-style unbounded queries.
 */
export const listProductQuerySchema = z
  .object({
    name: trimmedString().min(1).max(255).optional(),
    category: trimmedString().min(1).max(100).optional(),
    page: z.coerce
      .number({ invalid_type_error: 'page must be a number' })
      .int('page must be an integer')
      .positive('page must be positive')
      .default(1),
    limit: z.coerce
      .number({ invalid_type_error: 'limit must be a number' })
      .int('limit must be an integer')
      .positive('limit must be positive')
      .max(100, 'limit must be at most 100')
      .default(10),
  })
  .strict();

/**
 * Types inferred from the schemas above — these are the only types
 * consumers should use when talking about request-time data.
 */
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductIdParam = z.infer<typeof productIdParamSchema>;
export type ListProductQuery = z.infer<typeof listProductQuerySchema>;

/**
 * Internal representation of a product as returned from Prisma.
 *
 * We avoid importing `@prisma/client`'s generated `Product` type here so
 * that unit tests and other callers can work with a plain interface that
 * does not depend on `prisma generate` having been run.
 */
export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Publicly-facing product shape. Dates are normalised to ISO strings so
 * that JSON responses round-trip cleanly regardless of caller runtime.
 */
export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert a Prisma product record into the DTO clients will receive.
 *
 * This is the single place where the Date → ISO-string conversion happens,
 * which keeps serialisation behaviour consistent across every endpoint.
 */
export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    category: product.category,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
