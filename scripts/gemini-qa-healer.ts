
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load .env.local if it exists
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

const LOG_FILE = path.join(process.cwd(), 'logs/qa-latest.log');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_TO = process.env.EMAIL_TO || 'mingcomco@gmail.com';

async function heal() {
    console.log("🚑 Starting Secure Gemini QA Healer...");

    if (!GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY not found in environment.");
        return;
    }

    if (!fs.existsSync(LOG_FILE)) {
        console.error("❌ No log file found at", LOG_FILE);
        return;
    }

    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const recentLog = logContent.split('\n').slice(-500).join('\n');

    const scraperCode = fs.readFileSync(path.join(process.cwd(), 'lib/scraper.ts'), 'utf8');
    const qaAgentCode = fs.readFileSync(path.join(process.cwd(), 'scripts/qa-agent.ts'), 'utf8');

    const prompt = `
    You are an expert TypeScript/Playwright engineer. 
    Our QA tests failed. Please analyze the logs and the provided code to diagnose the issue and propose a fix.
    
    ERROR LOG:
    ${recentLog}
    
    FILE: lib/scraper.ts
    ${scraperCode}
    
    FILE: scripts/qa-agent.ts
    ${qaAgentCode}
    
    TASK:
    1. Identify the root cause.
    2. Provide a code fix.
    3. Return a JSON object with the filename and the *complete* new content of the file.
    
    RESTRICTION:
    - Return ONLY valid JSON.
    - Do not use markdown blocks.
    - If multiple files need changes, return an array of objects.
    
    JSON FORMAT:
    [
        {
            "filepath": "lib/scraper.ts", 
            "content": "..."
        }
    ]
    `;

    try {
        console.log("🧠 Consulting Gemini 1.0 Pro...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json() as any;
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.error("❌ No response from Gemini.");
            return;
        }

        const jsonStr: string = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const fixes: any[] = JSON.parse(jsonStr);

        // Instead of auto-applying, we save the proposal for review
        const proposalPath = path.join(process.cwd(), 'logs/proposed-fix.json');
        fs.writeFileSync(proposalPath, JSON.stringify(fixes, null, 2));
        console.log(`✅ Proposed fix saved to ${proposalPath}`);

        // Send a report
        if (RESEND_API_KEY) {
            const resend = new Resend(RESEND_API_KEY);
            const fixSummary = fixes.map((f: any) => f.filepath).join(', ');

            await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: EMAIL_TO,
                subject: "🚑 QA Fix Proposed",
                html: `
                    <h3>Gemini has analyzed the QA failure and proposed a fix.</h3>
                    <p><strong>Files affected:</strong> ${fixSummary}</p>
                    <p>The proposal is saved in <code>logs/proposed-fix.json</code> on the server.</p>
                `
            });
            console.log("📧 Proposal notification sent.");
        }

    } catch (error: any) {
        console.error("💥 Healer crashed:", error.message || error);
    }
}

heal();
