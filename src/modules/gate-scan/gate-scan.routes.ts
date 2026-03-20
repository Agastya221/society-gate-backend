import { Router } from 'express';
import { scanQR } from './gate-scan.controller';

const router = Router();

router.post('/', scanQR);

export default router;
