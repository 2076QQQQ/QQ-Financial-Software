import { useState, useEffect } from 'react';
import { Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';  
import { activateInfo, activate } from '@/lib/api/auth';
import { useRouter } from 'next/router';

export default function ActivateAccount() {
  const router = useRouter();
  const token = (router.query.token as string) || '';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const [inviteData, setInviteData] = useState({
    email: 'invited@company.com',
    companyName: 'XX商贸有限公司',
    role: '会计' as '会计' | '出纳' | 'Boss',
    invitedBy: '张三'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const run = async () => {
      try {
        const info = await activateInfo(token);
        setTokenValid(true);
        setInviteData({ email: info.email, companyName: info.companyName, role: info.role, invitedBy: info.isAdmin ? '管理员' : '' });
      } catch {
        setTokenValid(false);
      }
    };
    run();
  }, [token]);

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { label: '', color: '' };
    if (pwd.length < 8) return { label: '弱', color: 'text-red-600' };
    if (pwd.length < 12 || !/\d/.test(pwd) || !/[a-zA-Z]/.test(pwd)) {
      return { label: '中', color: 'text-yellow-600' };
    }
    return { label: '强', color: 'text-green-600' };
  };

  const strength = getPasswordStrength(password);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = '请输入您的姓名';
    if (password.length < 8) newErrors.password = '密码至少8位';
    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      newErrors.password = '密码必须包含字母和数字';
    }
    if (password !== confirmPassword) {
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
      await activate(token, name, password);
      router.push('/Dashboard/Dashboard');
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
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Boss': return 'bg-purple-100 text-purple-700';
      case '会计': return 'bg-blue-100 text-blue-700';
      case '出纳': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 mb-2">欢迎加入 {inviteData.companyName} 团队！</h1>
          <p className="text-gray-600">仅需一步即可激活您的账户</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900 mb-2">
            <span className="font-medium">{inviteData.invitedBy}</span> 已邀请您加入
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-blue-900">您的角色是：</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getRoleBadgeColor(inviteData.role)}`}>
              {inviteData.role}
            </span>
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">您的邮箱</p>
          <p className="text-gray-900">{inviteData.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">您的姓名 *</Label>
            <Input
              id="name"
              placeholder="例如：李四"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  const newErrors = { ...errors };
                  delete newErrors.name;
                  setErrors(newErrors);
                }
              }}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">设置密码 *</Label>
            <Input
              id="password"
              type="password"
              placeholder="至少8位，包含字母和数字"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  const newErrors = { ...errors };
                  delete newErrors.password;
                  setErrors(newErrors);
                }
              }}
              className={errors.password ? 'border-red-500' : ''}
            />
            {password && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">密码强度:</p>
                <p className={`text-sm ${strength.color}`}>{strength.label}</p>
              </div>
            )}
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password}</p>
            )}
            <p className="text-sm text-gray-500">至少8位，包含字母和数字</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码 *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="再次输入密码"
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
            {confirmPassword && password === confirmPassword && (
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
            disabled={loading || !name || !password || !confirmPassword}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                激活中...
              </>
            ) : (
              '激活并进入系统'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
