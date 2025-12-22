import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/router';

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
}

export default function VoucherManagement() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
  
  const { canAudit, loading: permLoading } = usePermission();

  // --- 状态定义 ---
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Voucher | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);

  // 账套配置状态：默认开启审核
  const [bookConfig, setBookConfig] = useState({ reviewEnabled: true });

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
            }
        } catch (e) {
            console.error("获取账套配置失败", e);
        }
    };
    if (router.isReady && currentBookId) {
        fetchSettings();
    }
  }, [router.isReady, currentBookId]);

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
    const selected = vouchers.filter(v => selectedIds.includes(v.id));
    if (selected.length === 0) return false;
    
    // 如果免审核：允许删除所有选中的
    if (!bookConfig.reviewEnabled) return true;

    // 如果需审核：只能删除未审核的
    return selected.every(v => v.status === 'draft');
  };

  // 批量操作处理
  const handleBatchApprove = async () => {
    const targets = vouchers.filter(v => selectedIds.includes(v.id) && v.status === 'draft');
    const updates = targets.map(v => ({
      ...v,
      status: 'approved',
      reviewer: '当前用户', 
      updatedAt: new Date().toLocaleString('zh-CN')
    }));
    await batchUpdateVouchers(updates);
    await loadVouchers();
    setSelectedIds([]);
  };

  const handleBatchUnapprove = async () => {
    const targets = vouchers.filter(v => selectedIds.includes(v.id) && v.status === 'approved');
    const updates = targets.map(v => ({
      ...v,
      status: 'draft',
      reviewer: undefined, 
      updatedAt: new Date().toLocaleString('zh-CN')
    }));
    await batchUpdateVouchers(updates);
    await loadVouchers();
    setSelectedIds([]);
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
    await auditVoucher(voucher.id, '当前用户');
    await loadVouchers();
  };

  const handleUnapprove = async (voucher: Voucher) => {
    await unauditVoucher(voucher.id);
    await loadVouchers();
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
          viewMode={viewMode}
          onSave={async (data) => {
            if (!currentBookId) { alert("未找到账套信息"); return; }
            try {
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