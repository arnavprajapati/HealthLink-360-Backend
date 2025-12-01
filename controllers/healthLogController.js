import HealthLog from '../models/HealthLog.js';
import { analyzeHealthDocument, getHealthKnowledge } from '../services/geminiService.js';
import fs from 'fs';
import mongoose from 'mongoose';

export const createHealthLog = async (req, res) => {
    try {
        const { description } = req.body;
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a medical report (image or PDF)'
            });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const fileName = req.file.originalname;
        const fileType = req.file.mimetype.startsWith('image') ? 'image' : 'pdf';

        let aiData = null;
        
        try {
            aiData = await analyzeHealthDocument(req.file.path, fileType);
            console.log('AI Analysis Result:', JSON.stringify(aiData, null, 2));
        } catch (aiError) {
            console.error('AI Analysis Error:', aiError);
            
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(500).json({
                success: false,
                message: 'Failed to analyze the medical report. Please try again with a clearer image or PDF.'
            });
        }

        const testDateString = aiData.testDate;
        let finalTestDate = null;
        
        if (testDateString) {
            const dateObj = new Date(testDateString);
            if (!isNaN(dateObj.getTime())) { 
                finalTestDate = dateObj;
            } else {
                console.warn(`AI returned invalid date string: ${testDateString}. Setting testDate to null to prevent Mongoose validation error.`);
            }
        }

        const healthLog = await HealthLog.create({
            userId,
            diseaseType: aiData.diseaseType || 'general',
            detectedDisease: aiData.diseaseType,
            readings: aiData.readings || [],
            aiAnalysis: {
                summary: aiData.summary,
                detectedConditions: aiData.detectedConditions || [],
                riskLevel: aiData.riskLevel || 'low',
                recommendations: aiData.recommendations || [],
                keyFindings: aiData.keyFindings || [],
                abnormalTests: aiData.abnormalTests || []
            },
            description,
            fileUrl,
            fileName,
            fileType,
            rawAiData: aiData,
            testDate: finalTestDate
        });

        res.status(201).json({
            success: true,
            message: 'Health report analyzed and saved successfully',
            data: healthLog
        });
    } catch (error) {
        console.error('Create Health Log Error:', error);

        if (req.file && fs.existsSync(req.file.path)) {
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
        const { diseaseType, limit = 50, page = 1, sortBy = 'recordDate' } = req.query;

        const query = { userId };
        if (diseaseType && diseaseType !== 'all') {
            query.diseaseType = diseaseType;
        }

        const healthLogs = await HealthLog.find(query)
            .sort({ [sortBy]: -1, createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await HealthLog.countDocuments(query);

        res.status(200).json({
            success: true,
            data: healthLogs,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
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

export const getTestDetails = async (req, res) => {
    try {
        const { logId, testName } = req.params;
        const userId = req.user.id;

        const healthLog = await HealthLog.findOne({ _id: logId, userId });

        if (!healthLog) {
            return res.status(404).json({
                success: false,
                message: 'Health log not found'
            });
        }

        const reading = healthLog.readings.find(r => 
            r.testName.toLowerCase() === testName.toLowerCase()
        );

        if (!reading) {
            return res.status(404).json({
                success: false,
                message: 'Test reading not found'
            });
        }

        if (!reading.healthInfo) {
            const knowledge = getHealthKnowledge(testName);
            if (knowledge) {
                const status = reading.status || 'normal';
                reading.healthInfo = {
                    description: knowledge.description,
                    causes: status === 'low' ? knowledge.causes?.low : 
                           status === 'high' ? knowledge.causes?.high : [],
                    recommendations: status === 'low' ? knowledge.recommendations?.low : 
                                     status === 'high' ? knowledge.recommendations?.high : [],
                    symptoms: status === 'low' ? knowledge.symptoms?.low : 
                              status === 'high' ? knowledge.symptoms?.high : [],
                    relatedTests: knowledge.relatedTests || []
                };
            }
        }

        res.status(200).json({
            success: true,
            data: {
                test: reading,
                overallAnalysis: healthLog.aiAnalysis
            }
        });
    } catch (error) {
        console.error('Get Test Details Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch test details'
        });
    }
};

export const getHealthStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await HealthLog.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$diseaseType',
                    count: { $sum: 1 },
                    latestDate: { $max: '$recordDate' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const recentLogs = await HealthLog.find({ userId })
            .sort({ recordDate: -1 })
            .limit(10);

        let abnormalCount = 0;
        recentLogs.forEach(log => {
            if (log.readings) {
                abnormalCount += log.readings.filter(r => 
                    r.status === 'high' || r.status === 'low' || r.status === 'critical'
                ).length;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                totalRecords: await HealthLog.countDocuments({ userId }),
                diseaseTypeBreakdown: stats,
                recentAbnormalTests: abnormalCount,
                recentLogs: recentLogs
            }
        });
    } catch (error) {
        console.error('Get Health Stats Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch health statistics'
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