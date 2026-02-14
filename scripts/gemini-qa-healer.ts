
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Resend } from 'resend';

// Helper to run shell commands
const run = (cmd: string) => execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });

const GEMINI_API_KEY = "AIzaSyAFtTtMvkar-7Wfs11F8hGkB0_rZszS2pg";
const LOG_FILE = path.join(process.cwd(), 'logs/qa-latest.log');
const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Gemini QA Healer
 * 
 * 1. Reads the failed QA log.
 * 2. Asks Gemini 1.0 Pro for a fix.
 * 3. Applies the fix.
 * 4. Verifies the fix.
 * 5. Commits and alerts.
 */
async function heal() {
    console.log("🚑 Starting Gemini QA Healer...");

    if (!fs.existsSync(LOG_FILE)) {
        console.error("❌ No log file found at", LOG_FILE);
        return;
    }

    const logContent = fs.readFileSync(LOG_FILE, 'utf8');

    // Simple heuristic: If log is too long, take the last 500 lines
    const logLines = logContent.split('\n');
    const recentLog = logLines.slice(-500).join('\n');

    // Context files causing issues (usually scraper or qa-agent)
    const scraperCode = fs.readFileSync(path.join(process.cwd(), 'lib/scraper.ts'), 'utf8');
    const qaAgentCode = fs.readFileSync(path.join(process.cwd(), 'scripts/qa-agent.ts'), 'utf8');

    const prompt = `
    You are an expert TypeScript/Playwright engineer. 
    Our QA tests failed. Please analyze the logs and the provided code to fix the issue.
    
    ERROR LOG:
    ${recentLog}
    
    FILE: lib/scraper.ts
    ${scraperCode}
    
    FILE: scripts/qa-agent.ts
    ${qaAgentCode}
    
    TASK:
    1. Identify the root cause (e.g., Proxy connection failed, Timeout, selector change).
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

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            console.error("❌ No response from Gemini.");
            return;
        }

        // Clean markdown code blocks if present
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const fixes = JSON.parse(jsonStr);

        console.log(`🛠️ Gemini proposed fixes for: ${fixes.map((f: any) => f.filepath).join(', ')}`);

        // Apply Fixes
        for (const fix of fixes) {
            const targetPath = path.join(process.cwd(), fix.filepath);
            fs.writeFileSync(targetPath, fix.content);
            console.log(`✅ Patched ${fix.filepath}`);
        }

        // Verify Fix
        console.log("🔄 Verifying fix by running QA...");
        try {
            run('npm run qa');
            console.log("✅ verification PASSED!");

            // Commit and Push
            run('git add .');
            run('git commit -m "QA Auto-Fix: Automated repair by Gemini 1.0"');
            run('git push');
            console.log("🚀 Fix pushed to repository.");

            await sendReport(true, "QA Auto-Fix Succeeded", "Gemini successfully repaired the broken tests.");

        } catch (e) {
            console.error("❌ Verification FAILED. Reverting changes...");
            run('git checkout .');
            await sendReport(false, "QA Auto-Fix Failed", "Gemini's fix did not solve the issue.");
        }

    } catch (error) {
        console.error("💥 Healer crashed:", error);
    }
}

async function sendReport(success: boolean, subject: string, message: string) {
    if (!RESEND_API_KEY) return;

    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: 'mingcomco@gmail.com',
        subject: `${success ? '✅' : '❌'} ${subject}`,
        html: `<p>${message}</p>`
    });
}

heal();
