import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  addStockMovement,
} from '../controllers/product.controller';

const router = Router();

router.use(authenticate);

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', authorize('ADMIN', 'WAREHOUSE'), createProduct);
router.put('/:id', authorize('ADMIN', 'WAREHOUSE'), updateProduct);
router.post('/:id/movements', authorize('ADMIN', 'WAREHOUSE'), addStockMovement);

export default router;
