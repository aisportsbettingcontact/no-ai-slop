/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the workspace design system so its "use client" boundary and CSS
  // are processed by Next rather than treated as an opaque external package.
  transpilePackages: ['@nas/ui'],
  eslint: {
    // The repo-level ESLint config governs lint; Next's page-level lint is a
    // duplicate gate we run separately in CI.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
