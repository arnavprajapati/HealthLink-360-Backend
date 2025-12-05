import express from 'express';
import {
    createAppointment,
    getDoctorAppointments,
    getPatientAppointments,
    updateAppointmentStatus,
    requestAppointment,
    respondToAppointmentRequest,
    getAppointmentRequests
} from '../controllers/appointmentController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Doctor routes
router.post('/', protect, restrictTo('doctor'), createAppointment);
router.get('/doctor', protect, restrictTo('doctor'), getDoctorAppointments);
router.get('/requests', protect, restrictTo('doctor'), getAppointmentRequests);
router.put('/:id/status', protect, restrictTo('doctor'), updateAppointmentStatus);
router.put('/:id/respond', protect, restrictTo('doctor'), respondToAppointmentRequest);

// Patient routes
router.get('/patient', protect, restrictTo('patient'), getPatientAppointments);
router.post('/request', protect, restrictTo('patient'), requestAppointment);

export default router;
