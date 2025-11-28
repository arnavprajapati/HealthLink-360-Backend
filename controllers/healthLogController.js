import HealthLog from '../models/HealthLog.js';
import { analyzeHealthDocument } from '../services/geminiService.js';
import fs from 'fs';

export const createHealthLog = async (req, res) => {
    try {
        const { diseaseType, description, manualReadings } = req.body;
        const userId = req.user.id;

        let aiData = null;
        let fileUrl = null;
        let fileName = null;
        let fileType = null;

        if (req.file) {
            fileUrl = `/uploads/${req.file.filename}`;
            fileName = req.file.originalname;
            fileType = req.file.mimetype.startsWith('image') ? 'image' : 'pdf';

            try {
                aiData = await analyzeHealthDocument(req.file.path, fileType);
            } catch (aiError) {
                console.error('AI Analysis Error:', aiError);
            }
        }

        let finalReadings = {};
        let detectedDisease = diseaseType;

        if (aiData && aiData.readings) {
            finalReadings = aiData.readings;
            if (aiData.diseaseType && aiData.diseaseType !== 'other') {
                detectedDisease = aiData.diseaseType;
            }
        }

        if (manualReadings) {
            const parsedManual = typeof manualReadings === 'string'
                ? JSON.parse(manualReadings)
                : manualReadings;
            finalReadings = { ...finalReadings, ...parsedManual };
        }

        const healthLog = await HealthLog.create({
            userId,
            diseaseType: detectedDisease,
            detectedDisease: aiData?.diseaseType || null,
            readings: finalReadings,
            description,
            fileUrl,
            fileName,
            fileType,
            aiExtractedData: aiData
        });

        res.status(201).json({
            success: true,
            message: 'Health log created successfully',
            data: healthLog
        });
    } catch (error) {
        console.error('Create Health Log Error:', error);

        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create health log'
        });
    }
};

export const getHealthLogs = async (req, res) => {
    try {
        const userId = req.user.id;
        const { diseaseType, limit = 50, page = 1 } = req.query;

        const query = { userId };
        if (diseaseType && diseaseType !== 'all') {
            query.diseaseType = diseaseType;
        }

        const healthLogs = await HealthLog.find(query)
            .sort({ recordDate: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await HealthLog.countDocuments(query);

        res.status(200).json({
            success: true,
            data: healthLogs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get Health Logs Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch health logs'
        });
    }
};

export const getHealthLogById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const healthLog = await HealthLog.findOne({ _id: id, userId });

        if (!healthLog) {
            return res.status(404).json({
                success: false,
                message: 'Health log not found'
            });
        }

        res.status(200).json({
            success: true,
            data: healthLog
        });
    } catch (error) {
        console.error('Get Health Log Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch health log'
        });
    }
};

export const deleteHealthLog = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const healthLog = await HealthLog.findOne({ _id: id, userId });

        if (!healthLog) {
            return res.status(404).json({
                success: false,
                message: 'Health log not found'
            });
        }

        if (healthLog.fileUrl) {
            const filePath = `.${healthLog.fileUrl}`;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await HealthLog.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Health log deleted successfully'
        });
    } catch (error) {
        console.error('Delete Health Log Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete health log'
        });
    }
};