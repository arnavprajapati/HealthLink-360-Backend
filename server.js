import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import healthLogRoutes from './routes/healthLogRoutes.js';
import healthGoalRoutes from './routes/healthGoalRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174'
].filter(Boolean); 

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🎯 Goal Tracking API enabled`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

app.use('/api/auth', authRoutes);
app.use('/api/auth/health-logs', healthLogRoutes);
app.use('/api/auth/goals', healthGoalRoutes);
app.use('/api/auth/ai', aiRoutes);

app.get('/api/auth/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running',
        features: {
            healthLogs: true,
            goalTracking: true,
            aiInsights: true
        }
    });
});

app.use((err, req, res, next) => {
    res.status(500).json({
        success: false,
        message: err.message || 'Something went wrong!'
    });
});

export default app;