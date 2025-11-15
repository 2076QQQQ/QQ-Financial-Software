import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Copy, Trash2, FileText } from 'lucide-react';
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
  type FundAccount,
  type InternalTransfer as InternalTransferType,
} from '@/lib/mockData';

export default function InternalTransfer() {
  // 筛选条件
  const [filters, setFilters] = useState({
    dateFrom: '2025-01-01',
    dateTo: '2025-11-30',
    summary: '' // 摘要筛选
  });
  
  // 数据状态
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
    remark: '' // 摘要
  });
  
  // 加载数据
  useEffect(() => {
    setAccounts(getFundAccounts());
  }, []);
  
  // 查询数据
  const handleQuery = () => {
    const results = getInternalTransfers(
      filters.dateFrom,
      filters.dateTo,
      filters.summary
    );
    setTransfers(results);
    setSelectedIds([]); // 清空选择
  };
  
  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // 只选择未生成凭证的
      const selectableIds = transfers
        .filter(t => !t.voucherCode)
        .map(t => t.id);
      setSelectedIds(selectableIds);
    } else {
      setSelectedIds([]);
    }
  };
  
  // 单选
  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };
  
  // 新增
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
  
  // 编辑
  const handleEdit = (transfer: InternalTransferType) => {
    // BR5：数据锁定检查
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
  
  // 复制
  const handleCopy = (transfer: InternalTransferType) => {
    setEditTarget(null);
    setFormData({
      date: new Date().toISOString().split('T')[0], // 更新为今天
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: 0, // 清空金额，需要重新输入
      remark: transfer.remark
    });
    setShowModal(true);
    
    // 光标定位到金额字段
    setTimeout(() => {
      const amountInput = document.querySelector<HTMLInputElement>('input[name="amount"]');
      if (amountInput) {
        amountInput.focus();
        amountInput.select();
      }
    }, 100);
  };
  
  // 删除
  const handleDelete = (transfer: InternalTransferType) => {
    // BR5：数据锁定检查
    if (transfer.voucherCode) {
      alert('该转账单已生成凭证，无法删除');
      return;
    }
    
    setDeleteTarget(transfer);
  };
  
  // 确认删除
  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    deleteInternalTransfer(deleteTarget.id);
    setDeleteTarget(null);
    handleQuery(); // 重新查询
  };
  
  // 保存
  const handleSave = () => {
    // 验证
    if (!formData.date) {
      alert('请选择记账日期');
      return;
    }
    
    if (!formData.remark || formData.remark.trim() === '') {
      alert('请输入摘要（必填）');
      return;
    }
    
    if (!formData.fromAccountId) {
      alert('请选择转出账户');
      return;
    }
    
    if (!formData.toAccountId) {
      alert('请选择转入账户');
      return;
    }
    
    // BR1：核心校验 - 转出和转入账户不能相同
    if (formData.fromAccountId === formData.toAccountId) {
      alert('���入和转出账户不能相同');
      return;
    }
    
    if (!formData.amount || formData.amount <= 0) {
      alert('请输入有效的转账金额');
      return;
    }
    
    const fromAccount = accounts.find(a => a.id === formData.fromAccountId);
    const toAccount = accounts.find(a => a.id === formData.toAccountId);
    
    if (!fromAccount || !toAccount) {
      alert('账户信息异常');
      return;
    }
    
    if (editTarget) {
      // 编辑模式
      updateInternalTransfer(editTarget.id, {
        date: formData.date!,
        fromAccountId: formData.fromAccountId!,
        fromAccountName: fromAccount.accountName,
        toAccountId: formData.toAccountId!,
        toAccountName: toAccount.accountName,
        amount: formData.amount!,
        remark: formData.remark
      });
    } else {
      // 新增模式 - BR2 & BR3：自动在UC11创建两条流水
      addInternalTransfer({
        date: formData.date!,
        fromAccountId: formData.fromAccountId!,
        fromAccountName: fromAccount.accountName,
        toAccountId: formData.toAccountId!,
        toAccountName: toAccount.accountName,
        amount: formData.amount!,
        remark: formData.remark
      });
    }
    
    setShowModal(false);
    handleQuery(); // 重新查询
  };
  
  // 批量生成凭证
  const handleBatchGenerateVouchers = () => {
    if (selectedIds.length === 0) {
      alert('请先选择要生成凭证的转账单');
      return;
    }
    
    setVoucherGenerationDialogOpen(true);
  };
  
  // 确认生成凭证
  const confirmGenerateVouchers = () => {
    const validTransfers = transfers.filter(t => 
      selectedIds.includes(t.id) && !t.voucherCode
    );
    
    if (validTransfers.length === 0) {
      alert('没有可生成凭证的转账单');
      return;
    }
    
    // 获取当前最大凭证号
    const allVouchers = getAllVouchers();
    let maxVoucherNumber = 0;
    
    allVouchers.forEach(v => {
      if (v.voucherType === '转') {
        const num = parseInt(v.voucherNumber);
        if (!isNaN(num) && num > maxVoucherNumber) {
          maxVoucherNumber = num;
        }
      }
    });
    
    validTransfers.forEach((transfer, index) => {
      const fromAccount = accounts.find(a => a.id === transfer.fromAccountId);
      const toAccount = accounts.find(a => a.id === transfer.toAccountId);
      
      if (!fromAccount || !toAccount) return;
      
      // 生成凭证号
      const voucherNumber = String(maxVoucherNumber + index + 1).padStart(3, '0');
      const voucherCode = `转-${voucherNumber}`;
      
      // 创建凭证：借：转入账户，贷：转出账户
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
            subjectId: toAccount.relatedSubjectId,
            subjectCode: toAccount.relatedSubjectCode,
            subjectName: toAccount.relatedSubjectName,
            debitAmount: transfer.amount.toFixed(2),
            creditAmount: ''
          },
          {
            id: `l${Date.now()}-${index}-2`,
            summary: transfer.remark || '内部转账',
            subjectId: fromAccount.relatedSubjectId,
            subjectCode: fromAccount.relatedSubjectCode,
            subjectName: fromAccount.relatedSubjectName,
            debitAmount: '',
            creditAmount: transfer.amount.toFixed(2)
          }
        ],
        debitTotal: transfer.amount,
        creditTotal: transfer.amount,
        status: 'draft',
        maker: 'QQ',
        isExpanded: false,
        createdAt: new Date().toLocaleString('zh-CN'),
        updatedAt: new Date().toLocaleString('zh-CN')
      };
      
      addVoucher(voucher);
      
      // 回写凭证号到转账单
      updateInternalTransfer(transfer.id, {
        voucherCode: voucherCode
      });
    });
    
    setVoucherGenerationDialogOpen(false);
    setSelectedIds([]);
    handleQuery(); // 重新查询
    
    alert(`成功生成 ${validTransfers.length} 张凭证！`);
  };
  
  // 查看全部凭证
  const handleViewAllVouchers = () => {
    alert('跳转到凭证管理页面，筛选凭证类型为"转"');
  };
  
  const selectableCount = transfers.filter(t => !t.voucherCode).length;
  const allSelected = selectableCount > 0 && selectedIds.length === selectableCount;
  
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">内部转账</h1>
        <p className="text-gray-600">
          处理公司内部账户间的资金划拨，一次录入自动生成两账户流水
        </p>
      </div>
      
      {/* 筛选与操作栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>日期区间（起） <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>日期区间（止） <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="col-span-3 space-y-2">
            <Label>摘要</Label>
            <Input
              placeholder="输入摘要查询"
              value={filters.summary}
              onChange={(e) => setFilters({ ...filters, summary: e.target.value })}
            />
          </div>
          <div className="col-span-5 space-y-2">
            <Label className="invisible">操作</Label>
            <div className="flex items-center gap-2">
              <Button onClick={handleQuery} className="flex-1">
                <Search className="w-4 h-4 mr-2" />
                查询
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                <Plus className="w-4 h-4 mr-2" />
                新增
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleBatchGenerateVouchers}
                disabled={selectedIds.length === 0}
              >
                <FileText className="w-4 h-4 mr-2" />
                生成凭证 ({selectedIds.length})
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
                    暂无数据，请点击"查询"或"新增"
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
                          <a
                            href="#"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              alert(`跳转到凭证: ${transfer.voucherCode}`);
                            }}
                          >
                            {transfer.voucherCode}
                          </a>
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
              />
            </div>
            
            <div className="space-y-2">
              <Label>摘要 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="请输入摘要（必填）"
                value={formData.remark || ''}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label>转出账户 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.fromAccountId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, fromAccountId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择转出账户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择</SelectItem>
                  {accounts.map(acc => (
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
                onValueChange={(value) => setFormData({ ...formData, toAccountId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择转入账户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择</SelectItem>
                  {accounts.map(acc => (
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
