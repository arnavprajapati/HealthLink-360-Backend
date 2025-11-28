import express from 'express';
import { signup, login, logout, getCurrentUser, googleLogin } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/google-login', googleLogin);

router.post('/logout', logout);
router.get('/me', protect, getCurrentUser);

export default router;