
import { chromium } from 'playwright';

async function testProxyLogic() {
    const proxyscrapeKey = 'vn749rumajtux39jxyhe';
    console.log('Testing ProxyScrape integration...');

    try {
        const apiUrl = `https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all&key=${proxyscrapeKey}`;
        const response = await fetch(apiUrl);
        const text = await response.text();
        const proxies = text.split('\n').map(p => p.trim()).filter(Boolean);

        console.log(`Fetched ${proxies.length} proxies.`);

        if (proxies.length > 0) {
            const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
            const proxyServer = `http://${randomProxy}`;
            console.log(`Selected random proxy: ${proxyServer}`);

            console.log('Attempting to connect via proxy...');
            const browser = await chromium.launch({
                headless: true,
                proxy: { server: proxyServer }
            });

            const page = await browser.newPage();
            try {
                await page.goto('http://example.com', { timeout: 10000 });
                console.log('Successfully navigated to example.com via proxy!');
            } catch (e: any) {
                console.log('Navigation failed (expected for some public proxies):', e.message?.split('\n')[0]);
            }
            await browser.close();
        } else {
            console.error('No proxies found!');
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testProxyLogic();
