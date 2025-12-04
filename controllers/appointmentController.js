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
            notes
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
