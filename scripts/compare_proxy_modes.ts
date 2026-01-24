
import { chromium } from 'playwright';

const URLS = [
    'https://www.google.com',
    'https://www.amazon.com',
    'https://www.facebook.com',
    'https://www.apple.com',
    'https://www.netflix.com'
];

const PROXY_HOST = 'http://c36288e57056c2d5.byi.na.pyproxy.io:16666';
const PASSWORD = 'G12345678';

const CONFIGS = [
    {
        name: 'RANDOM (Rotating)',
        username: 'proxyming123-zone-resi'
    },
    {
        name: 'STICKY (Session)',
        username: `proxyming123-zone-resi-session-${Math.random().toString(36).substring(2, 10)}-sessTime-30`
    }
];

async function testConfig(config: typeof CONFIGS[0]) {
    console.log(`\nTesting ${config.name}...`);
    const times: number[] = [];
    let success = 0;

    for (const url of URLS) {
        const start = Date.now();
        let browser;
        try {
            browser = await chromium.launch({
                headless: true,
                proxy: {
                    server: PROXY_HOST,
                    username: config.username,
                    password: PASSWORD
                }
            });

            const page = await browser.newPage();
            // Timeout after 15s to fail fail_fast
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const duration = Date.now() - start;
            times.push(duration);
            success++;
            process.stdout.write('.');
        } catch (e: any) {
            process.stdout.write('x');
        } finally {
            if (browser) await browser.close();
        }
    }
    console.log(' Done.');

    if (times.length === 0) return { avg: 0, success: 0 };
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return { avg, success };
}

async function run() {
    console.log('🏎️  Starting Head-to-Head Proxy Speed Test');

    const results = [];

    for (const config of CONFIGS) {
        const result = await testConfig(config);
        results.push({ ...config, ...result });
    }

    console.log('\n\n🏁 RESULTS');
    console.table(results.map(r => ({
        Mode: r.name,
        'Success Rate': `${r.success}/${URLS.length}`,
        'Avg Time (ms)': Math.round(r.avg)
    })));
}

run();
