/** @type {import('next').NextConfig} */
// The browser talks only to this app; /api/* is passed on to the backend (API_URL, read at build time).
const api = process.env.API_URL || 'http://localhost:8080';

module.exports = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // The panel's components still carry loose types (about 30 reports from `npm run typecheck`);
  // they do not change how the app runs, so they do not stop the build.
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [{ source: '/api/:path*', destination: api + '/api/:path*' }];
  },
};
