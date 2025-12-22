import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'; 
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 定义接口 (确保与父组件一致)
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string; // 修改：放宽类型，因为后端可能有 'Owner' 或 '管理员'
  isAdmin: boolean;
  isOwner?: boolean;
  status: 'active' | 'pending' | 'invited';
}

interface EditMemberModalProps {
  open: boolean;
  onClose: () => void;
  // onSave 返回 Promise 用于处理 loading
  onSave: (memberId: string, updates: { role: string; isAdmin: boolean }) => Promise<void>;
  member: TeamMember | null;
  allMembers: TeamMember[];
}

export default function EditMemberModal({ open, onClose, onSave, member, allMembers }: EditMemberModalProps) {
  // 默认角色
  const [role, setRole] = useState<string>('会计');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (member) {
      // ✅ 优化逻辑：如果当前角色不在列表里（比如是 '管理员'），默认显示 'Boss' 或保持原样
      // 这样用户打开弹窗时，必须手动重新归类这个人的具体职位
      const validRoles = ['Boss', '会计', '出纳'];
      if (validRoles.includes(member.role)) {
          setRole(member.role);
      } else {
          // 如果是未知角色（如 '管理员'），默认切到 Boss，或者你可以留空让用户选
          setRole('Boss'); 
      }
      
      setIsAdmin(member.isAdmin);
      setError('');
    }
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!member) return;

    // 检查是否是最后一个管理员的降权操作
    if (member.isAdmin && !isAdmin) {
      const adminCount = allMembers.filter(m => m.isAdmin).length;
      if (adminCount <= 1) {
        setError('操作失败。系统必须保留至少一名管理员。');
        return;
      }
    }

    setLoading(true);
    
    try {
      await onSave(member.id, { role: role as any, isAdmin });
      onClose();
    } catch (err) {
      console.error(err);
      setError('保存失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!member) return null;

  // 如果是Owner，不允许编辑
  if (member.isOwner) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>无法编辑超级管理员</DialogTitle>
            <DialogDescription>
              {member.name || member.email} 是公司的创建者（超级管理员），无法被编辑或删除。
              <br/>如需移交权限，请使用“转让所有权”功能。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑成员</DialogTitle>
          <DialogDescription>
            修改 {member.name || member.email} 的业务角色和系统权限
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-1">成员邮箱</p>
            <p className="text-gray-900 font-medium">{member.email}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">业务角色</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Boss">
                  <div className="flex flex-col text-left">
                    <span className="font-medium">Boss / 管理层</span>
                    <span className="text-xs text-gray-500">仅审核和查看报表</span>
                  </div>
                </SelectItem>
                <SelectItem value="会计">
                  <div className="flex flex-col text-left">
                    <span className="font-medium">会计</span>
                    <span className="text-xs text-gray-500">凭证录入、报表、审核</span>
                  </div>
                </SelectItem>
                <SelectItem value="出纳">
                  <div className="flex flex-col text-left">
                    <span className="font-medium">出纳</span>
                    <span className="text-xs text-gray-500">日记账管理、资金流水</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            <Label>系统权限</Label>
            <div className="flex items-start gap-3 p-3 border rounded-md bg-gray-50/50">
              <Checkbox
                id="admin-edit"
                checked={isAdmin}
                onCheckedChange={(checked) => {
                  setIsAdmin(checked as boolean);
                  if (error) setError('');
                }}
                className="mt-1"
              />
              <div>
                <Label htmlFor="admin-edit" className="cursor-pointer font-medium block mb-1">
                  授予管理员权限 (Admin)
                </Label>
                <p className="text-xs text-gray-500 leading-tight">
                  管理员可以邀请/删除成员，修改公司设置，但无法转让公司所有权。
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存更改'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}