import express from 'express';
import {
    signup,
    login,
    logout,
    getCurrentUser,
    googleLogin,
    updateUserProfile,
    requestPasswordReset,
    resetPassword,
    resetPasswordDirect,
    verifyEmail,
    verifyEmailWithCode
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/verify-email', verifyEmail);
router.post('/verify-email-code', verifyEmailWithCode);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/reset-password-direct', resetPasswordDirect);
router.post('/logout', logout);
router.get('/me', protect, getCurrentUser);
router.put('/profile', protect, updateUserProfile);

export default router;