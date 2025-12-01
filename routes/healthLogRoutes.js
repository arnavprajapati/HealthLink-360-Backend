import express from 'express';
import {
    createHealthLog,
    getHealthLogs,
    getHealthLogById,
    getTestDetails,
    getHealthStats,
    deleteHealthLog
} from '../controllers/healthLogController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import upload from '../config/multerConfig.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('patient'));

router.post('/', upload.single('file'), createHealthLog);
router.get('/', getHealthLogs);
router.get('/stats', getHealthStats);
router.get('/:id', getHealthLogById);

router.get('/:logId/test/:testName', getTestDetails);

router.delete('/:id', deleteHealthLog);

export default router;