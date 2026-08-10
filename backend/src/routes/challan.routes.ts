import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  listChallans,
  getChallan,
  createChallan,
  updateChallanStatus,
} from '../controllers/challan.controller';

const router = Router();

router.use(authenticate);

router.get('/', listChallans);
router.get('/:id', getChallan);
router.post('/', authorize('ADMIN', 'SALES'), createChallan);
router.patch('/:id/status', authorize('ADMIN', 'SALES', 'WAREHOUSE'), updateChallanStatus);

export default router;
