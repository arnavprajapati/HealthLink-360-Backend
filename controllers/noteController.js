import Note from '../models/Note.js';
import Connection from '../models/Connection.js';

// @desc    Create a clinical note for a patient
// @route   POST /api/connect/notes
// @access  Private (Doctor only)
export const createNote = async (req, res) => {
    try {
        const { patientId, title, description } = req.body;
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
                message: 'Not authorized to add notes for this patient'
            });
        }

        const note = await Note.create({
            doctor: doctorId,
            patient: patientId,
            title,
            description
        });

        res.status(201).json({
            success: true,
            message: 'Note added successfully',
            note
        });
    } catch (error) {
        console.error('Create Note Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating note'
        });
    }
};

// @desc    Get notes for a specific patient (Doctor view)
// @route   GET /api/connect/patient/:patientId/notes
// @access  Private (Doctor only)
export const getPatientNotes = async (req, res) => {
    try {
        const { patientId } = req.params;
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
                message: 'Not authorized to view notes for this patient'
            });
        }

        const notes = await Note.find({ doctor: doctorId, patient: patientId })
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: notes.length,
            notes
        });
    } catch (error) {
        console.error('Get Patient Notes Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching notes'
        });
    }
};

// @desc    Get my notes (Patient view)
// @route   GET /api/connect/my-notes
// @access  Private (Patient only)
export const getMyNotes = async (req, res) => {
    try {
        const patientId = req.user.id;

        const notes = await Note.find({ patient: patientId })
            .populate('doctor', 'displayName email photoURL doctorProfile')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: notes.length,
            notes
        });
    } catch (error) {
        console.error('Get My Notes Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching notes'
        });
    }
};
