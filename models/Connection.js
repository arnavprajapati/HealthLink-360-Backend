import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    responseDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Ensure unique connection request between same doctor and patient
connectionSchema.index({ doctor: 1, patient: 1 }, { unique: true });

const Connection = mongoose.model('Connection', connectionSchema);

export default Connection;
