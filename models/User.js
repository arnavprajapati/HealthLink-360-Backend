import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    displayName: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['patient', 'doctor'],
        default: 'patient'
    },
    photoURL: {
        type: String,
        default: null
    },
    authProvider: {
        type: String,
        enum: ['email', 'google'],
        default: 'email'
    },
    firebaseUid: {
        type: String,
        sparse: true,
        unique: true
    },
    doctorProfile: {
        speciality: {
            type: String,
            trim: true
        },
        clinicName: {
            type: String,
            trim: true
        },
        experience: {
            type: Number,
            default: 0
        },
        qualification: {
            type: String,
            trim: true
        }
    },
    googleTokens: {
        access_token: { type: String, default: null },
        refresh_token: { type: String, default: null },
        scope: { type: String, default: null },
        token_type: { type: String, default: null },
        expiry_date: { type: Number, default: null }
    },
    googleCalendarConnected: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    if (this.password && this.password.startsWith('google_auth_placeholder_')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    delete user.__v;
    return user;
};

const User = mongoose.model('User', userSchema);

export default User;