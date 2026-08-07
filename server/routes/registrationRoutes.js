import express from 'express';
import { createRegistration, checkDuplicate } from '../controllers/registrationController.js';
import { createReservation, getReservationStatus, releaseReservation } from '../controllers/reservationController.js';
import { getEventQr } from '../controllers/eventController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/register', upload.single('paymentScreenshot'), createRegistration);
router.post('/check-duplicate', checkDuplicate);

// Slot Reservation Routes
router.post('/reservations/reserve', createReservation);
router.post('/reserve', createReservation);
router.get('/reservations/status/:reservationId', getReservationStatus);
router.get('/reserve/status/:reservationId', getReservationStatus);
router.post('/reservations/release', releaseReservation);
router.post('/release-reservation', releaseReservation);

// Payment QR Routes
router.get('/qr', getEventQr);
router.get('/qr/image', getEventQr);

export default router;
