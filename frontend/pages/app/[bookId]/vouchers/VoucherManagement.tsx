import { useState, useEffect, Fragment,useRef } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { Plus, Edit, Copy, Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';     
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import VoucherEntry from './VoucherEntry';
import { 
  getAllVouchers, 
  addVoucher, 
  updateVoucher, 
  deleteVoucher,
  batchUpdateVouchers,
  auditVoucher,   
  unauditVoucher,
  me,
  getAccountBooks // 确保引入了获取账套信息的API
} from '@/lib/mockData';

import { usePermission } from '@/lib/hooks/usePermission';

interface VoucherLine {
  id: string;
  summary: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  auxiliary?: string;
  debitAmount: string;
  creditAmount: string;
}

interface Voucher {
  id: string;
  voucherDate: string;
  voucherType: string;
  voucherNumber: string;
  voucherCode: string;
  attachments: number;
  lines: VoucherLine[];
  debitTotal: number;
  creditTotal: number;
  status: 'draft' | 'approved';
  maker: string;
  reviewer?: string;
  isExpanded?: boolean;
  createdAt: string;
  updatedAt: string;
  accountBookId: string; // 确保有这个字段
  latestOperation?: string;
}

export default function VoucherManagement() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
  const [isProcessing, setIsProcessing] = useState(false);
  const { canAudit, loading: permLoading } = usePermission();

  // --- 状态定义 ---
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Voucher | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);
  const [lastClosedPeriod, setLastClosedPeriod] = useState<string>('');

  // 账套配置状态：默认开启审核
  const [bookConfig, setBookConfig] = useState({ reviewEnabled: true });
  const [currentUserName, setCurrentUserName] = useState('未知用户');

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const [filters, setFilters] = useState({
    dateFrom: firstDayOfMonth.toISOString().split('T')[0],
    dateTo: lastDayOfMonth.toISOString().split('T')[0],
    status: 'all',
    voucherCode: ''
  });

  // --- 1. 获取账套配置 (是否免审核) ---
  useEffect(() => {
    const fetchSettings = async () => {
        if (!currentBookId) return;
        try {
            const books = await getAccountBooks();
            const currentBook = (books || []).find((b: any) => b.id === currentBookId);
            if (currentBook) {
                // 如果 review_enabled 为 false，则不需要审核
                setBookConfig({ reviewEnabled: currentBook.review_enabled !== false });
                setLastClosedPeriod(currentBook.lastClosedPeriod || '');
            }
        } catch (e) {
            console.error("获取账套配置失败", e);
        }
    };
    if (router.isReady && currentBookId) {
        fetchSettings();
    }
  }, [router.isReady, currentBookId]);
  useEffect(() => {
    const initUserData = async () => {
      try {
        const userData = await me();
        if (userData?.user?.name) {
          setCurrentUserName(userData.user.name); // ✅ 获取真实姓名
        }
      } catch (e) {
        console.error("获取用户信息失败", e);
      }
    };
    initUserData();
  }, []);
  // --- 2. 加载凭证列表 ---
  const loadVouchers = async () => {
    if (!currentBookId) return;
    try {
      const allVouchers = await getAllVouchers(currentBookId); 
      // 过滤当前账套
      const filtered = (allVouchers || []).filter((v: any) => v.accountBookId === currentBookId);
      // 排序：日期倒序，凭证号倒序
      filtered.sort((a: any, b: any) => {
          if (a.voucherDate !== b.voucherDate) return b.voucherDate.localeCompare(a.voucherDate);
          return b.voucherCode.localeCompare(a.voucherCode);
      });
      
      const sanitized = filtered.map((v: any) => ({
        ...v,
        isExpanded: false 
      }));
      setVouchers(sanitized);
    } catch (error) {
      console.error("加载凭证失败", error);
    }
  };

  useEffect(() => {
    if (router.isReady && currentBookId) {
        loadVouchers();
    }
  }, [router.isReady, currentBookId]);

  // --- 交互逻辑 ---

  const toggleExpand = (voucherId: string) => {
    setVouchers(vouchers.map(v =>
      v.id === voucherId ? { ...v, isExpanded: !v.isExpanded } : v
    ));
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchDate = v.voucherDate >= filters.dateFrom && v.voucherDate <= filters.dateTo;
    const matchStatus = filters.status === 'all' || 
                       (filters.status === 'draft' && v.status === 'draft') ||
                       (filters.status === 'approved' && v.status === 'approved');
    const matchCode = !filters.voucherCode || v.voucherCode.includes(filters.voucherCode);
    return matchDate && matchStatus && matchCode;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVouchers.length && filteredVouchers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVouchers.map(v => v.id));
    }
  };

  const toggleSelect = (voucherId: string) => {
    if (selectedIds.includes(voucherId)) {
      setSelectedIds(selectedIds.filter(id => id !== voucherId));
    } else {
      setSelectedIds([...selectedIds, voucherId]);
    }
  };

  // 批量操作权限判断
  const canApprove = () => {
    if (!canAudit) return false;
    // 只有在开启审核功能时，这个按钮才有意义
    if (!bookConfig.reviewEnabled) return false;
    const selected = vouchers.filter(v => selectedIds.includes(v.id));
    return selected.length > 0 && selected.some(v => v.status === 'draft');
  };

  const canUnapprove = () => {
    if (!canAudit) return false;
    if (!bookConfig.reviewEnabled) return false;
    const selected = vouchers.filter(v => selectedIds.includes(v.id));
    return selected.length > 0 && selected.some(v => v.status === 'approved');
  };

  const canBatchDelete = () => {
    // 1. 如果没有选中任何项，肯定不能删
    const selected = vouchers.filter(v => selectedIds.includes(v.id));
    if (selected.length === 0) return false;

    // 2. 【BR2 扩展】结账保护：绝对禁止删除“已结账期间”的凭证
    // 只要选中项里有一张凭证属于已结账期间，就全都不许删
    const hasClosedPeriodVoucher = selected.some(v => {
        const voucherPeriod = v.voucherDate.substring(0, 7);
        return lastClosedPeriod && voucherPeriod <= lastClosedPeriod;
    });
    if (hasClosedPeriodVoucher) return false;

    // 3. 审核状态限制
    if (!bookConfig.reviewEnabled) {
        // 分支 A: 免审核模式
        // 只要没结账，什么状态（通常都是approved）都能删
        return true;
    } else {
        // 分支 B: 需审核模式
        // 必须所有选中的凭证都是 'draft' (未审核) 状态才能删
        // 已审核的必须先“反审核”才能删
        return selected.every(v => v.status === 'draft');
    }
};
  // 批量操作处理
  const handleBatchApprove = async () => {
    const targets = vouchers.filter(v => selectedIds.includes(v.id) && v.status === 'draft');
    const updates = targets.map(v => ({
      ...v,
      status: 'approved',
      reviewer: currentUserName,
      latestOperation: `${currentUserName} 批量审核`,
      updatedAt: new Date().toLocaleString('zh-CN')
    }));
    await batchUpdateVouchers(updates);
    await loadVouchers();
    setSelectedIds([]);
    toast.success(`成功审核 ${updates.length} 张凭证`);
  };

const handleBatchUnapprove = async () => {
    // 1. 筛选目标
    const targets = vouchers.filter(v => selectedIds.includes(v.id) && v.status === 'approved');
    
    // 2. 结账校验 (过滤掉已结账的)
    const validTargets = targets.filter(v => {
        const voucherPeriod = v.voucherDate.substring(0, 7);
        // 如果没有结账期间，或者凭证日期晚于结账期间，则允许
        return !lastClosedPeriod || voucherPeriod > lastClosedPeriod;
    });

    // 如果有被过滤掉的，提示一下
    if (validTargets.length < targets.length) {
        toast.warning(`${targets.length - validTargets.length} 张凭证因已结账无法反审核`);
    }

    if (validTargets.length === 0) return;

    // 3. 执行更新
    const updates = validTargets.map(v => ({
      ...v,
      status: 'draft',
      reviewer: '', // ✅ 清空审核人状态
      
      // ✅ 留下操作痕迹
      latestOperation: `[批量反审核] 操作人: ${currentUserName} 时间: ${new Date().toLocaleString('zh-CN')}`,
      
      updatedAt: new Date().toLocaleString('zh-CN')
    }));
    
    await batchUpdateVouchers(updates);
    await loadVouchers();
    setSelectedIds([]);
    toast.success(`成功反审核 ${updates.length} 张凭证`);
};

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 张凭证吗？`)) return;
    
    // 筛选出可删除的 ID
    let idsToDelete: string[] = [];
    if (!bookConfig.reviewEnabled) {
        idsToDelete = selectedIds; // 免审核：全删
    } else {
        idsToDelete = vouchers
            .filter(v => v.status === 'draft' && selectedIds.includes(v.id))
            .map(v => v.id);
    }

    if (idsToDelete.length === 0) {
        alert("选中的凭证均不可删除（已审核）。请先反审核。");
        return;
    }

    await Promise.all(idsToDelete.map(id => deleteVoucher(id)));
    await loadVouchers();
    setSelectedIds([]);
  };

  // 单个操作处理
  const handleAdd = () => {
    setEditTarget(null);
    setViewMode(false);
    setShowEntryModal(true);
  };

  const handleEdit = (voucher: Voucher) => {
    setEditTarget(voucher);
    setViewMode(false);
    setShowEntryModal(true);
  };

  const handleView = (voucher: Voucher) => {
    setEditTarget(voucher);
    setViewMode(true);
    setShowEntryModal(true);
  };

  const handleApprove = async (voucher: Voucher) => {
    // 构造操作日志
    const opLog = `${currentUserName} 审核`;
    
    // 调用 API (注意：这里你需要修改 mockData 的 auditVoucher 支持传更多参数，或者直接用 updateVoucher)
    // 建议直接用 updateVoucher 更灵活，或者修改 auditVoucher
    const updates = {
        ...voucher,
        status: 'approved',
        reviewer: currentUserName, // ✅ 写入真实姓名
        latestOperation: opLog,    // ✅ 写入操作日志
        updatedAt: new Date().toLocaleString('zh-CN')
    };
    
    // 这里假设 auditVoucher 只接受 ID 和 Name，如果不够用，建议直接调 updateVoucher
    // await auditVoucher(voucher.id, currentUserName); 
    // 改为通用更新：
    await updateVoucher(voucher.id, updates);
    
    await loadVouchers();
    toast.success("审核成功");
  };

  // 单个反审核 (包含 BR2 结账校验)
  const handleUnapprove = async (voucher: Voucher) => {
    // 1. 结账校验
    const voucherPeriod = voucher.voucherDate.substring(0, 7);
    if (lastClosedPeriod && voucherPeriod <= lastClosedPeriod) {
        toast.error(`期间 ${voucherPeriod} 已结账，禁止反审核！`);
        return;
    }

    // 2. 构造更新数据
    const updates = {
        ...voucher,
        status: 'draft',     // 状态回退为草稿
        reviewer: '',        // ✅ 正确：清空“当前审核人”，因为现在没人审核它
        
        // ✅ 核心修改：在操作日志里记下是谁反审核的
        latestOperation: `[反审核] 操作人: ${currentUserName} 时间: ${new Date().toLocaleString('zh-CN')}`,
        
        updatedAt: new Date().toLocaleString('zh-CN')
    };

    try {
        await updateVoucher(voucher.id, updates);
        await loadVouchers();
        toast.success("反审核成功");
    } catch (e) {
        toast.error("操作失败");
    }
};

  const handleDelete = async (voucher: Voucher) => {
    await deleteVoucher(voucher.id);
    setDeleteTarget(null);
    loadVouchers();
  };

  const getMainSubjects = (lines: VoucherLine[]) => {
    const debit = lines.find(l => l.debitAmount && parseFloat(l.debitAmount) > 0);
    const credit = lines.find(l => l.creditAmount && parseFloat(l.creditAmount) > 0);
    return {
      debit: debit ? `${debit.subjectCode} ${debit.subjectName}` : '',
      credit: credit ? `${credit.subjectCode} ${credit.subjectName}` : ''
    };
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1 text-2xl font-bold">凭证管理</h1>
        <p className="text-gray-600">查询、编辑、审核会计凭证</p>
      </div>

      <div className="bg-white rounded-lg border mb-4 p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label>记账日期（起）</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"/>
          </div>
          <div className="space-y-2">
            <Label>记账日期（止）</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"/>
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">未审核</SelectItem>
                <SelectItem value="approved">已审核</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>凭证字号</Label>
            <Input placeholder="如：记-001" value={filters.voucherCode} onChange={(e) => setFilters({ ...filters, voucherCode: e.target.value })} className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"/>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadVouchers}>查询</Button>
            <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />新增凭证</Button>
            
            {/* 仅在开启审核功能时显示批量审核/反审核 */}
            {bookConfig.reviewEnabled && (
                <>
                    <Button variant="outline" onClick={handleBatchApprove} disabled={!canApprove()} className={!canAudit ? "opacity-50 cursor-not-allowed" : ""}>
                    <CheckCircle className="w-4 h-4 mr-2" />审核
                    </Button>
                    <Button variant="outline" onClick={handleBatchUnapprove} disabled={permLoading || !canUnapprove()} className={!canAudit ? "opacity-50 cursor-not-allowed" : ""}>
                    <XCircle className="w-4 h-4 mr-2" />反审核
                    </Button>
                </>
            )}
            
            <Button variant="outline" onClick={handleBatchDelete} disabled={!canBatchDelete()} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-4 h-4 mr-2" />删除
            </Button>
          </div>
          <div className="text-sm text-gray-600">
            共 {filteredVouchers.length} 条凭证
            {selectedIds.length > 0 && ` / 已选 ${selectedIds.length} 条`}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[50px]"><Checkbox checked={selectedIds.length === filteredVouchers.length && filteredVouchers.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[110px]">记账日期</TableHead>
              <TableHead className="w-[100px]">凭证字号</TableHead>
              <TableHead className="w-[80px] text-center">附件</TableHead>
              <TableHead className="w-[200px]">摘要</TableHead>
              <TableHead className="w-[240px]">主要科目</TableHead>
              <TableHead className="w-[130px] text-right">借方合计</TableHead>
              <TableHead className="w-[130px] text-right">贷方合计</TableHead>
              <TableHead className="w-[90px]">状态</TableHead>
              <TableHead className="w-[90px]">制单人</TableHead>
              <TableHead className="w-[90px]">审核人</TableHead>
              <TableHead className="text-right w-[140px]">操作</TableHead> 
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVouchers.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="text-center text-gray-500 py-12">暂无数据</TableCell></TableRow>
            ) : (
              filteredVouchers.map((voucher) => {
                const subjects = getMainSubjects(voucher.lines);
                // 判断是否是系统生成的凭证
                const isSystemGenerated = voucher.maker === '系统自动';

                return (
                  <Fragment key={voucher.id}>
                    <TableRow  className={voucher.isExpanded ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                      <TableCell><Checkbox checked={selectedIds.includes(voucher.id)} onCheckedChange={() => toggleSelect(voucher.id)} /></TableCell>
                      <TableCell>
                        <button onClick={() => toggleExpand(voucher.id)} className="text-gray-500 hover:text-blue-600">
                          {voucher.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </TableCell>
                      <TableCell>{voucher.voucherDate}</TableCell>
                      <TableCell><button onClick={() => handleView(voucher)} className="text-blue-600 hover:underline font-medium">{voucher.voucherCode}</button></TableCell>
                      <TableCell className="text-center">{voucher.attachments > 0 && <span className="inline-flex items-center gap-1 text-gray-500"><FileText className="w-3 h-3" />{voucher.attachments}</span>}</TableCell>
                      <TableCell className="text-gray-600 truncate max-w-[200px]">{voucher.lines[0]?.summary || '-'}</TableCell>
                      <TableCell>
                        <div className="text-xs flex flex-col gap-1">
                          <div className="text-gray-900 truncate" title={subjects.debit}>借：{subjects.debit || '-'}</div>
                          <div className="text-gray-500 truncate" title={subjects.credit}>贷：{subjects.credit || '-'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{voucher.debitTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono">{voucher.creditTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                          <Badge variant={voucher.status === 'approved' ? 'default' : 'secondary'} className={voucher.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                              {voucher.status === 'approved' ? '已审核' : '未审核'}
                          </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{voucher.maker}</TableCell>
                      <TableCell className="text-sm text-gray-600">{voucher.reviewer || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          
                          {/* 1. 审核/反审核按钮 (仅在开启审核功能时显示) */}
                          {bookConfig.reviewEnabled && (
                              <>
                                {canAudit && voucher.status === 'draft' && (
                                    <Button variant="ghost" size="icon" onClick={() => handleApprove(voucher)} title="审核通过" className="h-8 w-8 text-green-600 hover:bg-green-50">
                                        <CheckCircle className="w-4 h-4" />
                                    </Button>
                                )}
                                {canAudit && voucher.status === 'approved' && (
                                    <Button variant="ghost" size="icon" onClick={() => handleUnapprove(voucher)} title="反审核" className="h-8 w-8 text-orange-600 hover:bg-orange-50">
                                        <XCircle className="w-4 h-4" />
                                    </Button>
                                )}
                              </>
                          )}

                          {/* 2. 编辑按钮 */}
                          {/* 
                             禁用条件：
                             A. 系统生成的 (maker === '系统自动') => 永远禁用
                             B. 开启了审核且已审核 (reviewEnabled && status === 'approved') => 禁用
                          */}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEdit(voucher)} 
                            disabled={isSystemGenerated || (bookConfig.reviewEnabled && voucher.status === 'approved')} 
                            className="h-8 w-8 text-gray-500 hover:text-blue-600"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          {/* 3. 删除按钮 */}
                          {/* 
                             禁用条件：
                             只有在 (开启了审核) 且 (已审核) 时才禁用
                             免审核模式下，任何凭证(包括系统的)都可以删
                          */}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteTarget(voucher)} 
                            disabled={bookConfig.reviewEnabled && voucher.status === 'approved'} 
                            className="h-8 w-8 text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {voucher.isExpanded && (
                      <TableRow>
                        <TableCell colSpan={13} className="bg-gray-50 p-0 shadow-inner">
                          <div className="px-12 py-3">
                            <Table>
                              <TableHeader><TableRow className="bg-gray-100/50"><TableHead className="h-8">摘要</TableHead><TableHead className="h-8">会计科目</TableHead><TableHead className="h-8">辅助核算</TableHead><TableHead className="h-8 text-right">借方</TableHead><TableHead className="h-8 text-right">贷方</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {voucher.lines.map((line) => (
                                  <TableRow key={line.id} className="border-b-0">
                                    <TableCell className="py-2">{line.summary}</TableCell>
                                    <TableCell className="py-2 font-mono text-blue-700">{line.subjectCode} <span className="text-gray-700 font-sans">{line.subjectName}</span></TableCell>
                                    <TableCell className="py-2 text-gray-500 text-sm">{line.auxiliary || '-'}</TableCell>
                                    <TableCell className="py-2 text-right font-mono">{line.debitAmount ? parseFloat(line.debitAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : ''}</TableCell>
                                    <TableCell className="py-2 text-right font-mono">{line.creditAmount ? parseFloat(line.creditAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : ''}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {showEntryModal && (
        <VoucherEntry
          open={showEntryModal}
          onClose={() => setShowEntryModal(false)}
          voucher={editTarget}
          forceDate={editTarget ? undefined : new Date().toISOString().split('T')[0]} 
          viewMode={viewMode}
          onSave={async (data) => {
            if (!currentBookId) { alert("未找到账套信息"); return; }
            if (isProcessing) return;
      
      // ✅ 2. 上锁
      setIsProcessing(true);
            try {
              const lockedDate = new Date().toISOString().split('T')[0];
              const dataToSave = { ...data, voucherDate: lockedDate };
              const lines = dataToSave.lines || [];
              
              // 1. 检查借方是否有资金科目 (1001/1002)
              const hasCashOrBankDebit = lines.some((l: any) => 
                  l.subjectCode && 
                  (l.subjectCode.startsWith('1001') || l.subjectCode.startsWith('1002')) && 
                  Number(l.debitAmount) > 0
              );

              // 2. 检查贷方是否有资金科目 (1001/1002)
              const hasCashOrBankCredit = lines.some((l: any) => 
                  l.subjectCode && 
                  (l.subjectCode.startsWith('1001') || l.subjectCode.startsWith('1002')) && 
                  Number(l.creditAmount) > 0
              );

              // 3. ★★★ 关键修复：检查是否包含“非资金”科目 ★★★
              // 如果凭证里出现了不是 1001 或 1002 的科目，说明这是复合业务（如：提现支付费用、收款等），应当允许。
              const hasOtherSubjects = lines.some((l: any) => 
                  l.subjectCode && 
                  !l.subjectCode.startsWith('1001') && 
                  !l.subjectCode.startsWith('1002') &&
                  (Number(l.debitAmount) > 0 || Number(l.creditAmount) > 0)
              );

              // 拦截条件：
              // (借方有资金) AND (贷方有资金) AND (没有其他非资金科目参与)
              if (hasCashOrBankDebit && hasCashOrBankCredit && !hasOtherSubjects) {
                  alert("❌ 操作禁止 (BR5)：\n\n检测到【纯粹】的现金与银行存款互转业务。\n\n请务必使用【资金管理 -> 内部转账】功能，或通过【出纳日记账】生成凭证，以保证资金流水的完整性。\n\n(注：如果是涉及费用、应收应付的混合业务，请确保已录入相关非资金科目)");
                  return; // 拦截
              }
              if (editTarget) {
                const updatedVoucher = { ...editTarget, ...data, updatedAt: new Date().toLocaleString('zh-CN') };
                await updateVoucher(editTarget.id, updatedVoucher);
              } else {
                // 如果是免审核，这里前端不需要做特殊处理，后端会根据账套配置自动设为 approved
                const newVoucher: any = { ...data, maker: '当前用户' };
                await addVoucher(newVoucher,currentBookId);
              }
              await loadVouchers();
              setShowEntryModal(false);
            } catch (e: any) {
              // 捕获后端的 403 错误（比如尝试修改系统凭证）
              alert(e.message || '保存失败');
            }finally {
        // ✅ 3. 无论成功失败，最后都要解锁
        setIsProcessing(false);
      }
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除</AlertDialogTitle><AlertDialogDescription>您确定要删除凭证 <span className="font-medium text-red-600">"{deleteTarget?.voucherCode}"</span> 吗？</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-red-600 hover:bg-red-700">确认删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}