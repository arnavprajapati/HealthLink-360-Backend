import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const healthKnowledge = {
    "Hemoglobin": {
        description: "Hemoglobin carries oxygen from lungs to body tissues and returns carbon dioxide back to lungs.",
        causes: {
            low: ["Iron deficiency", "Blood loss", "Anemia", "Chronic diseases"],
            high: ["Dehydration", "Lung disease", "Living at high altitude", "Polycythemia"]
        },
        recommendations: {
            low: ["Eat iron-rich foods (spinach, red meat, lentils)", "Take iron supplements if prescribed", "Increase Vitamin C intake", "Consult a hematologist"],
            high: ["Stay well hydrated", "Avoid smoking", "Monitor oxygen levels", "Consult a doctor"]
        },
        symptoms: {
            low: ["Fatigue", "Weakness", "Pale skin", "Shortness of breath", "Dizziness"],
            high: ["Headaches", "Dizziness", "Blurred vision", "High blood pressure"]
        },
        relatedTests: ["Complete Blood Count (CBC)", "Iron Studies", "Ferritin", "Vitamin B12"]
    },
    "Blood Sugar": {
        description: "Blood glucose level indicates how well your body processes sugar for energy.",
        causes: {
            low: ["Skipping meals", "Too much insulin", "Excessive exercise", "Alcohol consumption"],
            high: ["Diabetes", "Poor diet", "Lack of exercise", "Stress", "Medications"]
        },
        recommendations: {
            low: ["Eat small frequent meals", "Carry glucose tablets", "Monitor levels regularly", "Avoid alcohol on empty stomach"],
            high: ["Follow diabetic diet", "Exercise regularly", "Take medications as prescribed", "Monitor blood sugar daily", "Reduce carb intake"]
        },
        symptoms: {
            low: ["Shakiness", "Sweating", "Confusion", "Rapid heartbeat", "Hunger"],
            high: ["Increased thirst", "Frequent urination", "Blurred vision", "Fatigue", "Slow healing"]
        },
        relatedTests: ["HbA1c", "Fasting Blood Sugar", "Random Blood Sugar", "Glucose Tolerance Test"]
    },
    "Blood Pressure": {
        description: "Blood pressure measures the force of blood against artery walls.",
        causes: {
            low: ["Dehydration", "Heart problems", "Medications", "Nutritional deficiencies"],
            high: ["Obesity", "Lack of exercise", "High salt intake", "Stress", "Genetics"]
        },
        recommendations: {
            low: ["Increase salt intake slightly", "Drink more water", "Wear compression stockings", "Eat small frequent meals"],
            high: ["Reduce sodium intake", "Exercise regularly", "Lose weight if needed", "Manage stress", "Limit alcohol"]
        },
        symptoms: {
            low: ["Dizziness", "Fainting", "Fatigue", "Blurred vision", "Nausea"],
            high: ["Headaches", "Nosebleeds", "Chest pain", "Shortness of breath", "Vision problems"]
        },
        relatedTests: ["ECG", "Echocardiogram", "Cholesterol panel", "Kidney function tests"]
    },
    "Cholesterol": {
        description: "Cholesterol is a waxy substance needed for building cells but can be harmful in excess.",
        causes: {
            high: ["Poor diet", "Obesity", "Lack of exercise", "Smoking", "Genetics"]
        },
        recommendations: {
            high: ["Eat heart-healthy foods", "Exercise regularly", "Lose excess weight", "Quit smoking", "Take statins if prescribed"]
        },
        symptoms: {
            high: ["Usually no symptoms", "May lead to heart disease", "Chest pain", "Stroke risk"]
        },
        relatedTests: ["Lipid Profile", "LDL", "HDL", "Triglycerides", "Apolipoprotein B"]
    },
    "Creatinine": {
        description: "Creatinine is a waste product filtered by kidneys; high levels indicate kidney problems.",
        causes: {
            high: ["Kidney disease", "Dehydration", "High protein diet", "Muscle breakdown"]
        },
        recommendations: {
            high: ["Reduce protein intake", "Stay hydrated", "Monitor kidney function", "Control blood pressure and sugar"]
        },
        symptoms: {
            high: ["Fatigue", "Swelling in feet/ankles", "Decreased urine output", "Nausea"]
        },
        relatedTests: ["Blood Urea Nitrogen (BUN)", "GFR", "Urinalysis", "Kidney Ultrasound"]
    },
    "Thyroid (TSH)": {
        description: "TSH regulates thyroid hormone production; abnormal levels affect metabolism.",
        causes: {
            low: ["Hyperthyroidism", "Thyroid medication excess", "Thyroid nodules"],
            high: ["Hypothyroidism", "Thyroid gland damage", "Iodine deficiency"]
        },
        recommendations: {
            low: ["Take anti-thyroid medication", "Consider radioactive iodine therapy", "Regular monitoring"],
            high: ["Take thyroid hormone replacement", "Increase iodine intake", "Regular blood tests"]
        },
        symptoms: {
            low: ["Weight loss", "Rapid heartbeat", "Anxiety", "Sweating", "Tremors"],
            high: ["Weight gain", "Fatigue", "Cold sensitivity", "Dry skin", "Hair loss"]
        },
        relatedTests: ["Free T3", "Free T4", "Thyroid antibodies", "Thyroid ultrasound"]
    }
};

export const analyzeHealthDocument = async (filePath, fileType) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-robotics-er-1.5-preview' });

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

        const prompt = `You are a medical report analyzer. Analyze this medical document/report thoroughly and extract ALL test results with their ranges.

Return ONLY valid JSON in this EXACT format (no markdown, no code blocks):
{
    "diseaseType": "diabetes/hypertension/thyroid/kidney/heart/liver/cholesterol/general/other",
    "testDate": "YYYY-MM-DD or null",
    "summary": "Brief 2-3 sentence summary of overall health status",
    "detectedConditions": ["list of detected conditions or risks"],
    "riskLevel": "low/moderate/high/critical",
    "keyFindings": ["most important findings"],
    "abnormalTests": ["list of abnormal test names"],
    "recommendations": ["specific actionable recommendations"],
    "readings": [
        {
            "testName": "Hemoglobin",
            "value": 12.5,
            "unit": "g/dL",
            "normalRange": {
                "min": 13,
                "max": 17,
                "text": "13-17 g/dL"
            },
            "status": "low/normal/high/borderline/critical",
            "category": "Blood/Liver/Kidney/Heart/Thyroid/Lipid/Other"
        }
    ]
}

CRITICAL INSTRUCTIONS:
1. Extract EVERY test result you can find
2. For each test, include the NORMAL RANGE if shown in the report
3. Compare patient value with normal range to set status:
   - "normal": within range
   - "low": below minimum
   - "high": above maximum
   - "borderline": slightly outside range
   - "critical": dangerously outside range
4. If normal range is not in report, use standard medical ranges
5. Common test categories: Blood (CBC, Hemoglobin), Liver (ALT, AST, Bilirubin), Kidney (Creatinine, BUN), Lipid (Cholesterol, LDL, HDL, Triglycerides), Thyroid (TSH, T3, T4), Heart (Troponin, BNP)
6. Set diseaseType based on predominant tests (e.g., lipid panel = cholesterol, kidney function = kidney)
7. Return ONLY the JSON object, no additional text`;

        const result = await model.generateContent([prompt, fileData]);
        const response = result.response.text();

        // Clean response
        const cleanedResponse = response
            .replace(/```json\n?|\n?```/g, '')
            .replace(/```\n?|\n?```/g, '')
            .trim();

        const aiData = JSON.parse(cleanedResponse);

        if (aiData.readings && Array.isArray(aiData.readings)) {
            aiData.readings = aiData.readings.map(reading => {
                const knowledgeKey = Object.keys(healthKnowledge).find(key =>
                    reading.testName.toLowerCase().includes(key.toLowerCase()) ||
                    key.toLowerCase().includes(reading.testName.toLowerCase())
                );

                if (knowledgeKey) {
                    const knowledge = healthKnowledge[knowledgeKey];
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

                return reading;
            });
        }

        return aiData;

    } catch (error) {
        console.error('Gemini AI Error:', error);
        throw new Error('Failed to analyze document with AI: ' + error.message);
    }
};

export const getHealthKnowledge = (testName) => {
    const knowledgeKey = Object.keys(healthKnowledge).find(key =>
        testName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(testName.toLowerCase())
    );

    return knowledgeKey ? healthKnowledge[knowledgeKey] : null;
};

export const analyzeHealthGoal = async (goal) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-robotics-er-1.5-preview' });

        const knowledge = getHealthKnowledge(goal.parameter);

        const milestonesText = goal.milestones?.map((m, idx) =>
            `${new Date(m.date).toLocaleDateString()}: ${m.value} ${goal.unit} (${m.note || 'No note'})`
        ).join('\n') || 'No milestones recorded yet';

        const daysRemaining = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        const totalDays = Math.ceil((new Date(goal.deadline) - new Date(goal.startDate || goal.createdAt)) / (1000 * 60 * 60 * 24));
        const daysElapsed = totalDays - daysRemaining;

        const prompt = `You are a health coach AI. Analyze this health goal and provide personalized insights.

GOAL DETAILS:
- Parameter: ${goal.parameter}
- Goal Type: ${goal.goalType} (user wants to ${goal.goalType} this value)
- Current Value: ${goal.currentValue || 'Not recorded'} ${goal.unit}
- Target Value: ${goal.targetValue} ${goal.unit}
- Start Value: ${goal.milestones?.[0]?.value || goal.currentValue || 'Unknown'} ${goal.unit}
- Progress: ${goal.progress}%
- Status: ${goal.status}
- Days Elapsed: ${daysElapsed} days
- Days Remaining: ${daysRemaining} days
- Deadline: ${new Date(goal.deadline).toLocaleDateString()}

MILESTONE HISTORY:
${milestonesText}

${knowledge ? `MEDICAL CONTEXT:
- Description: ${knowledge.description}
- Causes of abnormal values: ${JSON.stringify(knowledge.causes)}
- Symptoms: ${JSON.stringify(knowledge.symptoms)}
` : ''}

Analyze the progress and provide insights in this JSON format ONLY (no markdown):
{
    "assessment": "2-3 sentences assessing current progress - be specific about numbers and percentages",
    "prediction": "Based on the rate of change, predict when user will reach goal OR if they're on track",
    "recommendations": [
        "Specific actionable recommendation 1",
        "Specific actionable recommendation 2",
        "Specific actionable recommendation 3"
    ],
    "lifestyle": [
        "Diet or exercise tip relevant to this parameter",
        "Another lifestyle suggestion",
        "Daily habit recommendation"
    ],
    "warnings": [
        "Any concerns or warning signs (empty array if none)"
    ],
    "motivation": "A short motivational message based on their progress"
}

Be encouraging but realistic. If progress is slow, provide constructive feedback. Use specific numbers from the data.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Clean response
        const cleanedResponse = response
            .replace(/```json\n?|\n?```/g, '')
            .replace(/```\n?|\n?```/g, '')
            .trim();

        return JSON.parse(cleanedResponse);

    } catch (error) {
        console.error('Gemini Goal Analysis Error:', error);
        throw new Error('Failed to analyze goal with AI: ' + error.message);
    }
};
