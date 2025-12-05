import Appointment from '../models/Appointment.js';
import Connection from '../models/Connection.js';

// @desc    Schedule an appointment (Doctor only)
// @route   POST /api/appointments
// @access  Private (Doctor only)
export const createAppointment = async (req, res) => {
    try {
        const { patientId, date, time, type, notes } = req.body;
        const doctorId = req.user.id;

        // Verify connection
        const connection = await Connection.findOne({
            doctor: doctorId,
            patient: patientId,
            status: 'accepted'
        });

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to schedule appointments for this patient'
            });
        }

        const appointment = await Appointment.create({
            doctor: doctorId,
            patient: patientId,
            date,
            time,
            type,
            notes,
            requestedBy: 'doctor',
            status: 'scheduled'
        });

        res.status(201).json({
            success: true,
            message: 'Appointment scheduled successfully',
            appointment
        });
    } catch (error) {
        console.error('Create Appointment Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error scheduling appointment'
        });
    }
};

// @desc    Patient requests an appointment
// @route   POST /api/appointments/request
// @access  Private (Patient only)
export const requestAppointment = async (req, res) => {
    try {
        const { doctorId, date, time, type, requestMessage } = req.body;
        const patientId = req.user.id;

        // Verify connection
        const connection = await Connection.findOne({
            doctor: doctorId,
            patient: patientId,
            status: 'accepted'
        });

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: 'You are not connected with this doctor'
            });
        }

        const appointment = await Appointment.create({
            doctor: doctorId,
            patient: patientId,
            date,
            time,
            type,
            requestedBy: 'patient',
            requestMessage,
            status: 'pending'
        });

        await appointment.populate('doctor', 'displayName email photoURL doctorProfile');

        res.status(201).json({
            success: true,
            message: 'Appointment request sent successfully',
            appointment
        });
    } catch (error) {
        console.error('Request Appointment Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error requesting appointment'
        });
    }
};

// @desc    Doctor responds to appointment request
// @route   PUT /api/appointments/:id/respond
// @access  Private (Doctor only)
export const respondToAppointmentRequest = async (req, res) => {
    try {
        const { status, responseMessage, time } = req.body;
        const appointmentId = req.params.id;
        const doctorId = req.user.id;

        const appointment = await Appointment.findOne({
            _id: appointmentId,
            doctor: doctorId,
            status: 'pending'
        });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment request not found or already processed'
            });
        }

        appointment.status = status === 'approved' ? 'scheduled' : 'rejected';
        appointment.responseMessage = responseMessage;
        if (time) {
            appointment.time = time;
        }
        await appointment.save();

        await appointment.populate('patient', 'displayName email photoURL');

        res.status(200).json({
            success: true,
            message: `Appointment ${status === 'approved' ? 'approved' : 'rejected'}`,
            appointment
        });
    } catch (error) {
        console.error('Respond to Appointment Request Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error responding to appointment request'
        });
    }
};

// @desc    Get doctor's appointments
// @route   GET /api/appointments/doctor
// @access  Private (Doctor only)
export const getDoctorAppointments = async (req, res) => {
    try {
        const doctorId = req.user.id;

        const appointments = await Appointment.find({ doctor: doctorId })
            .populate('patient', 'displayName email photoURL')
            .sort({ date: 1, time: 1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Get Doctor Appointments Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching appointments'
        });
    }
};

// @desc    Get pending appointment requests for doctor
// @route   GET /api/appointments/requests
// @access  Private (Doctor only)
export const getAppointmentRequests = async (req, res) => {
    try {
        const doctorId = req.user.id;

        const requests = await Appointment.find({
            doctor: doctorId,
            status: 'pending',
            requestedBy: 'patient'
        })
            .populate('patient', 'displayName email photoURL')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: requests.length,
            requests
        });
    } catch (error) {
        console.error('Get Appointment Requests Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching appointment requests'
        });
    }
};

// @desc    Get patient's appointments
// @route   GET /api/appointments/patient
// @access  Private (Patient only)
export const getPatientAppointments = async (req, res) => {
    try {
        const patientId = req.user.id;

        const appointments = await Appointment.find({ patient: patientId })
            .populate('doctor', 'displayName email photoURL doctorProfile')
            .sort({ date: 1, time: 1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Get Patient Appointments Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching appointments'
        });
    }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private (Doctor only)
export const updateAppointmentStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const appointmentId = req.params.id;
        const doctorId = req.user.id;

        const appointment = await Appointment.findOne({ _id: appointmentId, doctor: doctorId });

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found or unauthorized'
            });
        }

        appointment.status = status;
        await appointment.save();

        res.status(200).json({
            success: true,
            message: 'Appointment status updated',
            appointment
        });
    } catch (error) {
        console.error('Update Appointment Status Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating appointment'
        });
    }
};
