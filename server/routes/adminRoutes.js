import express from 'express';
import { adminLogin, getDashboardStats } from '../controllers/adminController.js';
import { getRegistrations, updatePaymentStatus, deleteRegistration, resendVerificationEmail, bulkPushRegistrations, updateRegistration } from '../controllers/registrationController.js';
import { updateEventDetails } from '../controllers/eventController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

import { getAdminReservations } from '../controllers/reservationController.js';

const router = express.Router();

// Public Admin Auth
router.post('/login', adminLogin);

// Protected Admin Operations
router.get('/dashboard', protectAdmin, getDashboardStats);
router.get('/registrations', protectAdmin, getRegistrations);
router.get('/reservations', protectAdmin, getAdminReservations);
router.put('/event', protectAdmin, upload.single('qrImage'), updateEventDetails);
router.put('/payment-status', protectAdmin, updatePaymentStatus);
router.post('/resend-email', protectAdmin, resendVerificationEmail);
router.post('/bulk-push', protectAdmin, bulkPushRegistrations);
router.put('/registration/:id', protectAdmin, upload.single('paymentScreenshotFile'), updateRegistration);
router.delete('/registration/:id', protectAdmin, deleteRegistration);

export default router;


