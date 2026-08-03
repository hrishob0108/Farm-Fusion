import express from 'express';
import { getEventDetails } from '../controllers/eventController.js';

const router = express.Router();

router.get('/', getEventDetails);

export default router;
