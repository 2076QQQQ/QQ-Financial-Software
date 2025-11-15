import { useState, useEffect } from 'react';
import { Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';    
import { resetVerify, resetConfirm } from '@/lib/api/auth';
import { useRouter } from 'next/router';

interface SetNewPasswordProps {
  onSuccess: () => void;
}

export default function SetNewPassword({ onSuccess }: SetNewPasswordProps) {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token') || '';
      setToken(t);
      try {
        const info = await resetVerify(t);
        setEmail(info.email || '');
        setTokenValid(true);
      } catch {
        setTokenValid(false);
      }
    };
    run();
  }, []);

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
      await resetConfirm(token, newPassword);
      if (email) {
        router.push(`/auth/LoginPassword?email=${encodeURIComponent(email)}`);
      } else {
        router.push('/auth/LoginEntry');
      }
    } catch {
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
            此邀请链接已失效或已过期。请联系您的管理员重新发送邀请。
          </p>
          <Button onClick={onSuccess}>返回登录</Button>
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
