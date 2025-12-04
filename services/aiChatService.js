import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const aiResponseSchema = {
    type: "object",
    properties: {
        response: {
            type: "string",
            description: "The professional AI Health Assistant's detailed response to the patient."
        },
        suggestions: {
            type: "array",
            description: "A list of 3 specific follow-up questions or next steps for the user.",
            items: { type: "string" }
        }
    },
    required: ["response", "suggestions"]
};

function generateFollowUpsFromText(text) {
    const followUps = [];
    const lower = (text || '').toLowerCase();

    if (/blood sugar|glucose|hba1c|diabetes/.test(lower)) {
        followUps.push('When were your most recent fasting and post-meal glucose readings?');
        followUps.push('Are you currently taking any medication for blood sugar or diabetes?');
    }
    if (/blood pressure|hypertension|bp/.test(lower) && followUps.length < 3) {
        followUps.push('What are your latest blood pressure readings and measurement times?');
    }
    const generic = ['How long have you had these symptoms?', 'Any current medications or supplements?'];
    for (const g of generic) {
        if (followUps.length >= 3) break;
        if (!followUps.includes(g)) followUps.push(g);
    }
    return followUps.slice(0, 3);
}

export const getAiChatResponse = async (query, contextSummary, chatHistory) => {

    const safeContextSummary = typeof contextSummary === 'string' ? contextSummary : "No detailed patient health summary provided.";

    const chatHistoryText = chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0
        ? `PREVIOUS CONVERSATION HISTORY:\n${chatHistory.map(c =>
            `- ${c.role.toUpperCase()}: ${c.text || ''}` 
        ).join('\n')}\n`
        : '';

    const prompt = `You are a highly knowledgeable AI Health Assistant with COMPLETE ACCESS to this patient's medical records and health goals.
Your task is to provide personalized, accurate answers based on the patient's ACTUAL health data provided below.

CRITICAL INSTRUCTIONS:
1. You have access to the patient's COMPLETE health database - all test reports, readings, goals, and progress tracking.
2. ALWAYS reference specific values, dates, and test names from the patient's data when answering.
3. If the patient asks about a specific test, goal, or value - look it up in the data and provide exact numbers.
4. For goal progress questions - calculate and explain their actual progress with specific values.
5. For health trends - analyze the actual readings over time and provide insights.
6. Be supportive but medically responsible. Do not diagnose, but you can explain what the values mean.
7. If data is not available for a question, clearly state that.

${chatHistoryText}

═══════════════════════════════════════════════════════
       PATIENT'S COMPLETE HEALTH DATABASE
═══════════════════════════════════════════════════════
${safeContextSummary}
═══════════════════════════════════════════════════════

PATIENT'S QUESTION: "${query}"

RESPONSE REQUIREMENTS:
1. Use SPECIFIC values from the patient data above - cite exact test results, dates, and goal progress.
2. Be conversational but informative - explain medical terms in simple language.
3. For goals: mention exact progress percentage, current vs target values, and remaining days.
4. For test results: explain what each value means and whether it's normal/abnormal.
5. Provide actionable, personalized health advice based on their actual data.
6. Your output MUST be a valid JSON object with "response" and "suggestions" fields.
7. Include 3 relevant follow-up questions the patient might want to ask.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    try {
        // 3. Execute the API call with the CORRECT structure
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: aiResponseSchema,
            }
        });

        const responseText = result.response.text();
        let aiResponse;

        const cleanedResponse = responseText
            .replace(/```json\n?|\n?```/g, '')
            .replace(/```\n?|\n?```/g, '')
            .trim();

        try {
            aiResponse = JSON.parse(cleanedResponse);
        } catch (err) {
            console.warn('AI did not return valid JSON. Falling back to heuristic parsing.', err.message);
            aiResponse = {
                response: cleanedResponse || responseText,
                suggestions: generateFollowUpsFromText(cleanedResponse || responseText)
            };
        }

        if (!Array.isArray(aiResponse.suggestions) || aiResponse.suggestions.length < 1) {
            aiResponse.suggestions = generateFollowUpsFromText(aiResponse.response || responseText);
        }

        return {
            modelUsed: 'gemini-2.5-flash',
            data: aiResponse
        };

    } catch (error) {
        console.error('Gemini API Error Details:', error);
        // 7. Throw a clean, specific error
        throw new Error(`Gemini AI Service Error: ${error.message}`);
    }
};