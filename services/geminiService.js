import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export const analyzeHealthDocument = async (filePath, fileType) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        let fileData;
        if (fileType === 'pdf') {
            fileData = {
                inlineData: {
                    data: fs.readFileSync(filePath).toString('base64'),
                    mimeType: 'application/pdf'
                }
            };
        } else {
            fileData = {
                inlineData: {
                    data: fs.readFileSync(filePath).toString('base64'),
                    mimeType: 'image/jpeg'
                }
            };
        }

        const prompt = `Analyze this medical document/report and extract the following information in JSON format:
        {
            "diseaseType": "diabetes/hypertension/thyroid/kidney/heart/liver/cholesterol/other",
            "readings": {},
            "testDate": "YYYY-MM-DD",
            "summary": "Brief summary of findings"
        }
        
        If you cannot detect specific disease type, set it as "other". Extract only numeric values for readings.`;

        const result = await model.generateContent([prompt, fileData]);
        const response = result.response.text();

        const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanedResponse);
    } catch (error) {
        console.error('Gemini AI Error:', error);
        throw new Error('Failed to analyze document with AI');
    }
};