import { useState } from 'react';
import { useRouter } from 'next/router';
import { Building2, Loader2, AlertCircle } from 'lucide-react';
// ✅ 优化：使用 @ 别名路径
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';    
// ✅ 引用刚刚补全的 mockData
import { login } from '@/lib/mockData';

export default function LoginPassword() {
  const router = useRouter();
  const email = (router.query.email as string) || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLocked) {
      setError('尝试次数过多，请15分钟后再试，或重置您的密码。');
      return;
    }
    
    setLoading(true);
    
    try {
      // ✅ 真实调用后端 API
      const result = await login(email, password);
      
      // 登录成功后，跳转到 Dashboard
      // 注意：这里需要确保 Dashboard 页面会调用 /api/user/me 来获取当前账套信息
      // 如果后端没返回默认账套ID，前端可能需要先调一下 me() 获取
      
      router.push('/app/dashboard'); // 假设这是你的仪表盘入口路由，或者根据实际情况调整
      // router.push('/Dashboard/Dashboard'); // 你之前的路径，如果文件结构是这样也行

    } catch (err: any) {
      setLoading(false);
      console.error("登录失败:", err);

      // 简单的错误处理逻辑
      // 如果后端返回了特定的锁定状态，可以处理。这里做通用处理。
      if (err?.message?.includes('locked') || attemptCount >= 4) {
        setIsLocked(true);
        setError('尝试次数过多，账户已暂时锁定。请稍后再试。');
        return;
      }
      
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      setError('您输入的邮箱或密码不正确。');
      setPassword(''); // 清空密码框
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 mb-2">欢迎回来！</h1>
          <p className="text-gray-600">请输入您的密码</p>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">登录邮箱</p>
              <p className="text-gray-900">{email || '未提供邮箱'}</p>
            </div>
            <button 
              onClick={() => router.push('/login')} // 假设 LoginEntry 路由是 /login
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              更换账户
            </button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label htmlFor="password">密码</Label>
                <button
                    type="button"
                    onClick={() => router.push('/auth/ResetPassword')} // 假设重置密码路由
                    className="text-xs text-blue-600 hover:text-blue-700"
                >
                    忘记密码？
                </button>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="请输入您的密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error && !isLocked) setError('');
              }}
              disabled={isLocked}
              className={error ? 'border-red-500' : ''}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={loading || !password || isLocked}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                验证中...
              </>
            ) : (
              '登录'
            )}
          </Button>
        </form>

        {attemptCount > 0 && attemptCount < 5 && !isLocked && (
          <p className="mt-4 text-sm text-center text-gray-500">
            剩余尝试次数: {5 - attemptCount}
          </p>
        )}
      </div>
    </div>
  );
}