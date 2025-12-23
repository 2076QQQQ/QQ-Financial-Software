import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

import { Search, Download, Plus, Edit, Copy, Trash2, FileText, AlertCircle, RefreshCw, CheckSquare, Calculator } from 'lucide-react';
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
import Decimal from 'decimal.js';
import { toast } from 'sonner'; 
import {
  getFundAccounts,
  getAllSubjects,
  getPartners,
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  batchUpdateJournalEntries,
  addVoucher,
  getAllVouchers,
  type FundAccount,
  type Partner,
  type JournalEntry,
} from '@/lib/mockData'; 
import * as XLSX from 'xlsx';

// 定义科目接口
interface Subject {
  id: string;
  code: string;
  name: string;
  category: string;
  direction: string;
  isActive: boolean;
  hasChildren: boolean;
  accountBookId?: string; // ★ 确保类型定义包含此字段
}

const inputClass = "bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors";
const [isGenerating, setIsGenerating] = useState(false);

export default function CashJournal() {
  const router = useRouter();
  const { bookId } = router.query;

  const [activeTab, setActiveTab] = useState<'银行存款' | '现金'>('银行存款');
  const [isLoading, setIsLoading] = useState(false); 

  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    
    return {
      dateFrom: firstDay,
      dateTo: today,
      accountId: ''
    };
  });

  // 基础数据状态
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]); 
  const [partners, setPartners] = useState<Partner[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 操作状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<JournalEntry> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  
  // 批量操作弹窗
  const [batchSubjectDialogOpen, setBatchSubjectDialogOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  
  // 生成凭证弹窗及配置
  const [voucherGenerationDialogOpen, setVoucherGenerationDialogOpen] = useState(false);
  const [enableTax, setEnableTax] = useState(false); 
  const [taxRate, setTaxRate] = useState('13'); 

  // 加载基础数据
  useEffect(() => {
    if (!router.isReady || !bookId) return;
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;

    const initData = async () => {
      try {
        await loadAccounts(currentBookId);
        
        const allSubjects = await getAllSubjects(currentBookId);
        if (Array.isArray(allSubjects)) {
          
          const validSubjects = allSubjects.filter((currentSubject: any) => {
            const currentCode = currentSubject.code ? String(currentSubject.code) : '';
            if (!currentCode) return false;

            // ★★★ 核心修复：增加科目账套隔离 ★★★
            if (currentSubject.accountBookId && currentSubject.accountBookId !== currentBookId) {
                return false;
            }

            if (!currentSubject.isActive) return false;
            if (currentCode.startsWith('1001') || currentCode.startsWith('1002')) return false;

            const isParent = allSubjects.some((other: any) => {
                const otherCode = other.code ? String(other.code) : '';
                return otherCode && otherCode !== currentCode && otherCode.startsWith(currentCode);
            });

            return !isParent; 
          });
          
          validSubjects.sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));
          setSubjects(validSubjects);
        }

        const partnersData = await getPartners(currentBookId); 
        setPartners(Array.isArray(partnersData) ? partnersData : []);
      } catch (error) {
        console.error("Failed to load initial data:", error);
      }
    };

    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, router.isReady, bookId]); 

  const loadAccounts = async (currentBookId: string) => {
    try {
      const allAccounts = await getFundAccounts(currentBookId);
      const targetTypes = activeTab === '银行存款' 
        ? ['bank', 'Bank', '银行存款', '银行'] 
        : ['cash', 'Cash', '现金', '库存现金'];
      
      const filteredAccounts = Array.isArray(allAccounts)
        ? allAccounts.filter((a: any) => {
            // ★★★ 核心修复：严格筛选属于当前账套的资金账户 ★★★
            if (a.accountBookId !== currentBookId) return false;

            const typeVal = a.type || a.accountType || a.account_type || a.category || '';
            return targetTypes.includes(typeVal);
          })
        : [];

      setAccounts(filteredAccounts);
      
      if (filters.accountId && !filteredAccounts.find(a => a.id === filters.accountId)) {
        setFilters(prev => ({ ...prev, accountId: '' }));
        setEntries([]);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
      setAccounts([]); 
    }
  };

  const handleQuery = async () => {
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
    if (!currentBookId) return;

    if (!filters.accountId) {
      toast.warning('请选择账户名称');
      return;
    }

    const account = accounts.find(a => a.id === filters.accountId);
    if (!account) return;
    
    setIsLoading(true);
    try {
      const rawEntries = await getJournalEntries(
        currentBookId,
        filters.accountId,
        filters.dateFrom,
        filters.dateTo
      );

      // 注意：getJournalEntries 在 mockData 里应该已经传了 accountBookId 给后端
      // 如果后端没过滤，这里可以再次过滤 (defensive programming)
      const validEntries = Array.isArray(rawEntries) 
         ? rawEntries.filter((e: any) => e.accountBookId === currentBookId)
         : [];

      if (validEntries.length > 0) {
        const initialBalance = Number(account.initialBalance) || 0;
        const entriesWithBalance = recalculateBalances(validEntries, initialBalance);
        setEntries(entriesWithBalance);
      } else {
        setEntries([]);
      }
      setSelectedIds([]); 
    } catch (error) {
      console.error("查询失败:", error);
      toast.error("查询数据失败");
    } finally {
      setIsLoading(false);
    }
  };

  const recalculateBalances = (rawEntries: JournalEntry[], initialBalance: number): JournalEntry[] => {
    const sorted = [...rawEntries].sort((a, b) => a.date.localeCompare(b.date));
    let runningBalance = new Decimal(initialBalance);

    return sorted.map(entry => {
      const income = new Decimal(entry.income || 0);
      const expense = new Decimal(entry.expense || 0);
      runningBalance = runningBalance.plus(income).minus(expense);

      return {
        ...entry,
        balance: runningBalance.toNumber()
      };
    });
  };

  // ... (中间的 handleSelectAll, handleAddNew 等逻辑保持不变，没有需要修改的地方) ...
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableIds = entries
        .filter(e => !e.voucherCode)
        .map(e => e.id);
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

  const handleAddNew = () => {
    if (!filters.accountId) {
      toast.warning('请先选择账户');
      return;
    }
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

  const handleEdit = (entry: JournalEntry) => {
    if (entry.voucherCode) {
      toast.warning('该流水已生成凭证，请先删除凭证后修改');
      return;
    }
    setEditingId(entry.id);
  };

  const handleCopy = (entry: JournalEntry) => {
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

  const handleDelete = (entry: JournalEntry) => {
    if (entry.voucherCode) {
      toast.warning('该流水已生成凭证，请先删除凭证后删除');
      return;
    }
    setDeleteTarget(entry);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJournalEntry(deleteTarget.id);
      setDeleteTarget(null);
      handleQuery();
      toast.success('删除成功');
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const saveNewEntry = async () => {
    if (!newEntry) return;
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
    if (!currentBookId) {
        toast.error('未找到账套信息');
        return;
    }

    if (!newEntry.date) { toast.warning('请选择记账日期'); return; }
    if (!newEntry.summary?.trim()) { toast.warning('请输入摘要'); return; }
    if (!newEntry.income && !newEntry.expense) { toast.warning('请输入收入或支出金额'); return; }
    
    const expenseAmount = Number(newEntry.expense || 0);
    
    if (expenseAmount > 0) {
        let currentBalance = 0;
        if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1]; 
            currentBalance = lastEntry.balance;
        } else {
            const account = accounts.find(a => a.id === filters.accountId);
            currentBalance = Number(account?.initialBalance || 0);
        }

        if (currentBalance < expenseAmount) {
            const confirm = window.confirm(
                `⚠️ 余额预警\n\n当前账户余额：${currentBalance.toLocaleString()}\n本笔支出金额：${expenseAmount.toLocaleString()}\n\n支出后余额将变为负数。是否确认保存？`
            );
            if (!confirm) return;
        }
    }

    try {
      await addJournalEntry({
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
        balance: 0
      }, currentBookId);
      
      setNewEntry(null);
      handleQuery(); 
      toast.success('保存成功');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const cancelNewEntry = () => {
    setNewEntry(null);
  };

  const saveEdit = async (entry: JournalEntry) => {
    try {
      await updateJournalEntry({
        id: entry.id,
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
      handleQuery();
      toast.success('更新成功');
    } catch (error) {
      toast.error('更新失败');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const updateField = (id: string, field: keyof JournalEntry, value: any) => {
    setEntries(entries.map(e => {
      if (e.id === id) {
        const updated = { ...e, [field]: value };
        if (field === 'categoryId') {
          const subject = subjects.find(s => s.id === value);
          updated.categoryName = subject ? subject.name : '';
        }
        if (field === 'partnerId') {
          const partner = partners.find(p => p.id === value);
          updated.partnerName = partner?.name;
        }
        if (field === 'income' && value) updated.expense = 0;
        if (field === 'expense' && value) updated.income = 0;
        return updated;
      }
      return e;
    }));
  };

  const handleBatchSubject = () => {
    if (selectedIds.length === 0) {
      toast.warning('请先选择需要分类的流水');
      return;
    }
    setBatchSubjectDialogOpen(true);
  };

  const confirmBatchSubject = async () => {
    if (!selectedSubjectId) {
      toast.warning('请选择对方科目');
      return;
    }
    const subject = subjects.find(s => s.id === selectedSubjectId);
    if (!subject) return;
    try {
      await batchUpdateJournalEntries(selectedIds, {
        categoryId: subject.id,
        categoryName: subject.name
      });
      setBatchSubjectDialogOpen(false);
      setSelectedSubjectId('');
      setSelectedIds([]);
      handleQuery();
      toast.success('批量操作成功');
    } catch (error) {
      toast.error('批量操作失败');
    }
  };

  // ... (凭证生成逻辑保持不变，它依赖的数据源已经是过滤过的) ...
  const handleGenerateVouchers = () => {
    if (selectedIds.length === 0) {
      toast.warning('请先勾选需要生成凭证的记录');
      return;
    }

    const validEntries = entries.filter(e =>
      selectedIds.includes(e.id) &&
      e.categoryId && 
      !e.voucherCode
    );

    if (validEntries.length === 0) {
      alert('请选择“已指定对方科目”且“未生成凭证”的流水。\n(请检查是否勾选了已生成凭证的记录，或者未指定对方科目的记录)');
      return;
    }

    setEnableTax(false);
    setTaxRate('13');
    setVoucherGenerationDialogOpen(true);
  };

  const generateSingleVouchers = async (entriesList: JournalEntry[], bookId: string) => {
    if (isGenerating) return; // 🔒 锁：如果在生成中，直接退出
    setIsGenerating(true);    // 🔒 上锁
      try {
        const allVouchers = await getAllVouchers(bookId);
        let maxNum = 0;
        if (Array.isArray(allVouchers)) {
            allVouchers.forEach((v: any) => {
                if (v.voucherType === '记') {
                    const n = parseInt(v.voucherNumber);
                    if (!isNaN(n) && n > maxNum) maxNum = n;
                }
            });
        }

        const rate = parseFloat(taxRate) / 100;

        for (let index = 0; index < entriesList.length; index++) {
            const entry = entriesList[index];
            const subject = subjects.find(s => s.id === entry.categoryId);
            const account = accounts.find(a => a.id === entry.accountId);
            if (!subject || !account) continue;

            const totalAmount = entry.income > 0 ? entry.income : entry.expense;
            let noTaxAmount = totalAmount;
            let taxAmount = 0;

            if (enableTax) {
                noTaxAmount = Number((totalAmount / (1 + rate)).toFixed(2));
                taxAmount = Number((totalAmount - noTaxAmount).toFixed(2));
            }

            let currentTaxSubjectCode = '';
            let currentTaxSubjectName = '';
            
            if (enableTax && taxAmount > 0) {
                const targetCode = entry.income > 0 ? '22210102' : '22210101';
                const fallbackCode = '222101';
                const foundSub = subjects.find(s => s.code === targetCode) || subjects.find(s => s.code === fallbackCode);
                if (foundSub) {
                    currentTaxSubjectCode = foundSub.code;
                    currentTaxSubjectName = foundSub.name;
                }
            }

            const voucherNumber = String(maxNum + index + 1).padStart(3, '0');
            const voucherCode = `记-${voucherNumber}`;
            const fundAux = account.relatedAuxiliaryName || null;
            const partnerAux = entry.partnerName || null;

            const lines: any[] = [];
            
            if (entry.income > 0) {
                lines.push({ 
                    id: `l1-${index}`, summary: entry.summary, 
                    subjectId: account.relatedSubjectId, subjectCode: account.relatedSubjectCode, subjectName: account.relatedSubjectName, 
                    auxiliary: fundAux, debitAmount: entry.income.toFixed(2), creditAmount: '' 
                });
                lines.push({ 
                    id: `l2-${index}`, summary: entry.summary, 
                    subjectId: subject.id, subjectCode: subject.code, subjectName: subject.name, 
                    auxiliary: partnerAux, debitAmount: '', creditAmount: noTaxAmount.toFixed(2) 
                });
                if (enableTax && taxAmount > 0 && currentTaxSubjectCode) {
                    lines.push({ 
                        id: `l3-${index}`, summary: `税金: ${entry.summary}`, 
                        subjectId: '', subjectCode: currentTaxSubjectCode, subjectName: currentTaxSubjectName, 
                        auxiliary: null, debitAmount: '', creditAmount: taxAmount.toFixed(2) 
                    });
                }
            } else {
                lines.push({ 
                    id: `l1-${index}`, summary: entry.summary, 
                    subjectId: subject.id, subjectCode: subject.code, subjectName: subject.name, 
                    auxiliary: partnerAux, debitAmount: noTaxAmount.toFixed(2), creditAmount: '' 
                });
                if (enableTax && taxAmount > 0 && currentTaxSubjectCode) {
                    lines.push({ 
                        id: `l3-${index}`, summary: `税金: ${entry.summary}`, 
                        subjectId: '', subjectCode: currentTaxSubjectCode, subjectName: currentTaxSubjectName, 
                        auxiliary: null, debitAmount: taxAmount.toFixed(2), creditAmount: '' 
                    });
                }
                lines.push({ 
                    id: `l2-${index}`, summary: entry.summary, 
                    subjectId: account.relatedSubjectId, subjectCode: account.relatedSubjectCode, subjectName: account.relatedSubjectName, 
                    auxiliary: fundAux, debitAmount: '', creditAmount: entry.expense.toFixed(2) 
                });
            }

            const voucher = {
                id: `v${Date.now()}-${index}`,
                voucherDate: entry.date,
                voucherType: '记',
                voucherNumber,
                voucherCode,
                attachments: 0,
                lines,
                debitTotal: totalAmount,
                creditTotal: totalAmount,
                status: 'draft', 
                maker: '系统自动',
                isExpanded: false,
                createdAt: new Date().toLocaleString(),
                updatedAt: new Date().toLocaleString()
            };

            await addVoucher(voucher, bookId);
            await updateJournalEntry({ id: entry.id, voucherCode });
        }
        setVoucherGenerationDialogOpen(false);
        setSelectedIds([]);
        handleQuery();
        toast.success(`成功生成 ${entriesList.length} 张凭证`);
      } catch (e) {
          console.error(e);
          toast.error("生成失败");
      }finally {
        setIsGenerating(false); // 🔒 解锁
    }
  };

  const confirmGenerateVouchers = async () => {
    if (isGenerating) return;
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
    if (!currentBookId) return;

    const validEntries = entries.filter(e =>
      selectedIds.includes(e.id) && e.categoryId && !e.voucherCode
    );

    if (validEntries.length === 0) return;

    let shouldMerge = false;
    if (validEntries.length > 1) {
      shouldMerge = window.confirm(`您选择了 ${validEntries.length} 条记录。\n\n【确定】：合并生成一张凭证。\n【取消】：为每条记录单独生成一张凭证。`);
    }

    if (!shouldMerge) {
        await generateSingleVouchers(validEntries, currentBookId);
        return;
    }
    setIsGenerating(true);

    try {
      const firstDate = validEntries[0].date;
      const firstAccountId = validEntries[0].accountId;
      const isConsistent = validEntries.every(e => e.date === firstDate && e.accountId === firstAccountId);

      if (!isConsistent) {
        alert("合并失败：所选记录必须属于【同一天】且【同一个资金账户】才能合并。");
        return;
      }

      const account = accounts.find(a => a.id === firstAccountId);
      if (!account) return;

      const allVouchers = await getAllVouchers(currentBookId);
      let maxVoucherNumber = 0;
      if (Array.isArray(allVouchers)) {
        allVouchers.forEach((v: any) => {
          if (v.voucherType === '记') {
            const num = parseInt(v.voucherNumber);
            if (!isNaN(num) && num > maxVoucherNumber) maxVoucherNumber = num;
          }
        });
      }

      const voucherNumber = String(maxVoucherNumber + 1).padStart(3, '0');
      const voucherCode = `记-${voucherNumber}`;

      let totalDebitCalc = 0;
      let totalCreditCalc = 0;
      const lines: any[] = [];
      const rate = parseFloat(taxRate) / 100;

      for (let i = 0; i < validEntries.length; i++) {
        const entry = validEntries[i];
        const subject = subjects.find(s => s.id === entry.categoryId);
        const auxName = entry.partnerName || null;
        
        const totalAmount = entry.income > 0 ? entry.income : entry.expense;
        let noTaxAmount = totalAmount;
        let taxAmount = 0;

        if (enableTax) {
            noTaxAmount = Number((totalAmount / (1 + rate)).toFixed(2));
            taxAmount = Number((totalAmount - noTaxAmount).toFixed(2));
        }

        let currentTaxSubjectCode = '';
        let currentTaxSubjectName = '';
        if (enableTax && taxAmount > 0) {
            const targetCode = entry.income > 0 ? '22210102' : '22210101';
            const fallbackCode = '222101'; 
            const foundSub = subjects.find(s => s.code === targetCode) || subjects.find(s => s.code === fallbackCode);
            if (foundSub) {
                currentTaxSubjectCode = foundSub.code;
                currentTaxSubjectName = foundSub.name;
            }
        }

        if (entry.income > 0) {
          lines.push({
            id: `l-main-${i}`, summary: entry.summary,
            subjectId: subject?.id || '', subjectCode: subject?.code || '', subjectName: subject?.name || '',
            auxiliary: auxName, debitAmount: '', creditAmount: noTaxAmount.toFixed(2)
          });
          if (enableTax && taxAmount > 0 && currentTaxSubjectCode) {
              lines.push({
                id: `l-tax-${i}`, summary: `税金: ${entry.summary}`,
                subjectId: '', subjectCode: currentTaxSubjectCode, subjectName: currentTaxSubjectName,
                auxiliary: null, debitAmount: '', creditAmount: taxAmount.toFixed(2)
              });
          }
          totalDebitCalc += totalAmount; 
        } else {
          lines.push({
            id: `l-main-${i}`, summary: entry.summary,
            subjectId: subject?.id || '', subjectCode: subject?.code || '', subjectName: subject?.name || '',
            auxiliary: auxName, debitAmount: noTaxAmount.toFixed(2), creditAmount: ''
          });
          if (enableTax && taxAmount > 0 && currentTaxSubjectCode) {
              lines.push({
                id: `l-tax-${i}`, summary: `税金: ${entry.summary}`,
                subjectId: '', subjectCode: currentTaxSubjectCode, subjectName: currentTaxSubjectName,
                auxiliary: null, debitAmount: taxAmount.toFixed(2), creditAmount: ''
              });
          }
          totalCreditCalc += totalAmount; 
        }
      }

      const fundAuxName = account.relatedAuxiliaryName || null;

      if (totalDebitCalc > 0) {
        lines.push({
          id: `l-fund-in`, summary: '汇总收款',
          subjectId: account.relatedSubjectId || '', subjectCode: account.relatedSubjectCode || '', subjectName: account.relatedSubjectName || '',
          auxiliary: fundAuxName, debitAmount: totalDebitCalc.toFixed(2), creditAmount: ''
        });
      }
      if (totalCreditCalc > 0) {
        lines.push({
          id: `l-fund-out`, summary: '汇总付款',
          subjectId: account.relatedSubjectId || '', subjectCode: account.relatedSubjectCode || '', subjectName: account.relatedSubjectName || '',
          auxiliary: fundAuxName, debitAmount: '', creditAmount: totalCreditCalc.toFixed(2)
        });
      }

      const voucher = {
        id: `v${Date.now()}`,
        voucherDate: firstDate,
        voucherType: '记',
        voucherNumber,
        voucherCode,
        attachments: validEntries.length,
        lines,
        debitTotal: Math.max(totalDebitCalc, totalCreditCalc),
        creditTotal: Math.max(totalDebitCalc, totalCreditCalc),
        status: 'draft',
        maker: '系统自动',
        isExpanded: false,
        createdAt: new Date().toLocaleString(),
        updatedAt: new Date().toLocaleString()
      };

      await addVoucher(voucher, currentBookId);
      
      for (const entry of validEntries) {
        await updateJournalEntry({ id: entry.id, voucherCode });
      }

      setVoucherGenerationDialogOpen(false);
      setSelectedIds([]);
      handleQuery();
      toast.success("合并凭证生成成功！");

    } catch (error) {
      console.error(error);
      toast.error('生成凭证失败');
    }finally {
        setIsGenerating(false); // 🔒 解锁
    }
  };

  const handleExport = () => {
    if (entries.length === 0) {
      toast.warning("当前列表无数据可供导出");
      return;
    }

    const currentAccount = accounts.find(a => a.id === filters.accountId);
    const accountName = currentAccount ? currentAccount.accountName : '未命名账户';

    const tableRows: (string | number)[][] = [
      [`${activeTab} - ${accountName}`], 
      [`期间：${filters.dateFrom} 至 ${filters.dateTo}`], 
      [], 
      ["记账日期", "摘要", "对方会计科目", "往来单位", "收入", "支出", "余额", "记账凭证号"] 
    ];

    entries.forEach(entry => {
      tableRows.push([
        entry.date,
        entry.summary,
        entry.categoryName || '-',
        entry.partnerName || '-',
        entry.income || 0,
        entry.expense || 0,
        entry.balance,
        entry.voucherCode || '-'
      ]);
    });

    const totalIncome = entries.reduce((sum, e) => sum + (e.income || 0), 0);
    const totalExpense = entries.reduce((sum, e) => sum + (e.expense || 0), 0);
    tableRows.push([
      "合计", 
      "", 
      "", 
      "", 
      Number(totalIncome.toFixed(2)), 
      Number(totalExpense.toFixed(2)), 
      entries[entries.length - 1].balance, 
      ""
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(tableRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "出纳日记账");

    worksheet['!cols'] = [
      { wch: 15 }, 
      { wch: 30 }, 
      { wch: 25 }, 
      { wch: 20 }, 
      { wch: 15 }, 
      { wch: 15 }, 
      { wch: 15 }, 
      { wch: 15 }, 
    ];

    const fileName = `${activeTab}_${accountName}_${filters.dateFrom}_至_${filters.dateTo}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success("报表导出成功");
  };

  const renderRow = (entry: JournalEntry, index: number) => {
    const isEditing = editingId === entry.id;
    const isLocked = !!entry.voucherCode;

    const getSubjectDisplay = (subjectId: string) => {
      const sub = subjects.find(s => s.id === subjectId);
      return sub ? `${sub.code} ${sub.name}` : (entry.categoryName || '-');
    };

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
              className={`w-36 ${inputClass}`}
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
              className={`min-w-[200px] ${inputClass}`}
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
              <SelectTrigger className={`w-48 ${inputClass}`}>
                <SelectValue placeholder="选择对方科目" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="none">无</SelectItem>
                {subjects.map(sub => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.code} {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className={isLocked ? 'text-gray-500' : 'text-gray-600'}>
              {getSubjectDisplay(entry.categoryId)}
            </span>
          )}
        </TableCell>

        <TableCell>
          {isEditing ? (
            <Select
              value={entry.partnerId || 'none'}
              onValueChange={(value) => updateField(entry.id, 'partnerId', value === 'none' ? '' : value)}
            >
              <SelectTrigger className={`w-36 ${inputClass}`}>
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

        <TableCell className="text-left">
          {isEditing ? (
            <Input
              type="number"
              step="0.01"
              value={entry.income || ''}
              onChange={(e) => updateField(entry.id, 'income', Number(e.target.value))}
              placeholder="0.00"
              className={`w-32 text-left ${inputClass}`} 
            />
          ) : (
            <span className={`${isLocked ? 'text-gray-500' : 'text-green-600'}`}>
              {entry.income > 0 ? entry.income.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}
            </span>
          )}
        </TableCell>

        <TableCell className="text-left">
          {isEditing ? (
            <Input
              type="number"
              step="0.01"
              value={entry.expense || ''}
              onChange={(e) => updateField(entry.id, 'expense', Number(e.target.value))}
              placeholder="0.00"
              className={`w-32 text-left ${inputClass}`}
            />
          ) : (
            <span className={`${isLocked ? 'text-gray-500' : 'text-red-600'}`}>
              {entry.expense > 0 ? entry.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}
            </span>
          )}
        </TableCell>

        <TableCell className="text-left">
          <span className={`font-mono ${
              entry.balance < 0 
                ? 'text-red-600 font-bold' 
                : isLocked ? 'text-gray-600' : 'text-gray-900'
          }`}>
            ¥ {entry.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </span>
        </TableCell>

        <TableCell className="text-center">
          {entry.voucherCode ? (
            <div className="flex items-center justify-center gap-1">
              <span className="text-blue-600">{entry.voucherCode}</span>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button size="sm" onClick={() => saveEdit(entry)} className="h-7 px-2">保存</Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 px-2">取消</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)} disabled={isLocked} className="h-7 w-7 p-0">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(entry)} className="h-7 w-7 p-0">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(entry)} disabled={isLocked} className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ... (JSX 返回部分保持不变) ...
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* ... (Header, Tabs, Filters, Table, Modals) ... */}
      {/* 这里的 JSX 代码和你之前的一模一样，我就不重复占篇幅了，核心逻辑修改都在上面 */}
      {/* 确保你复制的是上面修改过的 loadAccounts 和 initData 等函数逻辑 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">出纳日记账</h1>
        <p className="text-gray-600">
          序时记录资金流入流出，直接关联对方会计科目，一键生成凭证
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as '银行存款' | '现金')} className="mb-4">
        <TabsList>
          <TabsTrigger value="银行存款">银行日记账</TabsTrigger>
          <TabsTrigger value="现金">现金日记账</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="bg-white rounded-lg border p-4 mb-4">
            <div className="grid grid-cols-12 gap-3 mb-3">
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
                <Label>账户名称</Label>
                <Select
                  value={filters.accountId}
                  onValueChange={(value) => setFilters({ ...filters, accountId: value })}
                >
                  <SelectTrigger className={inputClass}>
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
                  <Button onClick={handleQuery} className="flex-1" disabled={isLoading}>
                      {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> : <Search className="w-4 h-4 mr-2" />}
                    查询
                  </Button>
                  <Button variant="outline" onClick={handleAddNew} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    新增
                  </Button>
                  <Button variant="outline" onClick={handleGenerateVouchers} className="flex-1">
                    <FileText className="w-4 h-4 mr-2" />
                    生成凭证
                  </Button>
                  <Button variant="outline" onClick={handleExport} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </Button>
                </div>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 pt-3 border-t">
                <span className="text-sm text-gray-600">已选择 {selectedIds.length} 项</span>
                <Button size="sm" variant="outline" onClick={handleBatchSubject}>
                  批量指定对方科目
                </Button>
              </div>
            )}
          </div>

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
                    <TableHead className="w-[120px]">记账日期</TableHead>
                    <TableHead className="min-w-[200px]">摘要</TableHead>
                    <TableHead className="w-[180px]">对方会计科目</TableHead>
                    <TableHead className="w-[140px]">往来单位</TableHead>
                    <TableHead className="text-left w-[130px]">收入</TableHead>
                    <TableHead className="text-left w-[130px]">支出</TableHead>
                    <TableHead className="text-left w-[140px]">余额</TableHead>
                    <TableHead className="text-left w-[100px]">记账凭证号</TableHead>
                    <TableHead className="text-left w-[140px]">操作</TableHead>
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
                          className={`w-36 ${inputClass}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newEntry.summary || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, summary: e.target.value })}
                          placeholder="输入摘要"
                          className={`min-w-[200px] ${inputClass}`}
                          autoFocus
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={newEntry.categoryId || 'none'}
                          onValueChange={(value) => {
                            const subject = subjects.find(s => s.id === value);
                            setNewEntry({
                              ...newEntry,
                              categoryId: value === 'none' ? '' : value,
                              categoryName: subject ? subject.name : ''
                            });
                          }}
                        >
                          <SelectTrigger className={`w-48 ${inputClass}`}>
                            <SelectValue placeholder="选择对方科目" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            <SelectItem value="none">无</SelectItem>
                            {subjects.map(sub => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.code} {sub.name}
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
                          <SelectTrigger className={`w-36 ${inputClass}`}>
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
                      <TableCell className="text-left">
                        <Input
                          type="number"
                          step="0.01"
                          value={newEntry.income || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, income: Number(e.target.value), expense: 0 })}
                          placeholder="0.00"
                          className={`w-32 text-left ${inputClass}`}
                        />
                      </TableCell>
                      <TableCell className="text-left">
                        <Input
                          type="number"
                          step="0.01"
                          value={newEntry.expense || ''}
                          onChange={(e) => setNewEntry({ ...newEntry, expense: Number(e.target.value), income: 0 })}
                          placeholder="0.00"
                          className={`w-32 text-left ${inputClass}`}
                        />
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={saveNewEntry} className="h-7 px-2">保存</Button>
                          <Button size="sm" variant="outline" onClick={cancelNewEntry} className="h-7 px-2">取消</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                   {entries.length === 0 && !newEntry ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                        {filters.accountId ? "暂无数据" : "请选择账户并点击查询"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry, index) => renderRow(entry, index))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium mb-2">💡 操作提示</div>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>已自动过滤<span className="font-bold">现金及银行存款类科目</span>，如需进行内部户转账，请使用“内部转账”功能。</li>
                    <li>凭证号显示为蓝色的记录已被锁定，删除凭证后刷新列表即可解锁。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 弹窗组件 */}
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

      <Dialog open={batchSubjectDialogOpen} onOpenChange={setBatchSubjectDialogOpen}>
        <DialogContent>
             <DialogHeader>
            <DialogTitle>批量指定对方科目</DialogTitle>
            <DialogDescription>
              为选中的 {selectedIds.length} 笔流水指定对方会计科目
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>选择对方科目 <span className="text-red-500">*</span></Label>
              <Select
                value={selectedSubjectId}
                onValueChange={setSelectedSubjectId}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {subjects.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.code} {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchSubjectDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmBatchSubject}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* ✨ 修复：包含价税分离的生成弹窗 */}
      <Dialog open={voucherGenerationDialogOpen} onOpenChange={setVoucherGenerationDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>生成凭证配置</DialogTitle>
            <DialogDescription>
              配置生成规则，系统将自动拆分金额并生成会计分录。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-1">
                <div className="text-sm text-blue-800 flex justify-between">
                    <span>选中流水：</span>
                    <span className="font-bold">{selectedIds.length} 笔</span>
                </div>
                <div className="text-xs text-blue-600">
                    * 生成后流水将被锁定，需删除凭证才能解锁修改。
                </div>
            </div>

            <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-base">启用自动价税分离</Label>
                        <p className="text-xs text-gray-500">自动将含税总额拆分为“收入/成本”和“税金”</p>
                    </div>
                    <Checkbox 
                        checked={enableTax} 
                        onCheckedChange={(c) => setEnableTax(!!c)}
                        className="h-5 w-5"
                    />
                </div>

                {enableTax && (
                    <div className="bg-gray-50 p-4 rounded-md animate-in fade-in zoom-in-95 duration-200">
                        <div className="grid grid-cols-2 gap-4 items-center">
                            <Label>选择税率</Label>
                            <Select value={taxRate} onValueChange={setTaxRate}>
                                <SelectTrigger className="bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="13">13% (基本税率)</SelectItem>
                                    <SelectItem value="9">9% (交通/建筑等)</SelectItem>
                                    <SelectItem value="6">6% (服务/无形资产)</SelectItem>
                                    <SelectItem value="3">3% (小规模/简易)</SelectItem>
                                    <SelectItem value="1">1% (普惠优惠)</SelectItem>
                                    <SelectItem value="0">0% (免税)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                            <p className="font-medium mb-1">🧮 计算预览 (示例)：</p>
                            <div className="flex justify-between">
                                <span>含税总额：</span>
                                <span>¥ 100.00</span>
                            </div>
                            <div className="flex justify-between text-gray-800">
                                <span>不含税金额：</span>
                                <span>¥ {(100 / (1 + parseFloat(taxRate)/100)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-blue-600">
                                <span>税额 (应交税费)：</span>
                                <span>¥ {(100 - (100 / (1 + parseFloat(taxRate)/100))).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVoucherGenerationDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmGenerateVouchers} className="bg-blue-600 hover:bg-blue-700">
              确认生成凭证
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}