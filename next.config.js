/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright needs to run in Node.js environment
  serverExternalPackages: ['playwright'],
}

module.exports = nextConfig

