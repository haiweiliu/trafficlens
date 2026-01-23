
import { chromium } from 'playwright';

// Top 30 domains for testing
const DOMAINS = [
    'google.com', 'youtube.com', 'facebook.com', 'amazon.com', 'wikipedia.org',
    'instagram.com', 'twitter.com', 'linkedin.com', 'reddit.com', 'netflix.com',
    'tiktok.com', 'bing.com', 'microsoft.com', 'apple.com', 'twitch.tv',
    'pinterest.com', 'zoom.us', 'weather.com', 'adobe.com', 'walmart.com',
    'craigslist.org', 'ebay.com', 'nytimes.com', 'cnn.com', 'espn.com',
    'salesforce.com', 'paypal.com', 'spotify.com', 'slack.com', 'dropbox.com'
];

async function benchmark() {
    console.log(`🚀 Starting Benchmark: 30 Domains`);
    console.log(`⚙️  Strategy: STICKY IP (Session-based)`);

    const BATCH_SIZE = 5; // Conservative batching for test
    const results: { domain: string; status: 'ok' | 'fail'; timeMs: number; ip: string }[] = [];

    const startTime = Date.now();

    for (let i = 0; i < DOMAINS.length; i += BATCH_SIZE) {
        const batch = DOMAINS.slice(i, i + BATCH_SIZE);
        console.log(`\nProcessing Batch ${i / BATCH_SIZE + 1}... (${batch.join(', ')})`);

        await Promise.all(batch.map(async (domain) => {
            const start = Date.now();
            try {
                const sessionId = Math.random().toString(36).substring(2, 10);
                const browser = await chromium.launch({
                    headless: true,
                    proxy: {
                        server: 'http://c36288e57056c2d5.byi.na.pyproxy.io:16666',
                        username: `proxyming123-zone-resi-session-${sessionId}-sessTime-30`,
                        password: 'G12345678'
                    }
                });

                const page = await browser.newPage();

                // 1. Check IP (lightweight validation)
                await page.goto('https://api.ipify.org?format=json');
                const ipJson = JSON.parse(await page.evaluate(() => document.body.innerText));

                // 2. Simulate "Scrape" (Simple Nav)
                // We use a lighter target than traffic.cv for the benchmark to rely solely on proxy speed, 
                // to avoid getting the benchmark IP blocked by traffic.cv during a "test".
                await page.goto(`http://${domain}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

                await browser.close();

                const timeMs = Date.now() - start;
                results.push({ domain, status: 'ok', timeMs, ip: ipJson.ip });
                process.stdout.write('✅'); // Tick
            } catch (e: any) {
                const timeMs = Date.now() - start;
                results.push({ domain, status: 'fail', timeMs, ip: 'unknown' });
                process.stdout.write('❌'); // Cross
            }
        }));
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const successCount = results.filter(r => r.status === 'ok').length;

    console.log('\n\n📊 BENCHMARK RESULTS');
    console.log('--------------------');
    console.log(`Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`Success Rate: ${successCount}/${DOMAINS.length} (${((successCount / DOMAINS.length) * 100).toFixed(1)}%)`);
    console.log(`Avg Request Time: ${(results.reduce((a, b) => a + b.timeMs, 0) / results.length / 1000).toFixed(2)}s`);

    // Verify IP Rotation
    const uniqueIPs = new Set(results.map(r => r.ip).filter(ip => ip !== 'unknown'));
    console.log(`Unique IPs Used: ${uniqueIPs.size}/${successCount} (Should be near 100% for Randomize)`);

    if (successCount === 30 && uniqueIPs.size > 20) {
        console.log('\n✅ CONCLUSION: "Randomize IP" is working perfectly. High speed, distinct IPs.');
    } else {
        console.log('\n⚠️  CONCLUSION: Some issues detected.');
    }
}

benchmark();
