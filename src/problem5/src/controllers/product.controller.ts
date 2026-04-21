import type { RequestHandler, Response } from 'express';
import { productService } from '../services/product.service';
import type {
  ApiSuccess,
  PaginationMeta,
} from '../types/api.types';
import type {
  CreateProductInput,
  ListProductQuery,
  ProductDto,
  ProductIdParam,
  UpdateProductInput,
} from '../types/product.types';

/**
 * Validated-payload bag placed on `res.locals` by the `validate` middleware.
 *
 * The middleware stashes the parsed object on `res.locals.validated[source]`
 * — this is safer than mutating `req.query`/`req.params` which are
 * read-only getters under Express 5.
 */
interface ValidatedLocals {
  validated?: {
    body?: unknown;
    query?: unknown;
    params?: unknown;
  };
}

/**
 * Retrieve a validated payload slot. Throws loudly if the `validate`
 * middleware has not run for this source: a controller invoked without
 * validation wiring is a programmer error, and silently falling back to the
 * raw request value would accept untyped input from any future route that
 * forgot its `validate(...)` wiring. Failing here turns that bug into a
 * loud 500 during development rather than a quiet production bypass.
 */
function readValidated<T>(
  res: Response,
  source: 'body' | 'query' | 'params',
): T {
  const locals = res.locals as ValidatedLocals;
  const parsed = locals.validated?.[source];
  if (parsed === undefined) {
    throw new Error(
      `[controller] validate('${source}') middleware not wired on this route`,
    );
  }
  return parsed as T;
}

/**
 * Helper that wraps a success payload in the shared envelope.
 */
function ok<T>(data: T, meta?: PaginationMeta): ApiSuccess<T> {
  const envelope: ApiSuccess<T> = { success: true, data };
  if (meta) {
    envelope.meta = meta;
  }
  return envelope;
}

const create: RequestHandler<
  Record<string, string>,
  ApiSuccess<ProductDto>,
  CreateProductInput
> = async (_req, res, next) => {
  try {
    const input = readValidated<CreateProductInput>(res, 'body');
    const product = await productService.create(input);
    res.status(201).json(ok(product));
  } catch (err) {
    next(err);
  }
};

const list: RequestHandler<
  Record<string, string>,
  ApiSuccess<ProductDto[]>
> = async (_req, res, next) => {
  try {
    const query = readValidated<ListProductQuery>(res, 'query');
    const result = await productService.list(query);
    res.status(200).json(
      ok(result.items, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      }),
    );
  } catch (err) {
    next(err);
  }
};

const getById: RequestHandler<
  ProductIdParam,
  ApiSuccess<ProductDto>
> = async (_req, res, next) => {
  try {
    const { id } = readValidated<ProductIdParam>(res, 'params');
    const product = await productService.getById(id);
    res.status(200).json(ok(product));
  } catch (err) {
    next(err);
  }
};

const update: RequestHandler<
  ProductIdParam,
  ApiSuccess<ProductDto>,
  UpdateProductInput
> = async (_req, res, next) => {
  try {
    const { id } = readValidated<ProductIdParam>(res, 'params');
    const input = readValidated<UpdateProductInput>(res, 'body');
    const product = await productService.update(id, input);
    res.status(200).json(ok(product));
  } catch (err) {
    next(err);
  }
};

const remove: RequestHandler<ProductIdParam> = async (_req, res, next) => {
  try {
    const { id } = readValidated<ProductIdParam>(res, 'params');
    await productService.delete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * Controller export shape — routes import and wire these directly. The
 * method names here are part of the locked contract with the routing
 * layer; do not rename without coordinating.
 */
export const productController = {
  create,
  list,
  getById,
  update,
  delete: remove,
};

export type ProductController = typeof productController;
