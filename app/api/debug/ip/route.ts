
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();

        // Also try to get geolocation info
        let geoInfo = {};
        try {
            const geoResponse = await fetch(`https://ipapi.co/${data.ip}/json/`);
            geoInfo = await geoResponse.json();
        } catch (e) {
            // Ignore geo error
        }

        return NextResponse.json({
            ip: data.ip,
            provider: 'Railway (likely AWS or GCP)',
            geo: geoInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch IP' }, { status: 500 });
    }
}
