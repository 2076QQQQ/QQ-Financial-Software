/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // ❌ 之前的可能写法 (导致后端接收不到 /api 前缀):
        // destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/:path*`,

        // ✅ 正确写法 (必须在 destination 里显式加上 /api):
        // 因为你的 server.ts 里的路由是写死带 /api 的 (如 app.get('/api/user/me'))
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;