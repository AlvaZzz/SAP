/** @type {import('next').NextConfig} */
// Proxy /api → API NestJS, para que la cookie httpOnly funcione sin CORS.
const API = process.env.API_URL || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
};

module.exports = nextConfig;
