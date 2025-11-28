import mongoose from 'mongoose';

const healthLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    diseaseType: {
        type: String,
        enum: ['diabetes', 'hypertension', 'thyroid', 'kidney', 'heart', 'liver', 'cholesterol', 'other'],
        required: true
    },
    detectedDisease: {
        type: String, 
        default: null
    },
    readings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed, 
        default: {}
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    fileUrl: {
        type: String,
        default: null
    },
    fileName: {
        type: String,
        default: null
    },
    fileType: {
        type: String,
        enum: ['image', 'pdf'],
        default: null
    },
    aiExtractedData: {
        type: Object,
        default: null
    },
    recordDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const HealthLog = mongoose.model('HealthLog', healthLogSchema);
export default HealthLog;