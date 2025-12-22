import { useState } from 'react';
import { Loader2, Crown, AlertCircle } from 'lucide-react';
// ✅ 优化 1: 使用 @ 别名引用
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 接口定义 (与父组件保持一致)
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string; // 放宽类型，兼容后端返回的 'Owner' | '管理员' | 'Boss' 等
  isAdmin: boolean;
  isOwner?: boolean;
  status: 'active' | 'pending' | 'invited';
}

interface TransferOwnerModalProps {
  open: boolean;
  onClose: () => void;
  // onTransfer 返回 Promise 以支持 loading 状态
  onTransfer: (newOwnerId: string) => Promise<void>;
  allMembers: TeamMember[];
  currentOwner: TeamMember;
}

export default function TransferOwnerModal({ 
  open, 
  onClose, 
  onTransfer, 
  allMembers,
  currentOwner 
}: TransferOwnerModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 筛选逻辑：排除自己，且必须是已激活的成员
  const eligibleMembers = allMembers.filter(
    m => m.id !== currentOwner.id && m.status === 'active'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;

    // 二次确认 (虽然 UI 上已有提示，但这是一个危险操作，多加一层 confirm 更安全)
    const targetMember = eligibleMembers.find(m => m.id === selectedMemberId);
    if (!window.confirm(`⚠️ 高风险操作确认：\n\n您确定要将公司所有权转让给 "${targetMember?.name || targetMember?.email}" 吗？\n\n转让后您将立即失去最高权限。`)) {
        return;
    }

    setLoading(true);
    setError('');

    try {
      await onTransfer(selectedMemberId);
      setSelectedMemberId('');
      // 注意：成功后通常会强制刷新页面，所以这里不需要手动 onClose
    } catch (err: any) {
      console.error(err);
      setError(err.message || '转让失败，请稍后重试');
      setLoading(false); // 失败时才取消 loading
    }
  };

  const handleClose = () => {
    if (loading) return; // 转让过程中禁止关闭
    setSelectedMemberId('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Crown className="w-5 h-5" />
            转让超级管理员身份
          </DialogTitle>
          <DialogDescription>
            将超级管理员（Owner）身份转让给团队中的其他成员。
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <strong>警告：</strong> 转让后，您将<span className="underline">立即失去</span>超级管理员权限，并自动降级为普通管理员。此操作不可撤销。
          </AlertDescription>
        </Alert>
        
        {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          
          {/* 当前所有者展示 */}
          <div className="space-y-1">
             <Label className="text-xs text-gray-500">当前所有者</Label>
             <div className="p-3 bg-gray-100 rounded-md font-medium text-gray-700 flex justify-between items-center">
                <span>{currentOwner.name || '我'}</span>
                <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">Owner</span>
             </div>
          </div>

          {eligibleMembers.length === 0 ? (
            <div className="py-6 text-center text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed">
                <p>暂无符合条件的成员。</p>
                <p className="text-xs mt-1">只有状态为“已激活”的成员才能接受转让。</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="new-owner">选择新所有者</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="请选择..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex flex-col items-start py-1">
                        <span className="font-medium text-gray-900">{member.name}</span>
                        <span className="text-xs text-gray-500">{member.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedMemberId || eligibleMembers.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  正在转让...
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4 mr-2" />
                  确认转让权限
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}