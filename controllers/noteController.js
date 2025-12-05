import Note from '../models/Note.js';
import Connection from '../models/Connection.js';

// @desc    Create a clinical note for a patient (Doctor to Patient)
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
            description,
            sender: doctorId,
            senderRole: 'doctor',
            isRead: false
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

// @desc    Patient sends a note/reply to doctor
// @route   POST /api/connect/patient-notes
// @access  Private (Patient only)
export const createPatientNote = async (req, res) => {
    try {
        const { doctorId, title, description, parentNoteId } = req.body;
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
                message: 'Not authorized to send notes to this doctor'
            });
        }

        const note = await Note.create({
            doctor: doctorId,
            patient: patientId,
            title,
            description,
            sender: patientId,
            senderRole: 'patient',
            isRead: false,
            parentNote: parentNoteId || null
        });

        if (parentNoteId) {
            await Note.findByIdAndUpdate(parentNoteId, {
                $push: { replies: note._id }
            });
        }

        await note.populate('doctor', 'displayName email photoURL doctorProfile');

        res.status(201).json({
            success: true,
            message: 'Note sent successfully',
            note
        });
    } catch (error) {
        console.error('Create Patient Note Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error sending note'
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

        const notes = await Note.find({
            doctor: doctorId,
            patient: patientId,
            parentNote: null // Only get main notes, not replies
        })
            .populate('sender', 'displayName email photoURL')
            .populate({
                path: 'replies',
                populate: { path: 'sender', select: 'displayName email photoURL' }
            })
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

        const notes = await Note.find({
            patient: patientId,
            parentNote: null // Only get main notes, not replies
        })
            .populate('doctor', 'displayName email photoURL doctorProfile')
            .populate('sender', 'displayName email photoURL')
            .populate({
                path: 'replies',
                populate: { path: 'sender', select: 'displayName email photoURL' }
            })
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

// @desc    Mark note as read
// @route   PUT /api/connect/notes/:noteId/read
// @access  Private
export const markNoteAsRead = async (req, res) => {
    try {
        const { noteId } = req.params;
        const userId = req.user.id;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Verify user is part of this note conversation
        if (note.doctor.toString() !== userId && note.patient.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this note'
            });
        }

        // Only mark as read if the current user is not the sender
        if (note.sender.toString() !== userId && !note.isRead) {
            note.isRead = true;
            note.readAt = new Date();
            await note.save();
        }

        res.status(200).json({
            success: true,
            message: 'Note marked as read',
            note
        });
    } catch (error) {
        console.error('Mark Note Read Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error marking note as read'
        });
    }
};

// @desc    Get unread notes count
// @route   GET /api/connect/notes/unread-count
// @access  Private
export const getUnreadNotesCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        let query = {
            isRead: false,
            sender: { $ne: userId }
        };

        if (userRole === 'patient') {
            query.patient = userId;
        } else {
            query.doctor = userId;
        }

        const count = await Note.countDocuments(query);

        res.status(200).json({
            success: true,
            unreadCount: count
        });
    } catch (error) {
        console.error('Get Unread Count Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching unread count'
        });
    }
};

// @desc    Get all unread notes for doctor (from all patients)
// @route   GET /api/connect/doctor/unread-notes
// @access  Private (Doctor only)
export const getDoctorUnreadNotes = async (req, res) => {
    try {
        const doctorId = req.user.id;

        const notes = await Note.find({
            doctor: doctorId,
            isRead: false,
            sender: { $ne: doctorId },
            senderRole: 'patient'
        })
            .populate('patient', 'displayName email photoURL')
            .populate('sender', 'displayName email photoURL')
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            count: notes.length,
            notes
        });
    } catch (error) {
        console.error('Get Doctor Unread Notes Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching unread notes'
        });
    }
};

// @desc    Get all unread notes for patient (from all doctors)
// @route   GET /api/connect/patient/unread-notes
// @access  Private (Patient only)
export const getPatientUnreadNotes = async (req, res) => {
    try {
        const patientId = req.user.id;

        const notes = await Note.find({
            patient: patientId,
            isRead: false,
            sender: { $ne: patientId },
            senderRole: 'doctor'
        })
            .populate('doctor', 'displayName email photoURL doctorProfile')
            .populate('sender', 'displayName email photoURL')
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            count: notes.length,
            notes
        });
    } catch (error) {
        console.error('Get Patient Unread Notes Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching unread notes'
        });
    }
};

// @desc    Reply to a note
// @route   POST /api/connect/notes/:noteId/reply
// @access  Private
export const replyToNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const { description } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        const parentNote = await Note.findById(noteId);
        if (!parentNote) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Verify user is part of this note conversation
        if (parentNote.doctor.toString() !== userId && parentNote.patient.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to reply to this note'
            });
        }

        const reply = await Note.create({
            doctor: parentNote.doctor,
            patient: parentNote.patient,
            title: `Re: ${parentNote.title}`,
            description,
            sender: userId,
            senderRole: userRole,
            isRead: false,
            parentNote: noteId
        });

        // Add reply to parent note
        parentNote.replies.push(reply._id);
        await parentNote.save();

        await reply.populate('sender', 'displayName email photoURL');

        res.status(201).json({
            success: true,
            message: 'Reply sent successfully',
            reply
        });
    } catch (error) {
        console.error('Reply to Note Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error sending reply'
        });
    }
};
