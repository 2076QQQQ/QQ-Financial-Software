import { useState } from 'react';
import { UserPlus, Mail, Crown, Edit, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import InviteMemberModal from '../../pages/team/InviteMemberModal';
import EditMemberModal from '../../pages/team/EditMemberModal';
import TransferOwnerModal from '../../pages/team/TransferOwnerModal';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Boss' | '会计' | '出纳';
  isAdmin: boolean;
  isOwner?: boolean;
  status: 'active' | 'pending';
}

interface TeamManagementProps {
  currentUserId?: string;
}

export default function TeamManagement({ currentUserId = '1' }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: '当前用户',
      email: 'owner@company.com',
      role: 'Boss',
      isAdmin: true,
      isOwner: true,
      status: 'active'
    }
  ]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const currentUser = members.find(m => m.id === currentUserId);
  const currentOwner = members.find(m => m.isOwner);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'Boss': return 'default';
      case '会计': return 'secondary';
      case '出纳': return 'outline';
      default: return 'outline';
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditTarget(member);
    setShowEditModal(true);
  };

  const handleSaveEdit = (memberId: string, updates: { role: 'Boss' | '会计' | '出纳'; isAdmin: boolean }) => {
    setMembers(members.map(m => 
      m.id === memberId 
        ? { ...m, role: updates.role, isAdmin: updates.isAdmin }
        : m
    ));
    setShowEditModal(false);
    setEditTarget(null);
  };

  const handleDeleteMember = (member: TeamMember) => {
    // 检查是否是Owner
    if (member.isOwner) {
      setErrorMessage('操作失败。超级管理员（公司创建者）无法被删除。');
      setTimeout(() => setErrorMessage(''), 3000);
      setDeleteTarget(null);
      return;
    }

    // 检查是否是最后一个管理员
    const adminCount = members.filter(m => m.isAdmin).length;
    if (member.isAdmin && adminCount <= 1) {
      setErrorMessage('操作失败。系统必须保留至少一名管理员。');
      setTimeout(() => setErrorMessage(''), 3000);
      setDeleteTarget(null);
      return;
    }

    setMembers(members.filter(m => m.id !== member.id));
    setDeleteTarget(null);
  };

  const handleResendInvite = (member: TeamMember) => {
    // 模拟重新发送邀请
    console.log('重新发送邀请给:', member.email);
    // 可以添加成功提示
    alert(`已重新发送邀请到 ${member.email}`);
  };

  const handleInviteMember = (data: any) => {
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: data.name || '待激活用户',
      email: data.email,
      role: data.role,
      isAdmin: data.isAdmin,
      isOwner: false,
      status: 'pending'
    };
    setMembers([...members, newMember]);
    setShowInviteModal(false);
  };

  const handleTransferOwner = (newOwnerId: string) => {
    setMembers(members.map(m => ({
      ...m,
      isOwner: m.id === newOwnerId
    })));
    setShowTransferModal(false);
  };

  const activeMembers = members.filter(m => m.status === 'active').length;
  const totalSeats = 10;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-gray-900 mb-1">团队成员管理</h1>
            <p className="text-gray-600">管理您的团队成员和权限</p>
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            邀请新成员
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-900">
              已使用 <span className="font-medium">{activeMembers}/{totalSeats}</span> 个席位
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-900">
              带 <Crown className="w-3 h-3 inline text-yellow-600" /> 标识的是超级管理员，拥有最高权限
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-red-900">{errorMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名/邮箱</TableHead>
              <TableHead>业务角色</TableHead>
              <TableHead>系统权限</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      {member.isOwner && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Crown className="w-4 h-4 text-yellow-600" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>超级管理员（公司创建者）</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.isAdmin ? (
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">管理员</Badge>
                  ) : (
                    <Badge variant="outline">成员</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {member.status === 'active' ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已激活</Badge>
                  ) : (
                    <Badge variant="secondary">待激活</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Owner本人：显示转让按钮 */}
                    {member.isOwner && currentUser?.isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTransferModal(true)}
                      >
                        <Crown className="w-4 h-4 mr-1" />
                        转让
                      </Button>
                    )}

                    {/* 非Owner且已激活且不是自己：显示编辑和删除 */}
                    {!member.isOwner && member.status === 'active' && member.id !== currentUserId && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMember(member)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          编辑权限
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(member)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          删除
                        </Button>
                      </>
                    )}

                    {/* 未激活：显示重新发送邀请和删除 */}
                    {member.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvite(member)}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          重新发送邀请
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(member)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          删除
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InviteMemberModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteMember}
        existingEmails={members.map(m => m.email)}
      />

      <EditMemberModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
        member={editTarget}
        allMembers={members}
      />

      {currentOwner && (
        <TransferOwnerModal
          open={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          onTransfer={handleTransferOwner}
          allMembers={members}
          currentOwner={currentOwner}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要移除 <span className="font-medium">{deleteTarget?.name}</span> 吗？此操作不可逆。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDeleteMember(deleteTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
