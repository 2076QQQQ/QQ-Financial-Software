import { useState } from 'react';
import { Building2, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { resetRequest } from '@/lib/api/auth';

import { useRouter } from 'next/router';

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
      await resetRequest(email);
      router.push(`/auth/ResetPasswordSent?email=${encodeURIComponent(email)}`);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.push('/auth/LoginEntry')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 mb-2">重置密码</h1>
          <p className="text-gray-600">输入您的注册邮箱，我们将发送重置链接</p>
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
            className="w-full"
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
