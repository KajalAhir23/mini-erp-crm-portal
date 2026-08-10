import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  addFollowUp,
} from '../controllers/customer.controller';

const router = Router();

router.use(authenticate);

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.post('/', authorize('ADMIN', 'SALES'), createCustomer);
router.put('/:id', authorize('ADMIN', 'SALES'), updateCustomer);
router.post('/:id/follow-ups', authorize('ADMIN', 'SALES'), addFollowUp);

export default router;
