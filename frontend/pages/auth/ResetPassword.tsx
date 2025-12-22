import { useState } from 'react';
import { useRouter } from 'next/router';
import { Building2, Loader2, ArrowLeft } from 'lucide-react';
// ✅ 优化：使用 @ 别名路径
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// ✅ 修正：指向 mockData.ts
import { resetRequest } from '@/lib/mockData';

export default function ResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      // 调用后端发送重置邮件接口
      await resetRequest(email);
      // 跳转到发送成功页 (需要你自己创建 ResetPasswordSent 页面)
      router.push(`/auth/ResetPasswordSent?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      // 出于安全考虑，通常即使邮箱不存在也不报错，或者提示模糊信息
      // 这里为了演示方便，如果出错(如网络问题)则停止 loading
      console.error(err);
      setLoading(false);
      // 可选：setError('发送失败，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.push('/login')} // 假设登录页路由是 /login
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4 shadow-lg shadow-blue-100">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">重置密码</h1>
          <p className="text-gray-600 text-sm">输入您的注册邮箱，我们将发送重置链接</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">您的注册邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              className={error ? 'border-red-500' : ''}
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                发送中...
              </>
            ) : (
              '发送重置链接'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}