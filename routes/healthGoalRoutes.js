import express from 'express';
import {
    createHealthGoal,
    getHealthGoals,
    getHealthGoalById,
    updateGoalProgress,
    updateAllGoalsProgress,
    editHealthGoal,
    deleteHealthGoal,
    getGoalStats,
    addMilestone,
    editMilestone,
    deleteMilestone,
    analyzeGoalWithAI
} from '../controllers/healthGoalController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('patient'));

router.post('/', createHealthGoal);
router.get('/', getHealthGoals);
router.get('/stats', getGoalStats);
router.get('/:id', getHealthGoalById);
router.put('/:id', editHealthGoal);
router.delete('/:id', deleteHealthGoal);

router.put('/:id/progress', updateGoalProgress);
router.post('/update-all', updateAllGoalsProgress);

router.post('/:id/milestone', addMilestone);
router.put('/:id/milestone/:milestoneIndex', editMilestone);
router.delete('/:id/milestone/:milestoneIndex', deleteMilestone);
router.post('/:id/analyze', analyzeGoalWithAI);

export default router;