import { useState } from 'react';
import { useRouter } from 'next/router';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ✅ 1. 定义后端基础地址
// 优先读取 Vercel 环境变量，如果没有则使用本地调试地址
// 注意：环境变量末尾已经包含了 "/api"
const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export default function LoginEntry() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setLoading(true);

    try {
      // ✅ 2. 拼接完整 URL
      // baseUrl 已经是 ".../api"，所以这里只需要接 "/auth/check-email"
      // 最终结果类似: https://qq-financial...onrender.com/api/auth/check-email
      const targetUrl = `${baseUrl}/auth/check-email`;
      
      console.log('正在请求:', targetUrl); // 方便调试查看真实请求地址

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status}`);
      }

      const data = await response.json();

      if (data.exists) {
        // 场景二: 公司已存在的员工 -> 去输入密码
        router.push(`/auth/LoginPassword?email=${encodeURIComponent(email)}`);
      } else {
        // 场景一: 公司第一个人 -> 去创建新公司
        router.push(`/setup/CreateCompany?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      console.error(err);
      setError('检查邮箱时出错，请确保后端服务已启动。');
      setLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 mb-2">登录您的财务中心</h1>
          <p className="text-gray-600">使用工作邮箱继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">工作电子邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={handleEmailChange}
              className={error ? 'border-red-500' : ''}
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                处理中...
              </> 
            ) : (
              '继续'
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t text-center space-x-4 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-700">服务条款</a>
          <span>·</span>
          <a href="#" className="hover:text-gray-700">隐私政策</a>
        </div>
      </div>
    </div>
  );
}