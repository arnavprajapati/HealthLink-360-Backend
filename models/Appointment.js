import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: [true, 'Date is required']
    },
    time: {
        type: String,
        required: [true, 'Time is required']
    },
    type: {
        type: String,
        enum: ['Consultation', 'Follow-up', 'Check-up', 'Emergency'],
        default: 'Consultation'
    },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'pending', 'approved', 'rejected'],
        default: 'scheduled'
    },
    notes: {
        type: String
    },
    requestedBy: {
        type: String,
        enum: ['doctor', 'patient'],
        default: 'doctor'
    },
    requestMessage: {
        type: String
    },
    responseMessage: {
        type: String
    }
}, {
    timestamps: true
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
