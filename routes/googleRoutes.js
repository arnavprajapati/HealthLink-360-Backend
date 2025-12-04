import express from 'express';
import {
    getGoogleAuthUrl,
    googleCallback,
    checkConnection,
    createEvent,
    deleteEvent,
    getSyncedEvents,
    disconnectGoogle
} from '../controllers/googleController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public callback route (no auth needed - user comes from Google redirect)
router.get('/callback', googleCallback);

router.use(protect);
router.use(restrictTo('patient'));

router.get('/url', getGoogleAuthUrl);
router.get('/status', checkConnection);
router.get('/events', getSyncedEvents);
router.post('/create-event', createEvent);
router.post('/delete-event', deleteEvent);
router.post('/disconnect', disconnectGoogle);

export default router;
