import express from 'express';
import { createReservation, getReservationStatus, releaseReservation } from '../controllers/reservationController.js';

const router = express.Router();

router.post('/reserve', createReservation);
router.get('/status/:reservationId', getReservationStatus);
router.post('/release', releaseReservation);

export default router;
