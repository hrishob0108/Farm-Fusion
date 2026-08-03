import express from 'express';
import { createRegistration, checkDuplicate } from '../controllers/registrationController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/register', upload.single('paymentScreenshot'), createRegistration);
router.post('/check-duplicate', checkDuplicate);

export default router;
