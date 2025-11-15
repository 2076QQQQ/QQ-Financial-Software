import { useState, useEffect } from 'react';
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
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Boss' | '会计' | '出纳';
  isAdmin: boolean;
  isOwner?: boolean;
  status: 'active' | 'pending';
}

interface EditMemberModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (memberId: string, updates: { role: 'Boss' | '会计' | '出纳'; isAdmin: boolean }) => void;
  member: TeamMember | null;
  allMembers: TeamMember[];
}

export default function EditMemberModal({ open, onClose, onSave, member, allMembers }: EditMemberModalProps) {
  const [role, setRole] = useState<'Boss' | '会计' | '出纳'>('会计');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (member) {
      setRole(member.role);
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
    
    // 模拟保存
    setTimeout(() => {
      setLoading(false);
      onSave(member.id, { role, isAdmin });
      onClose();
    }, 500);
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
              {member.name} 是公司的创建者（超级管理员），无法被编辑或删除。
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
            修改 {member.name} 的业务角色和系统权限
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-1">成员邮箱</p>
            <p className="text-gray-900">{member.email}</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">业务角色</Label>
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
            <Label>系统权限</Label>
            <div className="flex items-start gap-2">
              <Checkbox
                id="admin-edit"
                checked={isAdmin}
                onCheckedChange={(checked) => {
                  setIsAdmin(checked as boolean);
                  if (error) setError('');
                }}
              />
              <div>
                <Label htmlFor="admin-edit" className="cursor-pointer">
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
            <Button type="submit" disabled={loading}>
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
