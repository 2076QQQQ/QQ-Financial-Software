import { Building2, CheckCircle2, Mail } from 'lucide-react';
// ✅ 优化：使用 @ 别名路径
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';

export default function ResetPasswordSent() {
  const router = useRouter();
  const email = (router.query.email as string) || '';
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        
        <h1 className="text-gray-900 mb-3">请检查您的收件箱</h1>
        
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700 mb-2">
            我们已向 <span className="font-medium">{email}</span> 发送了一封重置邮件
          </p>
          <p className="text-gray-600 text-sm">
            请点击邮件中的链接设置新密码
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            ⏱️ 链接将在 <span className="font-medium">1小时</span> 内有效
          </p>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          没有收到邮件？请检查垃圾邮件文件夹，或等待几分钟后重试
        </p>

        <Button variant="outline" className="w-full" onClick={() => router.push('/auth/LoginEntry')}>
          返回登录
        </Button>
      </div>
    </div>
  );
}