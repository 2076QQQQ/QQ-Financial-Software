import { useState, useEffect } from 'react';
import { Search, Download, Plus, Edit, Copy, Trash2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';      
import Decimal from 'decimal.js';
import {
  getFundAccounts,
  getExpenseCategories,
  getPartners,
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  batchUpdateJournalEntries,
  addVoucher,
  getAllVouchers,
  type FundAccount,
  type ExpenseCategory,
  type Partner,
  type JournalEntry,
} from '@/lib/mockData';    

export default function CashJournal() {
  const [activeTab, setActiveTab] = useState<'银行存款' | '现金'>('银行存款');
  
  // 筛选条件
  const [filters, setFilters] = useState({
    dateFrom: '2025-01-01',
    dateTo: '2025-11-30',
    accountId: ''
  });
  
  // 数据状态
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [batchCategoryDialogOpen, setBatchCategoryDialogOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [voucherGenerationDialogOpen, setVoucherGenerationDialogOpen] = useState(false);
  
  // 加载数据
  useEffect(() => {
    loadAccounts();
    setCategories(getExpenseCategories());
    setPartners(getPartners());
  }, [activeTab]);
  
  // 加载账户列表（根据Tab切换）
  const loadAccounts = () => {
    const accountsList = getFundAccounts(activeTab);
    setAccounts(accountsList);
    // 如果当前选中的账户不在新列表中，清空选择
    if (filters.accountId && !accountsList.find(a => a.id === filters.accountId)) {
      setFilters({ ...filters, accountId: '' });
      setEntries([]);
    }
  };
  
  // 查询数据
  const handleQuery = () => {
    if (!filters.accountId) {
      alert('请选择账户名称');
      return;
    }
    
    const account = accounts.find(a => a.id === filters.accountId);
    if (!account) return;
    
    const rawEntries = getJournalEntries(filters.accountId, filters.dateFrom, filters.dateTo);
    
    // 重新计算余额（闭环一：余额自动计算）
    const entriesWithBalance = recalculateBalances(rawEntries, account.initialBalance);
    
    setEntries(entriesWithBalance);
  };
  
  // 重新计算余额（BR2 & QR1）
  const recalculateBalances = (rawEntries: JournalEntry[], initialBalance: number): JournalEntry[] => {
    // 按日期排序
    const sorted = [...rawEntries].sort((a, b) => a.date.localeCompare(b.date));
    
    let runningBalance = new Decimal(initialBalance);
    
    return sorted.map(entry => {
      // 使用高精度计算
      const income = new Decimal(entry.income || 0);
      const expense = new Decimal(entry.expense || 0);
      runningBalance = runningBalance.plus(income).minus(expense);
      
      return {
        ...entry,
        balance: runningBalance.toNumber()
      };
    });
  };
  
  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // 只选择未锁定的行
      const selectableIds = entries
        .filter(e => !e.voucherCode)
        .map(e => e.id);
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
  
  // 新增行
  const handleAddNew = () => {
    if (!filters.accountId) {
      alert('请先选择账户');
      return;
    }
    
    const account = accounts.find(a => a.id === filters.accountId);
    if (!account) return;
    
    setNewEntry({
      accountId: filters.accountId,
      accountType: activeTab,
      date: new Date().toISOString().split('T')[0],
      summary: '',
      categoryId: '',
      categoryName: '',
      partnerId: '',
      partnerName: '',
      income: 0,
      expense: 0,
      balance: 0
    });
  };
  
  // 编辑行
  const handleEdit = (entry: JournalEntry) => {
    // 检查数据锁定（BR3）
    if (entry.voucherCode) {
      alert('该流水已生成凭证，无法编辑');
      return;
    }
    setEditingId(entry.id);
  };
  
  // 复制行
  const handleCopy = (entry: JournalEntry) => {
    const account = accounts.find(a => a.id === filters.accountId);
    if (!account) return;
    
    setNewEntry({
      accountId: entry.accountId,
      accountType: entry.accountType,
      date: new Date().toISOString().split('T')[0],
      summary: entry.summary,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      partnerId: entry.partnerId,
      partnerName: entry.partnerName,
      income: 0,
      expense: 0,
      balance: 0
    });
  };
  
  // 删除行
  const handleDelete = (entry: JournalEntry) => {
    // 检查数据锁定（BR3）
    if (entry.voucherCode) {
      alert('该流水已生成凭证，无法删除');
      return;
    }
    setDeleteTarget(entry);
  };
  
  // 确认删除
  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    deleteJournalEntry(deleteTarget.id);
    setDeleteTarget(null);
    handleQuery(); // 重新查询
  };
  
  // 保存新增
  const saveNewEntry = () => {
    if (!newEntry) return;
    
    // 验证
    if (!newEntry.date) {
      alert('请选择记账日期');
      return;
    }
    if (!newEntry.summary?.trim()) {
      alert('请输入摘要');
      return;
    }
    if (!newEntry.income && !newEntry.expense) {
      alert('请输入收入或支出金额');
      return;
    }
    if (newEntry.income && newEntry.expense) {
      alert('收入和支出不能同时填写');
      return;
    }
    
    const account = accounts.find(a => a.id === filters.accountId);
    if (!account) return;
    
    addJournalEntry({
      accountId: newEntry.accountId!,
      accountType: newEntry.accountType!,
      date: newEntry.date!,
      summary: newEntry.summary!,
      categoryId: newEntry.categoryId,
      categoryName: newEntry.categoryName,
      partnerId: newEntry.partnerId,
      partnerName: newEntry.partnerName,
      income: Number(newEntry.income || 0),
      expense: Number(newEntry.expense || 0),
      balance: 0 // 将被重新计算
    });
    
    setNewEntry(null);
    handleQuery(); // 重新查询并重算余额
  };
  
  // 取消新增
  const cancelNewEntry = () => {
    setNewEntry(null);
  };
  
  // 保存编辑
  const saveEdit = (entry: JournalEntry) => {
    // 验证
    if (!entry.date) {
      alert('请选择记账日期');
      return;
    }
    if (!entry.summary?.trim()) {
      alert('请输入摘要');
      return;
    }
    if (!entry.income && !entry.expense) {
      alert('请输入收入或支出金额');
      return;
    }
    if (entry.income && entry.expense) {
      alert('收入和支出不能同时填写');
      return;
    }
    
    updateJournalEntry(entry.id, {
      date: entry.date,
      summary: entry.summary,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      partnerId: entry.partnerId,
      partnerName: entry.partnerName,
      income: entry.income,
      expense: entry.expense
    });
    
    setEditingId(null);
    handleQuery(); // 重新查询并重算余额
  };
  
  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
  };
  
  // 更新编辑中的字段
  const updateField = (id: string, field: keyof JournalEntry, value: any) => {
    setEntries(entries.map(e => {
      if (e.id === id) {
        const updated = { ...e, [field]: value };
        
        // 如果更新的是类别，同步名称
        if (field === 'categoryId') {
          const category = categories.find(c => c.id === value);
          updated.categoryName = category?.name;
        }
        
        // 如果更新的是往来单位，同步名称
        if (field === 'partnerId') {
          const partner = partners.find(p => p.id === value);
          updated.partnerName = partner?.name;
        }
        
        // 如果更新收入，清空支出
        if (field === 'income' && value) {
          updated.expense = 0;
        }
        
        // 如果更新支出，清空收入
        if (field === 'expense' && value) {
          updated.income = 0;
        }
        
        return updated;
      }
      return e;
    }));
  };
  
  // 批量指定收支类别
  const handleBatchCategory = () => {
    if (selectedIds.length === 0) {
      alert('请先选择需要分类的流水');
      return;
    }
    
    setBatchCategoryDialogOpen(true);
  };
  
  // 确认批量分类
  const confirmBatchCategory = () => {
    if (!selectedCategoryId) {
      alert('请选择收支类别');
      return;
    }
    
    const category = categories.find(c => c.id === selectedCategoryId);
    if (!category) return;
    
    batchUpdateJournalEntries(selectedIds, {
      categoryId: category.id,
      categoryName: category.name
    });
    
    setBatchCategoryDialogOpen(false);
    setSelectedCategoryId('');
    setSelectedIds([]);
    handleQuery(); // 重新查询
  };
  
  // 生成凭证（BR4 & BR5）
  const handleGenerateVouchers = () => {
    // 筛选：已分类 且 未生成凭证 且 已选中
    const validEntries = entries.filter(e => 
      selectedIds.includes(e.id) &&
      e.categoryId &&
      !e.voucherCode
    );
    
    if (validEntries.length === 0) {
      alert('请选择已分类且未生成凭证的流水');
      return;
    }
    
    setVoucherGenerationDialogOpen(true);
  };
  
  // 确认生成凭证
  const confirmGenerateVouchers = () => {
    const validEntries = entries.filter(e => 
      selectedIds.includes(e.id) &&
      e.categoryId &&
      !e.voucherCode
    );
    
    // 获取当前最大凭证号（从全局vouchers中获取）
    const allVouchers = getAllVouchers();
    let maxVoucherNumber = 0;
    
    allVouchers.forEach(v => {
      if (v.voucherType === '记') {
        const num = parseInt(v.voucherNumber);
        if (!isNaN(num) && num > maxVoucherNumber) {
          maxVoucherNumber = num;
        }
      }
    });
    
    validEntries.forEach((entry, index) => {
      // 查找收支类别对应的会计科目
      const category = categories.find(c => c.id === entry.categoryId);
      if (!category) return;
      
      const account = accounts.find(a => a.id === entry.accountId);
      if (!account) return;
      
      // 生成凭证号（从最大号+1开始递增）
      const voucherNumber = String(maxVoucherNumber + index + 1).padStart(3, '0');
      const voucherCode = `记-${voucherNumber}`;
      
      // 创建凭证
      const voucher = {
        id: `v${Date.now()}-${index}`,
        voucherDate: entry.date,
        voucherType: '记',
        voucherNumber: voucherNumber,
        voucherCode: voucherCode,
        attachments: 0,
        lines: entry.income > 0
          ? [
              // 收入：借资金账户，贷收入科目
              {
                id: `l${Date.now()}-${index}-1`,
                summary: entry.summary,
                subjectId: account.relatedSubjectId,
                subjectCode: account.relatedSubjectCode,
                subjectName: account.relatedSubjectName,
                debitAmount: entry.income.toFixed(2),
                creditAmount: ''
              },
              {
                id: `l${Date.now()}-${index}-2`,
                summary: entry.summary,
                subjectId: category.id,
                subjectCode: category.relatedSubjectCode,
                subjectName: category.relatedSubjectName,
                debitAmount: '',
                creditAmount: entry.income.toFixed(2)
              }
            ]
          : [
              // 支出：借费用科目，贷资金账户
              {
                id: `l${Date.now()}-${index}-1`,
                summary: entry.summary,
                subjectId: category.id,
                subjectCode: category.relatedSubjectCode,
                subjectName: category.relatedSubjectName,
                debitAmount: entry.expense.toFixed(2),
                creditAmount: ''
              },
              {
                id: `l${Date.now()}-${index}-2`,
                summary: entry.summary,
                subjectId: account.relatedSubjectId,
                subjectCode: account.relatedSubjectCode,
                subjectName: account.relatedSubjectName,
                debitAmount: '',
                creditAmount: entry.expense.toFixed(2)
              }
            ],
        debitTotal: entry.income || entry.expense,
        creditTotal: entry.income || entry.expense,
        status: 'draft',
        maker: 'QQ',
        isExpanded: false,
        createdAt: new Date().toLocaleString('zh-CN'),
        updatedAt: new Date().toLocaleString('zh-CN')
      };
      
      addVoucher(voucher);
      
      // 回写凭证号到流水（闭环）
      updateJournalEntry(entry.id, {
        voucherCode: voucherCode
      });
    });
    
    setVoucherGenerationDialogOpen(false);
    setSelectedIds([]);
    handleQuery(); // 重新查询
    
    alert(`成功生成 ${validEntries.length} 张凭证！`);
  };
  
  // 导出Excel
  const handleExport = () => {
    if (entries.length === 0) {
      alert('没有可导出的数据');
      return;
    }
    
    const account = accounts.find(a => a.id === filters.accountId);
    if (!account) return;
    
    // 创建HTML表格
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>${activeTab === '银行存款' ? '银行日记账' : '现金日记账'}</title>
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid black; padding: 5px; }
            th { background-color: #E0E0E0; font-weight: bold; text-align: center; }
            .number { text-align: right; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h2>${activeTab === '银行存款' ? '银行日记账' : '现金日记账'}</h2>
          <p>账户：${account.accountName}</p>
          <p>期间：${filters.dateFrom} 至 ${filters.dateTo}</p>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>摘要</th>
                <th>收支类别</th>
                <th>往来单位</th>
                <th>收入</th>
                <th>支出</th>
                <th>余额</th>
                <th>凭证号</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(entry => `
                <tr>
                  <td class="center">${entry.date}</td>
                  <td>${entry.summary}</td>
                  <td>${entry.categoryName || '-'}</td>
                  <td>${entry.partnerName || '-'}</td>
                  <td class="number">${entry.income > 0 ? entry.income.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}</td>
                  <td class="number">${entry.expense > 0 ? entry.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}</td>
                  <td class="number">${entry.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${entry.voucherCode || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/vnd.ms-excel'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab === '银行存款' ? '银行日记账' : '现金日记账'}_${account.accountName}_${filters.dateFrom}_${filters.dateTo}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // 渲染表格行
  const renderRow = (entry: JournalEntry, index: number) => {
    const isEditing = editingId === entry.id;
    const isLocked = !!entry.voucherCode; // BR3: 数据锁定
    
    return (
      <TableRow key={entry.id} className={isLocked ? 'bg-gray-50' : ''}>
        <TableCell>
          <Checkbox
            checked={selectedIds.includes(entry.id)}
            onCheckedChange={(checked) => handleSelectOne(entry.id, checked as boolean)}
            disabled={isLocked}
          />
        </TableCell>
        
        <TableCell>
          {isEditing ? (
            <Input
              type="date"
              value={entry.date}
              onChange={(e) => updateField(entry.id, 'date', e.target.value)}
              className="w-36"
            />
          ) : (
            <span className={isLocked ? 'text-gray-500' : ''}>{entry.date}</span>
          )}
        </TableCell>
        
        <TableCell>
          {isEditing ? (
            <Input
              value={entry.summary}
              onChange={(e) => updateField(entry.id, 'summary', e.target.value)}
              placeholder="输入摘要"
              className="min-w-[200px]"
            />
          ) : (
            <span className={isLocked ? 'text-gray-500' : ''}>{entry.summary}</span>
          )}
        </TableCell>
        
        <TableCell>
          {isEditing ? (
            <Select
              value={entry.categoryId || 'none'}
              onValueChange={(value) => updateField(entry.id, 'categoryId', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="选择类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className={isLocked ? 'text-gray-500' : 'text-gray-600'}>
              {entry.categoryName || '-'}
            </span>
          )}
        </TableCell>
        
        <TableCell>
          {isEditing ? (
            <Select
              value={entry.partnerId || 'none'}
              onValueChange={(value) => updateField(entry.id, 'partnerId', value === 'none' ? '' : value)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="选择单位" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                {partners.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className={isLocked ? 'text-gray-500' : 'text-gray-600'}>
              {entry.partnerName || '-'}
            </span>
          )}
        </TableCell>
        
        <TableCell className="text-right">
          {isEditing ? (
            <Input
              type="number"
              step="0.01"
              value={entry.income || ''}
              onChange={(e) => updateField(entry.id, 'income', Number(e.target.value))}
              placeholder="0.00"
              className="w-32 text-right"
            />
          ) : (
            <span className={`${isLocked ? 'text-gray-500' : 'text-green-600'}`}>
              {entry.income > 0 ? entry.income.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}
            </span>
          )}
        </TableCell>
        
        <TableCell className="text-right">
          {isEditing ? (
            <Input
              type="number"
              step="0.01"
              value={entry.expense || ''}
              onChange={(e) => updateField(entry.id, 'expense', Number(e.target.value))}
              placeholder="0.00"
              className="w-32 text-right"
            />
          ) : (
            <span className={`${isLocked ? 'text-gray-500' : 'text-red-600'}`}>
              {entry.expense > 0 ? entry.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}
            </span>
          )}
        </TableCell>
        
        <TableCell className="text-right">
          <span className={isLocked ? 'text-gray-600' : 'text-gray-900'}>
            ¥ {entry.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </span>
        </TableCell>
        
        <TableCell className="text-center">
          {entry.voucherCode ? (
            <a
              href="#"
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                alert(`跳转到凭证: ${entry.voucherCode}`);
              }}
            >
              {entry.voucherCode}
            </a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </TableCell>
        
        <TableCell>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => saveEdit(entry)}
                  className="h-7 px-2"
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEdit}
                  className="h-7 px-2"
                >
                  取消
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(entry)}
                  disabled={isLocked}
                  className="h-7 w-7 p-0"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(entry)}
                  className="h-7 w-7 p-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(entry)}
                  disabled={isLocked}
                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">出纳日记账</h1>
        <p className="text-gray-600">
          序时记录资金流入流出，自动计算余额，支持生成凭证
        </p>
      </div>
      
      {/* Tab导航 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as '银行存款' | '现金')} className="mb-4">
        <TabsList>
          <TabsTrigger value="银行存款">银行日记账</TabsTrigger>
          <TabsTrigger value="现金">现金日记账</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-4">
          {/* 筛选与操作栏 */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <div className="grid grid-cols-12 gap-3 mb-3">
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
                <Label>账户名称 <span className="text-red-500">*</span></Label>
                <Select
                  value={filters.accountId}
                  onValueChange={(value) => setFilters({ ...filters, accountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-5 space-y-2">
                <Label className="invisible">操作</Label>
                <div className="flex items-center gap-2">
                  <Button onClick={handleQuery} className="flex-1">
                    <Search className="w-4 h-4 mr-2" />
                    查询
                  </Button>
                  <Button variant="outline" onClick={handleAddNew} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    新增
                  </Button>
                  <Button variant="outline" onClick={handleExport} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </Button>
                </div>
              </div>
            </div>
            
            {/* 批量操作区 */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 pt-3 border-t">
                <span className="text-sm text-gray-600">已选择 {selectedIds.length} 项</span>
                <Button size="sm" variant="outline" onClick={handleBatchCategory}>
                  批量指定收支类别
                </Button>
                <Button size="sm" onClick={handleGenerateVouchers}>
                  <FileText className="w-4 h-4 mr-2" />
                  生成凭证
                </Button>
              </div>
            )}
          </div>
          
          {/* 数据表格 */}
          <div className="bg-white rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.length === entries.filter(e => !e.voucherCode).length && entries.filter(e => !e.voucherCode).length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[120px]">记账日期 <span className="text-red-500">*</span></TableHead>
                    <TableHead className="min-w-[200px]">摘要 <span className="text-red-500">*</span></TableHead>
                    <TableHead className="w-[140px]">收支类别</TableHead>
                    <TableHead className="w-[140px]">往来单位</TableHead>
                    <TableHead className="text-right w-[130px]">收入</TableHead>
                    <TableHead className="text-right w-[130px]">支出</TableHead>
                    <TableHead className="text-right w-[140px]">余额</TableHead>
                    <TableHead className="text-center w-[100px]">记账凭证号</TableHead>
                    <TableHead className="text-center w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 新增行 */}
                  {newEntry && (
                    <TableRow className="bg-blue-50">
                      <TableCell></TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={newEntry.date || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                          className="w-36"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newEntry.summary || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, summary: e.target.value })}
                          placeholder="输入摘要"
                          className="min-w-[200px]"
                          autoFocus
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={newEntry.categoryId || 'none'}
                          onValueChange={(value) => {
                            const category = categories.find(c => c.id === value);
                            setNewEntry({
                              ...newEntry,
                              categoryId: value === 'none' ? '' : value,
                              categoryName: category?.name
                            });
                          }}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="选择类别" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">无</SelectItem>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={newEntry.partnerId || 'none'}
                          onValueChange={(value) => {
                            const partner = partners.find(p => p.id === value);
                            setNewEntry({
                              ...newEntry,
                              partnerId: value === 'none' ? '' : value,
                              partnerName: partner?.name
                            });
                          }}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="选择单位" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">无</SelectItem>
                            {partners.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={newEntry.income || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, income: Number(e.target.value), expense: 0 })}
                          placeholder="0.00"
                          className="w-32 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={newEntry.expense || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, expense: Number(e.target.value), income: 0 })}
                          placeholder="0.00"
                          className="w-32 text-right"
                        />
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            onClick={saveNewEntry}
                            className="h-7 px-2"
                          >
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelNewEntry}
                            className="h-7 px-2"
                          >
                            取消
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* 数据行 */}
                  {entries.length === 0 && !newEntry ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                        请选择账户并点击查询
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry, index) => renderRow(entry, index))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
          {/* 说明 */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium mb-2">💡 核心逻辑说明</div>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li><span className="font-medium">余额自动计算</span>：系统按日期排序，从期初余额开始逐行计算，使用高精度数字确保准确</li>
                    <li><span className="font-medium">数据锁定</span>：已生成凭证的流水不可编辑/删除，凭证号显示为蓝色链接可跳转</li>
                    <li><span className="font-medium">业财一体化</span>：出纳录入流水 → 会计批量分类 → 一键生成凭证 → 凭证号自动回写</li>
                    <li>收支类别和往来单位非必填，可后续批量指定</li>
                    <li>收入和支出互斥，只能填写其中一项</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除这笔流水吗？此操作不可逆。
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
      
      {/* 批量指定收支类别对话框 */}
      <Dialog open={batchCategoryDialogOpen} onOpenChange={setBatchCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量指定收支类别</DialogTitle>
            <DialogDescription>
              为选中的 {selectedIds.length} 笔流水指定收支类别
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>选择收支类别 <span className="text-red-500">*</span></Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{cat.name}</span>
                        <span className="text-xs text-gray-500 ml-4">
                          {cat.relatedSubjectCode} {cat.relatedSubjectName}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCategoryDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmBatchCategory}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 生成凭证确认对话框 */}
      <Dialog open={voucherGenerationDialogOpen} onOpenChange={setVoucherGenerationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成凭证确认</DialogTitle>
            <DialogDescription>
              系统将为选中的流水自动生成会计凭证
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">生成规则：</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>系统将根据收支类别关联的会计科目自动生成凭证</li>
                    <li>收入：借资金账户，贷收入科目</li>
                    <li>支出：借费用科目，贷资金账户</li>
                    <li>生成后凭证号将自动回写到流水，流水将被锁定</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              将为 <span className="font-medium text-gray-900">
                {entries.filter(e => selectedIds.includes(e.id) && e.categoryId && !e.voucherCode).length}
              </span> 笔流水生成凭证
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoucherGenerationDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmGenerateVouchers}>
              确认生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}