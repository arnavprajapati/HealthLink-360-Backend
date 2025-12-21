import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import admin from '../config/firebaseAdmin.js';

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '7d'
    });
};

const setTokenCookie = (res, token) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};


export const signup = async (req, res) => {
    try {
        const { email, password, name, role, speciality, clinicName, experience, qualification } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, password, and name'
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const user = await User.create({
            email: email.toLowerCase(),
            password,
            name,
            displayName: name,
            role: role || 'patient',
            emailVerified: false,
            authProvider: 'email',
            doctorProfile: role === 'doctor' ? {
                speciality,
                clinicName,
                experience,
                qualification
            } : undefined
        });

        // Don't set token or login during signup - user must verify email first
        res.status(201).json({
            success: true,
            message: 'User registered successfully. Please verify your email.',
            requiresVerification: true
        });
    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error during registration'
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if email is verified
        if (!user.emailVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in'
            });
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = generateToken(user._id);
        setTokenCookie(res, token);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                uid: user._id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                photoURL: user.photoURL
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error during login'
        });
    }
};


export const logout = async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie("token", "", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
            expires: new Date(0),
        });

        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error during logout'
        });
    }
};


export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            user: {
                uid: user._id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                photoURL: user.photoURL,
                doctorProfile: user.doctorProfile
            }
        });
    } catch (error) {
        console.error('Get User Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching user'
        });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { displayName, speciality, clinicName, experience, qualification } = req.body;

        if (displayName) user.displayName = displayName;

        if (user.role === 'doctor') {
            if (!user.doctorProfile) user.doctorProfile = {};

            if (speciality) user.doctorProfile.speciality = speciality;
            if (clinicName) user.doctorProfile.clinicName = clinicName;
            if (experience) user.doctorProfile.experience = experience;
            if (qualification) user.doctorProfile.qualification = qualification;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                uid: user._id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                photoURL: user.photoURL,
                doctorProfile: user.doctorProfile
            }
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating profile'
        });
    }
};


export const googleLogin = async (req, res) => {
    try {
        const { firebaseToken, role } = req.body;

        if (!firebaseToken) {
            return res.status(400).json({
                success: false,
                message: 'Firebase token is required for Google login'
            });
        }

        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        } catch (error) {
            console.error('Firebase Token Verification Error:', error);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired Firebase token'
            });
        }

        const { uid, email, name, picture } = decodedToken;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email not found in verified Firebase token'
            });
        }

        let user = await User.findOne({ email });

        if (!user) {
            const displayNameFromEmail = email.split('@')[0];
            const userName = name || displayNameFromEmail;

            user = await User.create({
                email,
                password: `google_auth_placeholder_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                name: userName,
                displayName: userName,
                role: role || 'patient',
                photoURL: picture || null,
                authProvider: 'google',
                firebaseUid: uid,
                emailVerified: true
            });
        } else {
            const updateFields = {
                authProvider: 'google',
                emailVerified: true
            };

            if (picture) updateFields.photoURL = picture;
            if (name) updateFields.displayName = name;
            if (!user.firebaseUid) updateFields.firebaseUid = uid;
            if (!user.name && name) updateFields.name = name;

            user = await User.findOneAndUpdate(
                { email },
                { $set: updateFields },
                { new: true }
            );
        }

        const token = generateToken(user._id);
        setTokenCookie(res, token);

        res.status(200).json({
            success: true,
            message: 'Google login successful',
            user: {
                uid: user._id,
                email: user.email,
                name: user.name,
                displayName: user.displayName,
                role: user.role,
                photoURL: user.photoURL
            }
        });
    } catch (error) {
        console.error('Google Login Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error during Google login'
        });
    }
};



export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent'
            });
        }

        if (user.authProvider === 'google') {
            return res.status(400).json({
                success: false,
                message: 'This account uses Google authentication. Please sign in with Google.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Password reset link sent to your email'
        });
    } catch (error) {
        console.error('Password Reset Request Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error requesting password reset'
        });
    }
};

export const resetPasswordDirect = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const updatedUser = await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { $set: { password: hashedPassword } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Direct Password Reset Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error resetting password'
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { firebaseToken, newPassword } = req.body;

        if (!firebaseToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Firebase token and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        } catch (error) {
            console.error('Firebase Token Verification Error:', error);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired Firebase token'
            });
        }

        const { email } = decodedToken;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email not found in token'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Password Reset Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error resetting password'
        });
    }
};

// Verify email with oobCode directly
export const verifyEmailWithCode = async (req, res) => {
    try {
        const { oobCode, email } = req.body;

        if (!oobCode || !email) {
            return res.status(400).json({
                success: false,
                message: 'Verification code and email are required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { email: email.toLowerCase() },
            { $set: { emailVerified: true } },
            { new: true }
        );

        const token = generateToken(updatedUser._id);
        setTokenCookie(res, token);

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            user: {
                uid: updatedUser._id,
                email: updatedUser.email,
                name: updatedUser.name,
                displayName: updatedUser.displayName,
                role: updatedUser.role,
                emailVerified: updatedUser.emailVerified,
                photoURL: updatedUser.photoURL
            }
        });
    } catch (error) {
        console.error('Email Verification Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error verifying email'
        });
    }
};
export const verifyEmail = async (req, res) => {
    try {
        const { firebaseToken } = req.body;

        if (!firebaseToken) {
            return res.status(400).json({
                success: false,
                message: 'Firebase token is required'
            });
        }

        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        } catch (error) {
            console.error('Firebase Token Verification Error:', error);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired Firebase token'
            });
        }

        const { email, email_verified } = decodedToken;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email not found in token'
            });
        }

        if (!email_verified) {
            return res.status(400).json({
                success: false,
                message: 'Email not verified in Firebase'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('Before verification - emailVerified:', user.emailVerified);
        user.emailVerified = true;
        await user.save();
        console.log('After verification - emailVerified:', user.emailVerified);

        // Generate token and log the user in automatically after verification
        const token = generateToken(user._id);
        setTokenCookie(res, token);

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            user: {
                uid: user._id,
                email: user.email,
                name: user.name,
                displayName: user.displayName,
                role: user.role,
                emailVerified: user.emailVerified,
                photoURL: user.photoURL
            }
        });
    } catch (error) {
        console.error('Email Verification Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error verifying email'
        });
    }
};