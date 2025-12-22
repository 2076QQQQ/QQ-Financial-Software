import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
// ✅ 优化 1: 使用 @ 别名引用 UI 组件，防止路径错误
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Checkbox } from '@/components/ui/checkbox'; // 暂时移除，见下方说明
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 引入 API
import { inviteMember } from '@/lib/mockData';
// 如果没有安装 sonner，可以用 alert 代替，或者 npm install sonner
import { toast } from 'sonner'; 

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: () => void; // 修改：不需要传参数，直接通知父组件刷新即可
  existingEmails: string[];
}

export default function InviteMemberModal({ open, onClose, onInvite, existingEmails }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState(''); // 后端目前暂不存邀请人的姓名，但前端可以保留输入框
  const [role, setRole] = useState<'Boss' | '会计' | '出纳'>('会计');
  // const [isAdmin, setIsAdmin] = useState(false); // 暂时移除：邀请阶段暂不支持直接设为管理员
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

    if (existingEmails.includes(email)) {
      setError('该邮箱已在您的团队中，无法重复邀请。');
      return;
    }

    setLoading(true);
    
    try {
            // ✅ 调用 API，并获取返回值
      const res: any = await inviteMember(email, role, name);
      
      // ★★★ 核心修改：检查后端是否返回了 manualLink ★★★
      if (res.manualLink) {
        // 情况 A：邮件发送失败，但后端生成了链接
        // 使用 window.prompt 让用户方便复制
        window.prompt(
          `邀请已生成，但因网络原因邮件发送超时。\n请手动复制下方链接发给成员：`, 
          res.manualLink
        );
        // 虽然邮件没发出去，但邀请记录有了，所以视为流程完成
        onInvite(); 
        handleClose();
      } else {
        // 情况 B：邮件发送成功
        toast.success(`已向 ${email} 发送邀请邮件`);
        onInvite();
        handleClose();
      }

    } catch (err: any) {
      console.error("邀请失败:", err);
      setError(err.message || "邀请发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setRole('会计');
    // setIsAdmin(false);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>邀请新成员</DialogTitle>
          <DialogDescription>
            发送邮件邀请成员加入。成员点击邮件链接后即可激活账户。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {error && (
             <Alert variant="destructive" className="py-2">
               <AlertCircle className="h-4 w-4" />
               <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">电子邮箱 <span className="text-red-500">*</span></Label>
            <Input
              id="email"
              type="email"
              placeholder="member@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              className={error ? 'border-red-500' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">姓名 <span className="text-gray-500">(可选)</span></Label>
            <Input
              id="name"
              placeholder="例如：李四"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-[10px] text-gray-400">仅用于备注，实际姓名以用户注册时为准</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">分配角色 <span className="text-red-500">*</span></Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Boss">Boss(全权处理)</SelectItem>
                <SelectItem value="会计">会计 (全权处理)</SelectItem>
                <SelectItem value="出纳">出纳 (资金流水)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 注释说明：
             暂时隐藏了“授予管理员”选项，因为后端 /invite 接口目前只接收 role。
             如果需要管理员权限，可以在成员加入后，通过“编辑成员”功能进行提权。
          */}
          {/* <div className="space-y-2">
            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="admin"
                checked={isAdmin}
                onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
              />
              <div>
                <Label htmlFor="admin" className="cursor-pointer">同时授予管理员权限</Label>
                <p className="text-xs text-gray-500">可邀请/删除其他成员</p>
              </div>
            </div>
          </div> 
          */}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !email}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  发送中...
                </>
              ) : (
                '发送邀请'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}