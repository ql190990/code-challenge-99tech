import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  createProductSchema,
  listProductQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from '../types/product.types';

const router = Router();

router.post(
  '/',
  validate(createProductSchema, 'body'),
  productController.create,
);

router.get(
  '/',
  validate(listProductQuerySchema, 'query'),
  productController.list,
);

router.get(
  '/:id',
  validate(productIdParamSchema, 'params'),
  productController.getById,
);

// PATCH is the correct verb for partial update per RFC 7231 §4.3.4 — PUT
// would require a full replacement body. The update schema is `.partial()`
// so the endpoint is semantically a merge, which is exactly what PATCH
// describes.
router.patch(
  '/:id',
  validate(productIdParamSchema, 'params'),
  validate(updateProductSchema, 'body'),
  productController.update,
);

router.delete(
  '/:id',
  validate(productIdParamSchema, 'params'),
  productController.delete,
);

export default router;
