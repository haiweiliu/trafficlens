/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright needs to run in Node.js environment
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

