import { useState, useEffect } from 'react';
import { UserPlus, Mail, Crown, Edit, Trash2, Loader2, RefreshCw, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import InviteMemberModal from './InviteMemberModal'; 
import EditMemberModal, { TeamMember } from './EditMemberModal'; 
import TransferOwnerModal from './TransferOwnerModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { getTeamMembers, updateTeamMember, removeTeamMember, resendInvitation, transferOwner, me } from '@/lib/mockData';
import { toast } from 'sonner';

// ✅ 引入权限 Hook
import { usePermission } from '@/lib/hooks/usePermission';

interface Member extends TeamMember {
  status: 'active' | 'invited' | 'pending';
  joinedAt?: string;
  isOwner?: boolean; 
}

export default function TeamManagement() {
  // ✅ 1. 使用权限 Hook
  const { canManageTeam, canTransferOwner } = usePermission();
  
  // 状态
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>(''); // 存自己的ID，用于判断“不能删自己”
  
  const [currentOwner, setCurrentOwner] = useState<Member | undefined>(undefined);

  // 弹窗状态
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersData, meData] = await Promise.all([
          getTeamMembers(),
          me()
      ]);

      setMembers(membersData || []);
      
      const owner = membersData.find((m: any) => m.role === 'Owner' || m.isOwner);
      setCurrentOwner(owner);

      if (meData?.user) {
          setCurrentUserId(meData.user.id);
      }

    } catch (error) {
      console.error(error);
      toast.error("加载成员列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'Owner': return 'default';
      case 'Boss': return 'default';
      case '会计': return 'secondary';
      case '出纳': return 'outline';
      default: return 'outline';
    }
  };

  const handleEditMember = (member: Member) => {
    setEditTarget(member);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (memberId: string, updates: { role: any; isAdmin: boolean }) => {
    try {
      await updateTeamMember(memberId, updates);
      toast.success("成员权限已更新");
      loadData(); 
    } catch (e) {
      console.error(e);
      throw e; 
    }
  };

  const handleDeleteMember = async (member: Member) => {
    try {
      await removeTeamMember(member.id);
      toast.success(member.status === 'active' ? "成员已移除" : "邀请已撤销");
      setDeleteTarget(null);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "操作失败");
    }
  };

  const handleResendInvite = async (member: Member) => {
    try {
      await resendInvitation(member.id);
      toast.success(`已重新发送邀请给 ${member.email}`);
    } catch (e) {
      toast.error("发送失败");
    }
  };

  const handleTransferOwner = async (newOwnerId: string) => {
    try {
      await transferOwner(newOwnerId);
      toast.success("所有权转让成功，您已降级为管理员");
      setShowTransferModal(false);
      window.location.reload(); 
    } catch (e) {
      toast.error("转让失败，请稍后重试");
    }
  };

  const activeCount = members.filter(m => m.status === 'active').length;
  const totalSeats = 5; 

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">团队成员管理</h1>
            <p className="text-gray-600 text-sm">管理您的团队成员、角色分配及系统权限</p>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" onClick={loadData} disabled={loading} size="icon" title="刷新">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
             </Button>
             
             {/* ✅ 权限控制：转让按钮 */}
             {canTransferOwner && (
                 <Button variant="secondary" onClick={() => setShowTransferModal(true)} className="text-amber-700 bg-amber-50 hover:bg-amber-100">
                    <Key className="w-4 h-4 mr-2"/>
                    转让所有权
                 </Button>
             )}

             {/* ✅ 权限控制：邀请按钮 */}
             {canManageTeam && (
               <Button onClick={() => setShowInviteModal(true)} className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  邀请新成员
               </Button>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-900">
              已使用 <span className="font-medium">{activeCount}/{totalSeats}</span> 个席位
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

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead>姓名/邮箱</TableHead>
              <TableHead>业务角色</TableHead>
              <TableHead>系统权限</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                        <div className="flex justify-center items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin"/>
                            正在加载团队数据...
                        </div>
                    </TableCell>
                </TableRow>
            ) : members.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-500">暂无成员</TableCell>
                </TableRow>
            ) : members.map((member) => {
              // ✅ 判断是不是我自己
              const isMe = currentUserId === member.id;
              // ✅ 判断对方是不是Owner
              const isTargetOwner = member.role === 'Owner' || member.isOwner;

              return (
              <TableRow key={member.id} className="hover:bg-gray-50">
                <TableCell>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{member.name || member.email.split('@')[0]}</p>
                      {(member.role === 'Owner' || member.isOwner) && (
                        <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <span><Crown className="w-3.5 h-3.5 text-yellow-600" /></span>
                            </TooltipTrigger>
                            <TooltipContent><p>超级管理员</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      )}
                      {isMe && <span className="text-xs bg-gray-100 px-1.5 rounded text-gray-500">我</span>}
                    </div>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(member.role) as any} className="font-normal">
                    {member.role === 'Owner' ? '负责人' : member.role}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  {member.role === 'Owner' ? (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 font-normal">Owner</Badge>
                  ) : member.isAdmin ? (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 font-normal">管理员</Badge>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </TableCell>
                
                <TableCell>
                  {member.status === 'active' ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-normal">已激活</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-normal">
                        {member.status === 'invited' ? '邀请中' : '待激活'}
                    </Badge>
                  )}
                </TableCell>
                
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    
                    {/* ✅ 逻辑：有管理权 && 不是自己 && 对方不是Owner */}
                    {canManageTeam && !isMe && !isTargetOwner ? (
                      <>
                        {/* 活跃成员：编辑/移除 */}
                        {member.status === 'active' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEditMember(member)} className="h-8 px-2 text-gray-600 hover:text-blue-600">
                              <Edit className="w-4 h-4 mr-1" /> 编辑
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(member)} className="h-8 px-2 text-gray-600 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4 mr-1" /> 移除
                            </Button>
                          </>
                        )}

                        {/* 邀请中：重发/撤销 */}
                        {(member.status === 'invited' || member.status === 'pending') && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleResendInvite(member)} className="h-8 px-2 text-blue-600 hover:bg-blue-50">
                              <Mail className="w-4 h-4 mr-1" /> 重发
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(member)} className="h-8 px-2 text-gray-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      // 无权操作的占位
                      <span className="text-gray-300 text-xs px-2 select-none">--</span>
                    )}
                    
                  </div>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>

      <InviteMemberModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={loadData} 
        existingEmails={members.map(m => m.email)}
      />

      <EditMemberModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
        member={editTarget}
        allMembers={members}
      />

      {currentOwner && showTransferModal && (
        <TransferOwnerModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onTransfer={handleTransferOwner}
        allMembers={members as any[]} 
        currentOwner={currentOwner as any}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认操作</AlertDialogTitle>
            <AlertDialogDescription>
               {deleteTarget?.status === 'active' 
                 ? `您确定要移除成员 "${deleteTarget.name || deleteTarget.email}" 吗？移除后他将无法访问公司账套。`
                 : `您确定要撤销对 "${deleteTarget?.email}" 的邀请吗？邀请链接将失效。`
               }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDeleteMember(deleteTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              确认{deleteTarget?.status === 'active' ? '移除' : '撤销'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}