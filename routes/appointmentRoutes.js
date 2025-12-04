import express from 'express';
import {
    createAppointment,
    getDoctorAppointments,
    getPatientAppointments,
    updateAppointmentStatus
} from '../controllers/appointmentController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, restrictTo('doctor'), createAppointment);
router.get('/doctor', protect, restrictTo('doctor'), getDoctorAppointments);
router.get('/patient', protect, restrictTo('patient'), getPatientAppointments);
router.put('/:id/status', protect, restrictTo('doctor'), updateAppointmentStatus);

export default router;
