import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
// ✅ 优化路径
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// ✅ 引用 API (需要在 mockData.ts 中补全)
import { resetVerify, resetConfirm } from '@/lib/mockData';

interface SetNewPasswordProps {
  onSuccess?: () => void;
}

export default function SetNewPassword({ onSuccess }: SetNewPasswordProps) {
  const router = useRouter();
  // 兼容两种获取方式：query 或者 window.location
  const token = (router.query.token as string) || '';
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');

  // 1. 页面加载时校验 Token
  useEffect(() => {
    if (!router.isReady) return; // 等待路由就绪
    const t = (router.query.token as string);
    
    if (!t) {
        setTokenValid(false);
        return;
    }

    const run = async () => {
      try {
        const info = await resetVerify(t);
        setEmail(info.email || '');
        setTokenValid(true);
      } catch (e) {
        console.error("Token 无效", e);
        setTokenValid(false);
      }
    };
    run();
  }, [router.isReady, router.query.token]);

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { label: '', color: '' };
    if (pwd.length < 8) return { label: '弱', color: 'text-red-600' };
    if (pwd.length < 12 || !/\d/.test(pwd) || !/[a-zA-Z]/.test(pwd)) {
      return { label: '中', color: 'text-yellow-600' };
    }
    return { label: '强', color: 'text-green-600' };
  };

  const strength = getPasswordStrength(newPassword);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (newPassword.length < 8) newErrors.newPassword = '密码至少8位';
    if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      newErrors.newPassword = '密码必须包含字母和数字';
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      // ✅ 2. 提交新密码
      await resetConfirm(token, newPassword);
      
      // 3. 跳转逻辑优化
      if (email) {
        // 如果知道邮箱，直接跳去输密码
        router.push(`/auth/LoginPassword?email=${encodeURIComponent(email)}`);
      } else {
        // 否则跳回入口
        router.push('/auth/LoginEntry');
      }
    } catch (e) {
      console.error(e);
      // 这里可以加个 toast 提示
      setLoading(false);
    }
  };

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-gray-900 mb-3">链接已失效</h1>
          <p className="text-gray-600 mb-6">
            此重置链接已失效或已过期。请重新发起密码重置请求。
          </p>
          <Button onClick={() => router.push('/auth/ResetPassword')}>返回重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 mb-2">设置您的新密码</h1>
          <p className="text-gray-600">请创建一个安全的新密码</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="至少8位，包含字母和数字"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.newPassword) {
                  const newErrors = { ...errors };
                  delete newErrors.newPassword;
                  setErrors(newErrors);
                }
              }}
              className={errors.newPassword ? 'border-red-500' : ''}
            />
            {newPassword && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">密码强度:</p>
                <p className={`text-sm ${strength.color}`}>{strength.label}</p>
              </div>
            )}
            {errors.newPassword && (
              <p className="text-sm text-red-600">{errors.newPassword}</p>
            )}
            <p className="text-sm text-gray-500">至少8位，包含字母和数字</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="再次输入新密码"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) {
                  const newErrors = { ...errors };
                  delete newErrors.confirmPassword;
                  setErrors(newErrors);
                }
              }}
              className={errors.confirmPassword ? 'border-red-500' : ''}
            />
            {confirmPassword && newPassword === confirmPassword && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm">密码匹配</p>
              </div>
            )}
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={loading || !newPassword || !confirmPassword}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '确认并登录'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}