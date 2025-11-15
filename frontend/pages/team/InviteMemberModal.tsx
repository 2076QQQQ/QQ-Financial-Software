import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (data: any) => void;
  existingEmails: string[];
}

export default function InviteMemberModal({ open, onClose, onInvite, existingEmails }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Boss' | '会计' | '出纳'>('会计');
  const [isAdmin, setIsAdmin] = useState(false);
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
    
    // 模拟发送邀请
    setTimeout(() => {
      setLoading(false);
      onInvite({ email, name, role, isAdmin });
      // 重置表单
      setEmail('');
      setName('');
      setRole('会计');
      setIsAdmin(false);
    }, 1000);
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setRole('会计');
    setIsAdmin(false);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>邀请新成员</DialogTitle>
          <DialogDescription>
            添加新成员到您的团队，并分配相应的角色和权限
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">电子邮箱 *</Label>
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
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">姓名 <span className="text-gray-500">(可选)</span></Label>
            <Input
              id="name"
              placeholder="例如：李四"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">设置业务角色 *</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Boss">
                  <div>
                    <p>Boss</p>
                    <p className="text-sm text-gray-500">仅审核和查看</p>
                  </div>
                </SelectItem>
                <SelectItem value="会计">
                  <div>
                    <p>会计</p>
                    <p className="text-sm text-gray-500">操作所有 + 审核</p>
                  </div>
                </SelectItem>
                <SelectItem value="出纳">
                  <div>
                    <p>出纳</p>
                    <p className="text-sm text-gray-500">操作所有，无审核</p>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>设置系统权限</Label>
            <div className="flex items-start gap-2">
              <Checkbox
                id="admin"
                checked={isAdmin}
                onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
              />
              <div>
                <Label htmlFor="admin" className="cursor-pointer">
                  授予管理员权限
                </Label>
                <p className="text-sm text-gray-500">
                  管理员可以邀请/删除成员，并管理公司设置
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
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
