/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // 优先使用环境变量中的后端地址，如果没有（比如在本地）则用 localhost
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    
    // 确保去掉可能存在的末尾斜杠，避免拼接出 //api
    const dest = backendUrl.endsWith('/api') ? backendUrl : `${backendUrl}/api`;

    return [
      {
        source: '/api/:path*',
        destination: `${dest}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;