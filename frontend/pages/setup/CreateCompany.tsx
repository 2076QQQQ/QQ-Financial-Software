import { useState } from 'react';
import { useRouter } from 'next/router';
import { Building2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
// ✅ 优化路径
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
// ✅ 引用 API (需要你在 mockData.ts 中补全)
import { registerCompany } from '@/lib/mockData';

export default function CreateCompany() {
  const router = useRouter();
  const email = (router.query.email as string) || '';
  
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!companyName.trim()) newErrors.companyName = '请输入公司名称';
    if (password.length < 8) newErrors.password = '密码至少8位';
    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      newErrors.password = '密码必须包含字母和数字';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }
    if (!agreedToTerms) {
      newErrors.terms = '请阅读并同意服务条款';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const formData = {
            email,
            name,
            companyName,
            password,
        };
      // ✅ 真实调用后端注册
      await registerCompany(formData);
      
      // 注册成功后，跳转到 Dashboard (或引导页)
      // 注意：后端 registerCompany 接口应该会设置 Set-Cookie，所以前端可以直接跳
      router.push('/app/dashboard'); 
      // 或者如果你的首页做了重定向判断
      // router.push('/'); 
    } catch (error: any) {
      console.error("注册失败", error);
      // 可以解析 error.message 显示具体错误（如邮箱已存在）
      alert(error.message || '注册失败，请稍后重试');
      setLoading(false);
    }
  };

  const isFormValid = name && companyName && password && confirmPassword && agreedToTerms;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 mb-2">创建您的公司账户</h1>
          <p className="text-gray-600">欢迎！仅需一步即可开始</p>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">账户邮箱</p>
              <p className="text-gray-900">{email}</p>
            </div>
            <button 
              type="button" 
              onClick={() => router.push('/auth/LoginEntry')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              返回修改
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">您的姓名 <span className="text-red-500">*</span></Label>
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
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">公司/团队名称 <span className="text-red-500">*</span></Label>
            <Input
              id="companyName"
              placeholder="例如：XX商贸有限公司"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (errors.companyName) {
                   const newErrors = { ...errors };
                   delete newErrors.companyName;
                   setErrors(newErrors);
                }
              }}
              className={errors.companyName ? 'border-red-500' : ''}
            />
            {errors.companyName && <p className="text-sm text-red-600">{errors.companyName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">设置密码 <span className="text-red-500">*</span></Label>
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
            {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
            <p className="text-xs text-gray-500">至少8位，包含字母和数字</p>
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
              className={errors.confirmPassword ? 'border-red-500' : ''}
            />
            {confirmPassword && password === confirmPassword && (
                <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>密码一致</span>
                </div>
            )}
            {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => {
                  setAgreedToTerms(checked as boolean);
                  if (errors.terms) {
                    const newErrors = { ...errors };
                    delete newErrors.terms;
                    setErrors(newErrors);
                  }
                }}
              />
              <Label htmlFor="terms" className="cursor-pointer text-sm leading-none pt-0.5">
                我已阅读并同意{' '}
                <a href="#" className="text-blue-600 hover:underline">服务条款</a>
                {' '}和{' '}
                <a href="#" className="text-blue-600 hover:underline">隐私政策</a>
              </Label>
            </div>
            {errors.terms && <p className="text-sm text-red-600 pl-6">{errors.terms}</p>}
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={!isFormValid || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              '创建账户并进入系统'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}