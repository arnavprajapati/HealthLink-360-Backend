import express from 'express';
import {
    sendConnectionRequest,
    getIncomingRequests,
    respondToRequest,
    getLinkedPatients,
    getLinkedDoctors
} from '../controllers/connectionController.js';
import { getPatientHealthData, getPatientGoals, analyzePatientGoal } from '../controllers/doctorController.js';
import { createNote, getPatientNotes, getMyNotes, createPatientNote, markNoteAsRead, getUnreadNotesCount, replyToNote, getDoctorUnreadNotes, getPatientUnreadNotes } from '../controllers/noteController.js';
import { generatePatientSummary } from '../controllers/aiController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Patient routes
router.post('/request', protect, restrictTo('patient'), sendConnectionRequest);
router.get('/doctors', protect, restrictTo('patient'), getLinkedDoctors);
router.get('/my-notes', protect, restrictTo('patient'), getMyNotes);
router.post('/patient-notes', protect, restrictTo('patient'), createPatientNote);
router.get('/patient/unread-notes', protect, restrictTo('patient'), getPatientUnreadNotes);

// Doctor routes
router.get('/requests', protect, restrictTo('doctor'), getIncomingRequests);
router.put('/respond', protect, restrictTo('doctor'), respondToRequest);
router.get('/patients', protect, restrictTo('doctor'), getLinkedPatients);
router.get('/patient/:patientId/data', protect, restrictTo('doctor'), getPatientHealthData);
router.get('/patient/:patientId/goals', protect, restrictTo('doctor'), getPatientGoals);
router.post('/patient/:patientId/goals/:goalId/analyze', protect, restrictTo('doctor'), analyzePatientGoal);
router.post('/notes', protect, restrictTo('doctor'), createNote);
router.get('/patient/:patientId/notes', protect, restrictTo('doctor'), getPatientNotes);
router.get('/doctor/unread-notes', protect, restrictTo('doctor'), getDoctorUnreadNotes);
router.post('/patient/:patientId/ai-summary', protect, restrictTo('doctor'), generatePatientSummary);

// Shared note routes (both doctor and patient)
router.get('/notes/unread-count', protect, getUnreadNotesCount);
router.put('/notes/:noteId/read', protect, markNoteAsRead);
router.post('/notes/:noteId/reply', protect, replyToNote);

export default router;
