import { useState } from 'react';
import { Loader2, Crown, AlertCircle } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Alert, AlertDescription } from '../../components/ui/alert';    

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Boss' | '会计' | '出纳';
  isAdmin: boolean;
  isOwner?: boolean;
  status: 'active' | 'pending';
}

interface TransferOwnerModalProps {
  open: boolean;
  onClose: () => void;
  onTransfer: (newOwnerId: string) => void;
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

  // 只显示已激活的管理员（排除当前Owner）
  const eligibleMembers = allMembers.filter(
    m => m.id !== currentOwner.id && m.status === 'active' && m.isAdmin
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMemberId) return;

    setLoading(true);
    
    // 模拟转让
    setTimeout(() => {
      setLoading(false);
      onTransfer(selectedMemberId);
      setSelectedMemberId('');
      onClose();
    }, 1000);
  };

  const handleClose = () => {
    setSelectedMemberId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-600" />
            转让超级管理员身份
          </DialogTitle>
          <DialogDescription>
            将超级管理员（Owner）身份转让给团队中的其他管理员
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            转让后，您将失去超级管理员权限，但仍保留普通管理员权限。此操作不可逆。
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          {eligibleMembers.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                暂无可转让的对象。只有已激活的管理员才能接受转让。
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-owner">选择新的超级管理员</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择团队成员" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div>
                          <p>{member.name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">当前超级管理员：</span>{currentOwner.name}
                </p>
                <p className="text-sm text-gray-500">{currentOwner.email}</p>
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedMemberId || eligibleMembers.length === 0}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  转让中...
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4 mr-2" />
                  确认转让
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
