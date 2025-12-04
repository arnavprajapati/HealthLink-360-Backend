import { GoogleGenerativeAI } from '@google/generative-ai';
import HealthLog from '../models/HealthLog.js';
import Note from '../models/Note.js';
import Connection from '../models/Connection.js';

// @desc    Generate AI summary of patient health
// @route   POST /api/connect/patient/:patientId/ai-summary
// @access  Private (Doctor only)
export const generatePatientSummary = async (req, res) => {
    try {
        // Initialize Gemini inside the function to ensure env vars are loaded
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined in environment variables');
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        
        const { patientId } = req.params;
        const doctorId = req.user.id;

        // Verify connection
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

        // Fetch recent health logs (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const logs = await HealthLog.find({
            userId: patientId,
            recordDate: { $gte: thirtyDaysAgo }
        }).sort({ recordDate: 1 });

        // Fetch recent notes
        const notes = await Note.find({
            patient: patientId
        }).sort({ date: -1 }).limit(5);

        if (logs.length === 0 && notes.length === 0) {
            return res.status(200).json({
                success: true,
                summary: "Insufficient data to generate a summary. Please add health logs or clinical notes."
            });
        }

        // Construct Prompt
        let prompt = `You are an AI medical assistant. Analyze the following health data for a patient and provide a concise clinical summary for the doctor. Focus on trends, anomalies, and key observations. Do not give medical advice, just summarize the data.\n\n`;

        if (logs.length > 0) {
            prompt += `Recent Health Logs (Last 30 days):\n`;
            logs.forEach(log => {
                prompt += `- ${new Date(log.recordDate).toLocaleDateString()}: ${log.diseaseType} - ${log.aiAnalysis?.summary || 'No summary'} (${log.aiAnalysis?.riskLevel || 'N/A'})\n`;
            });
            prompt += `\n`;
        }

        if (notes.length > 0) {
            prompt += `Recent Clinical Notes:\n`;
            notes.forEach(note => {
                prompt += `- ${new Date(note.date).toLocaleDateString()}: ${note.title} - ${note.description}\n`;
            });
            prompt += `\n`;
        }

        prompt += `Summary:`;

        // Generate Content
        // Using gemini-2.0-flash as it is available and stable
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.status(200).json({
            success: true,
            summary: text
        });

    } catch (error) {
        console.error('AI Summary Error:', error);
        
        let message = error.message || 'Error generating AI summary';
        
        if (error.message.includes('SERVICE_DISABLED') || error.message.includes('403 Forbidden')) {
            message = 'Google Generative AI API is not enabled. Please enable it in your Google Cloud Console.';
        }

        res.status(500).json({
            success: false,
            message: message,
            details: error.toString(),
            stack: error.stack // Add stack trace for more info
        });
    }
};
