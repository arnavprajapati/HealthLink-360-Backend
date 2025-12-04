import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getAiChatResponse } from '../services/aiChatService.js';

const router = express.Router();

router.post('/chat', protect, async (req, res) => {
    try {
        const { query, contextSummary, chatHistory } = req.body;

        if (!query || typeof query !== 'string' || query.trim() === '') {
            return res.status(400).json({ success: false, message: 'Query must be a non-empty string.' });
        }

        const serviceResult = await getAiChatResponse(query, contextSummary, chatHistory);

        return res.status(200).json({
            success: true,
            ...serviceResult
        });

    } catch (error) {
        console.error('AI Chat Route Error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Unknown internal server error during AI processing.',
            error: error.message
        });
    }
});

export default router;