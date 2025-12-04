import express from 'express';
import {
    sendConnectionRequest,
    getIncomingRequests,
    respondToRequest,
    getLinkedPatients,
    getLinkedDoctors
} from '../controllers/connectionController.js';
import { getPatientHealthData, getPatientGoals, analyzePatientGoal } from '../controllers/doctorController.js';
import { createNote, getPatientNotes, getMyNotes } from '../controllers/noteController.js';
import { generatePatientSummary } from '../controllers/aiController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Patient routes
router.post('/request', protect, restrictTo('patient'), sendConnectionRequest);
router.get('/doctors', protect, restrictTo('patient'), getLinkedDoctors);
router.get('/my-notes', protect, restrictTo('patient'), getMyNotes);

// Doctor routes
router.get('/requests', protect, restrictTo('doctor'), getIncomingRequests);
router.put('/respond', protect, restrictTo('doctor'), respondToRequest);
router.get('/patients', protect, restrictTo('doctor'), getLinkedPatients);
router.get('/patient/:patientId/data', protect, restrictTo('doctor'), getPatientHealthData);
router.get('/patient/:patientId/goals', protect, restrictTo('doctor'), getPatientGoals);
router.post('/patient/:patientId/goals/:goalId/analyze', protect, restrictTo('doctor'), analyzePatientGoal);
router.post('/notes', protect, restrictTo('doctor'), createNote);
router.get('/patient/:patientId/notes', protect, restrictTo('doctor'), getPatientNotes);
router.post('/patient/:patientId/ai-summary', protect, restrictTo('doctor'), generatePatientSummary);

export default router;
