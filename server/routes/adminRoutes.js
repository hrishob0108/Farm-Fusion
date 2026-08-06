import express from 'express';
import { adminLogin, getDashboardStats } from '../controllers/adminController.js';
import { getRegistrations, updatePaymentStatus, deleteRegistration, resendVerificationEmail } from '../controllers/registrationController.js';
import { updateEventDetails } from '../controllers/eventController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public Admin Auth
router.post('/login', adminLogin);

// Protected Admin Operations
router.get('/dashboard', protectAdmin, getDashboardStats);
router.get('/registrations', protectAdmin, getRegistrations);
router.put('/event', protectAdmin, upload.single('qrImage'), updateEventDetails);
router.put('/payment-status', protectAdmin, updatePaymentStatus);
router.post('/resend-email', protectAdmin, resendVerificationEmail);
router.delete('/registration/:id', protectAdmin, deleteRegistration);

export default router;
