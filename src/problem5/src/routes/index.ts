import { Router } from 'express';
import productRoutes from './product.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok' },
  });
});

router.use('/products', productRoutes);

export default router;
