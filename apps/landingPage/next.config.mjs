/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/First2Fetch' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/First2Fetch' : '',
};

export default nextConfig;
