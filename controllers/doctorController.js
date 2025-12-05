import HealthLog from '../models/HealthLog.js';
import HealthGoal from '../models/HealthGoal.js';
import Connection from '../models/Connection.js';
import { analyzeHealthGoal } from '../services/geminiService.js';

export const getPatientHealthData = async (req, res) => {
    try {
        const { patientId } = req.params;
        const doctorId = req.user.id;

        const connection = await Connection.findOne({
            doctor: doctorId,
            patient: patientId,
            status: 'accepted'
        });

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this patient\'s data'
            });
        }

        const logs = await HealthLog.find({
            userId: patientId,
            $or: [
                { 'sharing.visibility': 'all_doctors' },
                { 'sharing.visibility': 'specific_doctors', 'sharing.sharedWith': doctorId }
            ]
        }).sort({ recordDate: -1 });

        res.status(200).json({
            success: true,
            count: logs.length,
            logs
        });
    } catch (error) {
        console.error('Get Patient Data Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching patient data'
        });
    }
};

export const getPatientGoals = async (req, res) => {
    try {
        const { patientId } = req.params;
        const doctorId = req.user.id;

        const connection = await Connection.findOne({
            doctor: doctorId,
            patient: patientId,
            status: 'accepted'
        });

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this patient\'s data'
            });
        }

        const goals = await HealthGoal.find({
            userId: patientId,
            $or: [
                { 'sharing.visibility': 'all_doctors' },
                { 'sharing.visibility': 'specific_doctors', 'sharing.sharedWith': doctorId }
            ]
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: goals.length,
            goals
        });
    } catch (error) {
        console.error('Get Patient Goals Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching patient goals'
        });
    }
};


export const analyzePatientGoal = async (req, res) => {
    try {
        const { patientId, goalId } = req.params;
        const doctorId = req.user.id;

        // Verify connection exists and is accepted
        const connection = await Connection.findOne({
            doctor: doctorId,
            patient: patientId,
            status: 'accepted'
        });

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to analyze this patient\'s goals'
            });
        }

        // Fetch the specific goal
        const goal = await HealthGoal.findOne({ _id: goalId, userId: patientId });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        // Call Gemini AI for analysis
        const analysis = await analyzeHealthGoal(goal.toObject());

        res.status(200).json({
            success: true,
            analysis
        });
    } catch (error) {
        console.error('Analyze Patient Goal Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to analyze goal with AI'
        });
    }
};
