const express = require('express');
const { Groq } = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/* ==============================
   Resume Analysis
=================================*/
app.post('/api/analyze', async (req, res) => {
    try {
        const { resume, company, role, level } = req.body;

        const completion = await groq.chat.completions.create({
            messages: [{
                role: "system",
                content: `You are an expert HR. Compare this resume: ${resume}
                with a ${level} level ${role} role at ${company}.
                Provide:
                - Match Score out of 100
                - 3 bullet improvements`
            }],
            model: "llama-3.1-8b-instant",
        });

        res.json({ feedback: completion.choices[0].message.content });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Analysis failed" });
    }
});

/* ==============================
   Interview Endpoint
=================================*/
app.post('/api/interview', async (req, res) => {
    try {
        const { answer, history, company, role, level } = req.body;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
                    You are a technical interviewer for ${company}.
                    Interviewing for ${role} (${level}).

                    RULES:
                    - Ask related to resume like project and about internships 
                    - Ask ONE technical question at a time
                    - Keep it short (max 2 sentences)
                    - If user says end, conclude politely
                    `
                },
                ...history,
                { role: "user", content: answer }
            ],
            model: "llama-3.3-70b-versatile",
        });

        res.json({ question: completion.choices[0].message.content });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Interview error" });
    }
});

/* ==============================
   Final Report
=================================*/
app.post('/api/report', async (req, res) => {
    try {
        const { history } = req.body;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
                    You are a senior technical hiring manager.

                    Analyze the full interview and provide:

                    1. Technical Score (out of 100)
                    2. Communication Score (out of 100)
                    3. Strengths (bullet points)
                    4. Areas for Improvement (bullet points)
                    5. Final Hiring Recommendation
                    `
                },
                ...history
            ],
            model: "llama-3.3-70b-versatile",
        });

        res.json({ report: completion.choices[0].message.content });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Report failed" });
    }
});

// Use the port provided by the host, or default to 3000 for local development
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Prep2Pro Live at: http://localhost:${PORT}`);
});