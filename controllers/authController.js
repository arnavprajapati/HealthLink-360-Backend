import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import admin from '../config/firebaseAdmin.js';

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '7d'
    });
};

const setTokenCookie = (res, token) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};


export const signup = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const user = await User.create({
            email,
            password,
            displayName: email.split('@')[0],
            role: role || 'patient'
        });

        const token = generateToken(user._id);
        setTokenCookie(res, token);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                uid: user._id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                photoURL: user.photoURL
            }
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

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
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

        res.cookie('token', '', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            expires: new Date(0)
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
                photoURL: user.photoURL
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
            user = await User.create({
                email,
                password: `google_auth_placeholder_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                displayName: name || email.split('@')[0],
                role: role || 'patient',
                photoURL: picture || null,
                authProvider: 'google',
                firebaseUid: uid
            });
        } else {
            if (user.authProvider !== 'google') {
                user.authProvider = 'google';
            }
            if (picture && user.photoURL !== picture) {
                user.photoURL = picture;
            }
            if (name && user.displayName !== name) {
                user.displayName = name;
            }
            if (!user.firebaseUid) {
                user.firebaseUid = uid;
            }
            await user.save();
        }

        const token = generateToken(user._id);
        setTokenCookie(res, token);

        res.status(200).json({
            success: true,
            message: 'Google login successful',
            user: {
                uid: user._id,
                email: user.email,
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