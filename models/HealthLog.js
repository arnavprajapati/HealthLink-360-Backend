import mongoose from 'mongoose';

const healthLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    diseaseType: {
        type: String,
        enum: ['diabetes', 'hypertension', 'thyroid', 'kidney', 'heart', 'liver', 'cholesterol', 'general', 'other'],
        default: 'general'
    },
    detectedDisease: {
        type: String,
        default: null
    },
    readings: [{
        testName: String,
        value: mongoose.Schema.Types.Mixed,
        unit: String,
        normalRange: {
            min: Number,
            max: Number,
            text: String 
        },
        status: {
            type: String,
            enum: ['normal', 'low', 'high', 'borderline', 'critical'],
            default: 'normal'
        },
        category: String, 
        healthInfo: {
            description: String,
            causes: [String],
            recommendations: [String],
            symptoms: [String],
            relatedTests: [String]
        }
    }],
    aiAnalysis: {
        summary: String,
        detectedConditions: [String],
        riskLevel: {
            type: String,
            enum: ['low', 'moderate', 'high', 'critical'],
            default: 'low'
        },
        recommendations: [String],
        keyFindings: [String],
        abnormalTests: [String]
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        enum: ['image', 'pdf'],
        required: true
    },
    rawAiData: {
        type: Object,
        default: null
    },
    testDate: {
        type: Date,
        default: null
    },
    recordDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

healthLogSchema.index({ userId: 1, recordDate: -1 });
healthLogSchema.index({ userId: 1, diseaseType: 1 });

const HealthLog = mongoose.model('HealthLog', healthLogSchema);
export default HealthLog;