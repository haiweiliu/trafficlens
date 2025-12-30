/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright needs to run in Node.js environment
  serverExternalPackages: ['playwright', 'playwright-core'],
  // Ensure Playwright browsers are included in deployment
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'playwright-core'],
  },
}

module.exports = nextConfig

