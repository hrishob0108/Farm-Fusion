import express from 'express';
import { getEventDetails, getEventQr } from '../controllers/eventController.js';

const router = express.Router();

router.get('/', getEventDetails);
router.get('/qr', getEventQr);
router.get('/qr/image', getEventQr);

export default router;
