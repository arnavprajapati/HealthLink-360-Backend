import mongoose from 'mongoose';

const healthGoalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parameter: {
        type: String,
        required: true
    },
    parameterKey: {
        type: String,
        default: null
    },
    customParameterName: {
        type: String,
        default: null
    },
    initialValue: {
        type: Number,
        default: null
    },
    targetValue: {
        type: Number,
        default: null
    },
    minValue: {
        type: Number,
        default: null
    },
    maxValue: {
        type: Number,
        default: null
    },
    currentValue: {
        type: Number,
        default: null
    },
    unit: {
        type: String,
        required: true
    },
    goalType: {
        type: String,
        enum: ['decrease', 'increase', 'maintain', 'range'],
        required: true
    },
    trackingFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'daily'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    deadline: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['in-progress', 'achieved', 'failed', 'expired'],
        default: 'in-progress'
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    milestones: [{
        date: Date,
        value: Number,
        note: String
    }],
    notes: {
        type: String,
        maxlength: 500
    },
    googleEventId: {
        type: String,
        default: null
    },
    syncToGoogleCalendar: {
        type: Boolean,
        default: false
    },
    sharing: {
        visibility: {
            type: String,
            enum: ['private', 'all_doctors', 'specific_doctors'],
            default: 'private'
        },
        sharedWith: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    }
}, {
    timestamps: true
});

healthGoalSchema.index({ userId: 1, status: 1 });

healthGoalSchema.methods.calculateProgress = function () {
    const current = this.currentValue;
    if (current === null || current === undefined) return 0;

    let progress = 0;

    if (this.goalType === 'range' || (this.minValue !== null || this.maxValue !== null)) {
        const min = this.minValue;
        const max = this.maxValue;

        if (min !== null && max !== null) {
            if (current >= min && current <= max) {
                progress = 100;
            } else if (current < min) {
                const distance = min - current;
                const range = max - min;
                progress = Math.max(0, 100 - (distance / range) * 100);
            } else {
                const distance = current - max;
                const range = max - min;
                progress = Math.max(0, 100 - (distance / range) * 100);
            }
        } else if (min !== null) {
            progress = current >= min ? 100 : Math.max(0, (current / min) * 100);
        } else if (max !== null) {
            progress = current <= max ? 100 : Math.max(0, (max / current) * 100);
        }
    }
    else if (this.targetValue !== null) {
        const start = this.initialValue ?? this.milestones[0]?.value ?? current;
        const target = this.targetValue;

        if (this.goalType === 'decrease') {
            if (start === target) {
                progress = current <= target ? 100 : 0;
            } else {
                progress = ((start - current) / (start - target)) * 100;
            }
        } else if (this.goalType === 'increase') {
            if (target === start) {
                progress = current >= target ? 100 : 0;
            } else {
                progress = ((current - start) / (target - start)) * 100;
            }
        } else if (this.goalType === 'maintain') {
            const tolerance = target * 0.05;
            if (Math.abs(current - target) <= tolerance) {
                progress = 100;
            } else {
                progress = Math.max(0, 100 - (Math.abs(current - target) / tolerance) * 50);
            }
        }
    }
    else {
        progress = 0;
    }

    this.progress = Math.min(100, Math.max(0, progress));
    return this.progress;
};

healthGoalSchema.methods.checkAchievement = function () {
    if (this.currentValue === null || this.currentValue === undefined) return false;

    const current = this.currentValue;

    if (this.goalType === 'range' || (this.minValue !== null || this.maxValue !== null)) {
        const min = this.minValue;
        const max = this.maxValue;

        if (min !== null && max !== null) {
            return current >= min && current <= max;
        } else if (min !== null) {
            return current >= min;
        } else if (max !== null) {
            return current <= max;
        }
        return false;
    }

    if (this.targetValue === null) return false;

    const tolerance = this.targetValue * 0.05;

    if (this.goalType === 'decrease') {
        return current <= this.targetValue;
    } else if (this.goalType === 'increase') {
        return current >= this.targetValue;
    } else if (this.goalType === 'maintain') {
        return Math.abs(current - this.targetValue) <= tolerance;
    }

    return false;
};

const HealthGoal = mongoose.model('HealthGoal', healthGoalSchema);
export default HealthGoal;