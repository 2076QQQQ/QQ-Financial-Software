import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
// ✅ 使用别名路径
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';   
// ✅ 引用刚刚补全的 mockData
import { activateInfo, activate } from '@/lib/mockData';

export default function ActivateAccount() {
  const router = useRouter();
  const token = (router.query.token as string) || '';
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(true); // 默认 true，加载失败变 false
  
  const [inviteData, setInviteData] = useState({
    email: 'loading...', // 初始占位
    companyName: '加载中...',
    role: '会计' as '会计' | '出纳' | 'Boss',
    invitedBy: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;

    const fetchInfo = async () => {
      try {
        const info = await activateInfo(token);
        setInviteData({ 
            email: info.email, 
            companyName: info.companyName, 
            role: info.role, 
            invitedBy: info.inviterName || '管理员' 
        });
        setTokenValid(true);
      } catch (e) {
        console.error("激活链接无效:", e);
        setTokenValid(false);
      }
    };
    fetchInfo();
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
      // 激活成功后，跳转到登录页或直接进入 Dashboard（取决于后端是否直接下发 cookie）
      // 这里假设需要重新登录，或者直接去首页
      router.push('/login'); 
    } catch (e) {
      console.error(e);
      // 可以在这里加个 toast 提示失败
      setLoading(false);
    }
  };

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-md text-center bg-white p-8 rounded-lg shadow-sm border">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">链接已失效</h1>
          <p className="text-gray-600 mb-6">
            此邀请链接已失效或已过期。请联系您的管理员重新发送邀请。
          </p>
          <Button onClick={() => router.push('/login')} variant="outline">返回登录</Button>
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4 shadow-blue-200 shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">欢迎加入 {inviteData.companyName}</h1>
          <p className="text-sm text-gray-500">完善信息以激活您的账户</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900 mb-2">
            <span className="font-medium">{inviteData.invitedBy}</span> 邀请您加入团队
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-blue-900">分配角色：</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(inviteData.role)}`}>
              {inviteData.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
             <Label className="text-gray-500 text-xs">受邀邮箱</Label>
             <div className="text-gray-900 font-medium px-3 py-2 bg-gray-100 rounded-md text-sm border border-gray-200">
                {inviteData.email}
             </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">您的真实姓名 <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              placeholder="例如：张三"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  const newErrors = { ...errors };
                  delete newErrors.name;
                  setErrors(newErrors);
                }
              }}
              className={errors.name ? 'border-red-500 focus-visible:ring-red-200' : ''}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">设置登录密码 <span className="text-red-500">*</span></Label>
            <Input
              id="password"
              type="password"
              placeholder="8位以上，含字母和数字"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  const newErrors = { ...errors };
                  delete newErrors.password;
                  setErrors(newErrors);
                }
              }}
              className={errors.password ? 'border-red-500 focus-visible:ring-red-200' : ''}
            />
            {password && (
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-300 ${
                            strength.label === '强' ? 'w-full bg-green-500' : 
                            strength.label === '中' ? 'w-2/3 bg-yellow-500' : 'w-1/3 bg-red-500'
                        }`} 
                    />
                </div>
                <span className={`text-xs ${strength.color}`}>{strength.label}</span>
              </div>
            )}
            {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码 <span className="text-red-500">*</span></Label>
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
              className={errors.confirmPassword ? 'border-red-500 focus-visible:ring-red-200' : ''}
            />
            {confirmPassword && password === confirmPassword && (
              <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>密码一致</span>
              </div>
            )}
            {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword}</p>}
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
            disabled={loading || !name || !password || !confirmPassword}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在激活账户...
              </>
            ) : (
              '激活并登录'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}