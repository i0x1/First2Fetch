/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/First2Fetch',
  assetPrefix: '/First2Fetch/',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
