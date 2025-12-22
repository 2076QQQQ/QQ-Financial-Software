import { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; 

import { Search, Download, Plus, Edit, Copy, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  getFundAccounts,
  getInternalTransfers,
  addInternalTransfer,
  updateInternalTransfer,
  deleteInternalTransfer,
  addVoucher,
  getAllVouchers,
  getFundSummaryReport, 
  type FundAccount,
  type InternalTransfer as InternalTransferType,
} from '@/lib/mockData';
import * as XLSX from 'xlsx';

const inputClass = "bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors";

export default function InternalTransfer() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = Array.isArray(bookId) ? bookId[0] : (bookId || '');

  // 筛选条件
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    return {
      dateFrom: firstDay,
      dateTo: today,
      summary: ''
    };
  });
  
  // 数据状态
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  const [transfers, setTransfers] = useState<InternalTransferType[]>([]);
  
  // 选择状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 对话框状态
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<InternalTransferType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InternalTransferType | null>(null);
  const [voucherGenerationDialogOpen, setVoucherGenerationDialogOpen] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState<Partial<InternalTransferType>>({
    date: new Date().toISOString().split('T')[0],
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    remark: '' 
  });
  
  // 1. 初始加载账户和数据
  useEffect(() => {
    if (!router.isReady || !currentBookId) return;

    const initData = async () => {
      try {
        const accs = await getFundAccounts(currentBookId);
        
        if (Array.isArray(accs)) {
          // ★★★ 核心修复：只保留当前账套的资金账户 ★★★
          const filteredAccs = accs.filter((a: any) => a.accountBookId === currentBookId);
          setAccounts(filteredAccs);
        } else {
          setAccounts([]); 
        }
        
        await handleQuery();
      } catch (error) {
        console.error("初始化数据失败", error);
      }
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, currentBookId]); 
  
  // 2. 查询数据
  const handleQuery = async () => {
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
    if (!currentBookId) return;

    setLoading(true);
    try {
      const results = await getInternalTransfers(
        currentBookId,
        filters.dateFrom,
        filters.dateTo,
        filters.summary
      );
      if (Array.isArray(results)) {
        // ★★★ 核心修复：再次过滤结果，确保不显示别的账套数据 ★★★
        const filteredTransfers = results.filter((t: any) => t.accountBookId === currentBookId);
        setTransfers(filteredTransfers);
      } else {
        setTransfers([]);
      }
      setSelectedIds([]); 
    } catch (error) {
      console.error("查询失败", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableIds = transfers
        .filter(t => !t.voucherCode)
        .map(t => t.id);
      setSelectedIds(selectableIds);
    } else {
      setSelectedIds([]);
    }
  };
  
  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };
  
  const handleAdd = () => {
    setEditTarget(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      fromAccountId: '',
      toAccountId: '',
      amount: 0,
      remark: ''
    });
    setShowModal(true);
  };
  
  const handleEdit = (transfer: InternalTransferType) => {
    if (transfer.voucherCode) {
      alert('该转账单已生成凭证，无法编辑');
      return;
    }
    setEditTarget(transfer);
    setFormData({
      date: transfer.date,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: transfer.amount,
      remark: transfer.remark
    });
    setShowModal(true);
  };
  
  const handleCopy = (transfer: InternalTransferType) => {
    setEditTarget(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: 0,
      remark: transfer.remark
    });
    setShowModal(true);
    
    setTimeout(() => {
      const amountInput = document.querySelector<HTMLInputElement>('input[name="amount"]');
      if (amountInput) {
        amountInput.focus();
        amountInput.select();
      }
    }, 100);
  };
  
  const handleDelete = (transfer: InternalTransferType) => {
    if (transfer.voucherCode) {
      alert('该转账单已生成凭证，无法删除');
      return;
    }
    setDeleteTarget(transfer);
  };
  
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInternalTransfer(deleteTarget.id);
      setDeleteTarget(null);
      handleQuery();
    } catch (error) {
      console.error(error);
      alert('删除失败');
    }
  };
  
  // 4. 保存 (修复余额校验)
  const handleSave = async () => {
    if (!currentBookId) return alert('账套信息缺失，请重新进入');
    
    if (!formData.date) return alert('请选择记账日期');
    if (!formData.remark?.trim()) return alert('请输入摘要（必填）');
    if (!formData.fromAccountId) return alert('请选择转出账户');
    if (!formData.toAccountId) return alert('请选择转入账户');
    if (formData.fromAccountId === formData.toAccountId) return alert('转入和转出账户不能相同');
    if (!formData.amount || formData.amount <= 0) return alert('请输入有效的转账金额');
    
    const fromAccount = accounts.find(a => a.id === formData.fromAccountId);
    const toAccount = accounts.find(a => a.id === formData.toAccountId);
    
    if (!fromAccount || !toAccount) return alert('账户信息异常');

    // 余额预警逻辑
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const report = await getFundSummaryReport(currentBookId, '2000-01-01', todayStr);
        
        const targetAccountSummary = report.accountSummaries.find((a: any) => a.accountId === fromAccount.id);
        const currentBalance = targetAccountSummary ? targetAccountSummary.endingBalance : 0;
        const transferAmount = Number(formData.amount);

        if (currentBalance < transferAmount) {
            const confirm = window.confirm(
                `⚠️ 余额预警\n\n` +
                `转出账户：${fromAccount.accountName}\n` +
                `当前可用余额：${currentBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}\n` +
                `本次转出金额：${transferAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}\n\n` +
                `转出后余额将不足（${(currentBalance - transferAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}）。\n` +
                `是否确认继续？`
            );
            if (!confirm) return;
        }
    } catch (error) {
        console.warn("余额检查失败，跳过检查", error);
    }

    try {
      const payload: Omit<InternalTransferType, 'id'> = {
        date: formData.date,
        fromAccountId: formData.fromAccountId,
        fromAccountName: fromAccount.accountName,
        toAccountId: formData.toAccountId,
        toAccountName: toAccount.accountName,
        amount: formData.amount,
        remark: formData.remark,
        voucherCode: editTarget?.voucherCode,
        accountBookId: currentBookId // ★★★ 核心修复：确保保存时带入账套ID
      } as any;

      if (editTarget) {
        await updateInternalTransfer(editTarget.id, payload);
      } else {
        await addInternalTransfer(payload, currentBookId);
      }
      
      setShowModal(false);
      handleQuery();
    } catch (error) {
      console.error(error);
      alert('保存失败');
    }
  };

  const handleExport = () => {
    if (transfers.length === 0) {
      alert("当前列表无数据可供导出");
      return;
    }

    const rows: (string | number)[][] = [
      ["记账日期", "摘要", "转出账户", "转入账户", "金额", "记账凭证号"]
    ];

    transfers.forEach(t => {
      rows.push([
        t.date,
        t.remark || '-',
        t.fromAccountName,
        t.toAccountName,
        t.amount, 
        t.voucherCode || '-'
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 15 }, 
      { wch: 35 }, 
      { wch: 20 }, 
      { wch: 20 }, 
      { wch: 15 }, 
      { wch: 15 }, 
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "内部转账记录");
    const fileName = `内部转账清单_${filters.dateFrom}_至_${filters.dateTo}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // ... (凭证生成逻辑保持不变) ...
  const handleBatchGenerateVouchers = () => {
    if (selectedIds.length === 0) {
        alert('请先选择需要生成凭证的记录');
        return;
    }
    setVoucherGenerationDialogOpen(true);
  };
  
  const confirmGenerateVouchers = async () => {
    if (!currentBookId) return;

    const validTransfers = transfers.filter(t => 
      selectedIds.includes(t.id) && !t.voucherCode
    );
    
    if (validTransfers.length === 0) {
        alert('没有符合条件的转账记录可以生成凭证（需未生成凭证且已选中）');
        return;
    }
    
    try {
      const allVouchers = await getAllVouchers(currentBookId);
      let maxVoucherNumber = 0;
      
      if (Array.isArray(allVouchers)) {
        allVouchers.forEach((v: any) => {
          if (v.voucherType === '转') {
            const num = parseInt(v.voucherNumber);
            if (!isNaN(num) && num > maxVoucherNumber) {
              maxVoucherNumber = num;
            }
          }
        });
      }
      
      for (let index = 0; index < validTransfers.length; index++) {
        const transfer = validTransfers[index];
        const fromAccount = accounts.find(a => a.id === transfer.fromAccountId);
        const toAccount = accounts.find(a => a.id === transfer.toAccountId);
        
        if (!fromAccount || !toAccount) continue;
        
        const voucherNumber = String(maxVoucherNumber + index + 1).padStart(3, '0');
        const voucherCode = `转-${voucherNumber}`;
        
        const voucher = {
          id: `v${Date.now()}-${index}`,
          voucherDate: transfer.date,
          voucherType: '转',
          voucherNumber: voucherNumber,
          voucherCode: voucherCode,
          attachments: 0,
          lines: [
            {
              id: `l${Date.now()}-${index}-1`,
              summary: transfer.remark || '内部转账',
              subjectId: toAccount.relatedSubjectId || 'unknown',
              subjectCode: toAccount.relatedSubjectCode || '',
              subjectName: toAccount.relatedSubjectName || toAccount.accountName,
              auxiliary: toAccount.relatedAuxiliaryName || null,
              debitAmount: transfer.amount.toFixed(2),
              creditAmount: ''
            },
            {
              id: `l${Date.now()}-${index}-2`,
              summary: transfer.remark || '内部转账',
              subjectId: fromAccount.relatedSubjectId || 'unknown',
              subjectCode: fromAccount.relatedSubjectCode || '',
              subjectName: fromAccount.relatedSubjectName || fromAccount.accountName,
              auxiliary: fromAccount.relatedAuxiliaryName || null,
              debitAmount: '',
              creditAmount: transfer.amount.toFixed(2)
            }
          ],
          debitTotal: transfer.amount,
          creditTotal: transfer.amount,
          status: 'draft',
          maker: '系统自动', 
          isExpanded: false,
          createdAt: new Date().toLocaleString('zh-CN'),
          updatedAt: new Date().toLocaleString('zh-CN')
        };
        
        await addVoucher(voucher, currentBookId);
        
        await updateInternalTransfer(transfer.id, {
          voucherCode: voucherCode
        });
      }
      
      setVoucherGenerationDialogOpen(false);
      setSelectedIds([]);
      handleQuery();
      
      alert(`成功生成 ${validTransfers.length} 张凭证！`);
    } catch (error) {
      console.error(error);
      alert('生成凭证失败');
    }
  };
  
  const selectableCount = transfers.filter(t => !t.voucherCode).length;
  const allSelected = selectableCount > 0 && selectedIds.length === selectableCount;
  
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* 这里的 JSX 代码完全保持不变，核心改动在上面数据加载逻辑 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">内部转账</h1>
        <p className="text-gray-600">
          处理公司内部账户间的资金划拨，一次录入自动生成两账户流水
        </p>
      </div>
      
      {/* 筛选区 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>日期区间（起）</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>日期区间（止）</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="col-span-3 space-y-2">
            <Label>摘要</Label>
            <Input
              placeholder="输入摘要查询"
              value={filters.summary}
              onChange={(e) => setFilters({ ...filters, summary: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="col-span-5 space-y-2">
            <Label className="invisible">操作</Label>
            <div className="flex items-center gap-2">
              <Button onClick={() => handleQuery()} className="flex-1" disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? '查询中...' : '查询'}
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                <Plus className="w-4 h-4 mr-2" />
                新增
              </Button>
              <Button 
                variant="default" 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleBatchGenerateVouchers}
              >
                <FileText className="w-4 h-4 mr-2" />
                生成凭证 ({selectedIds.length})
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 数据表格 */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[120px]">记账日期</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>转出账户</TableHead>
                <TableHead>转入账户</TableHead>
                <TableHead className="text-right w-[140px]">金额</TableHead>
                <TableHead className="text-center w-[120px]">记账凭证号</TableHead>
                <TableHead className="text-center w-[140px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    {loading ? '加载中...' : '暂无数据，请点击"查询"或"新增"'}
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map(transfer => {
                  const isLocked = !!transfer.voucherCode;
                  const isSelected = selectedIds.includes(transfer.id);
                  
                  return (
                    <TableRow key={transfer.id} className={isLocked ? 'bg-gray-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectOne(transfer.id, checked as boolean)}
                          disabled={isLocked}
                        />
                      </TableCell>
                      <TableCell>{transfer.date}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate" title={transfer.remark || '-'}>
                          {transfer.remark || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{transfer.fromAccountName}</TableCell>
                      <TableCell>{transfer.toAccountName}</TableCell>
                      <TableCell className="text-right text-orange-600">
                        ¥ {transfer.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        {transfer.voucherCode ? (
                          <span className="text-blue-600">{transfer.voucherCode}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(transfer)}
                            disabled={isLocked}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(transfer)}
                            className="h-7 w-7 p-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(transfer)}
                            disabled={isLocked}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* 新增/编辑对话框 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editTarget ? '编辑内部转账' : '新增内部转账'}</DialogTitle>
            <DialogDescription>
              一次录入自动在两个账户的日记账中分别记账
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>记账日期 <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={inputClass}
              />
            </div>
            
            <div className="space-y-2">
              <Label>摘要 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="请输入摘要（必填）"
                value={formData.remark || ''}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                autoFocus
                className={inputClass}
              />
            </div>
            
            <div className="space-y-2">
              <Label>转出账户 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.fromAccountId || 'none'}
                onValueChange={(value) => {
                    const newVal = value === 'none' ? '' : value;
                    setFormData(prev => ({ 
                        ...prev, 
                        fromAccountId: newVal,
                        toAccountId: prev.toAccountId === newVal ? '' : prev.toAccountId
                    }));
                }}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="请选择转出账户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择</SelectItem>
                  {accounts && Array.isArray(accounts) && accounts
                    .filter(acc => acc.id !== formData.toAccountId)
                    .map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>转入账户 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.toAccountId || 'none'}
                onValueChange={(value) => {
                    const newVal = value === 'none' ? '' : value;
                    setFormData(prev => ({ 
                        ...prev, 
                        toAccountId: newVal,
                        fromAccountId: prev.fromAccountId === newVal ? '' : prev.fromAccountId
                    }));
                }}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="请选择转入账户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择</SelectItem>
                  {accounts && Array.isArray(accounts) && accounts
                    .filter(acc => acc.id !== formData.fromAccountId)
                    .map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>金额 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                name="amount"
                step="0.01"
                placeholder="0.00"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除这条内部转账记录吗？此操作不可逆。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 生成凭证确认对话框 */}
      <AlertDialog
        open={voucherGenerationDialogOpen}
        onOpenChange={setVoucherGenerationDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量生成凭证</AlertDialogTitle>
            <AlertDialogDescription>
              您已选择 {selectedIds.length} 条内部转账记录，确认为它们生成凭证吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGenerateVouchers}>
              确认生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}