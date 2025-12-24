import { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; 
import { 
  Plus, Edit, Trash2, Search, ArrowRight, Loader2, 
  Wallet, Tag, Info, RefreshCw, Lock, AlertTriangle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from 'sonner';

// 引入 API
import { 
  getAllFundAccounts, 
  addFundAccount, 
  updateFundAccount,
  deleteFundAccount,
  getAllSubjects,
  updateAccountBook,
  getAllAuxiliaryItems, 
  getAuxiliaryCategories,
  getJournalEntries, // 👈 用于检查是否被引用
  getAccountBooks    // 👈 用于检查账套状态
} from '@/lib/mockData';

// --- 类型定义 ---
interface Subject {
  id: string;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  isLeaf: boolean; 
  auxiliaryItems?: string[]; 
  accountBookId?: string; 
}

interface AuxiliaryItem {
  id: string;
  categoryId: string; 
  categoryName?: string; 
  name: string;
  code: string;
  isActive: boolean;
  accountBookId?: string;
}

interface AuxCategory {
    id: string;
    name: string;
    accountBookId?: string;
}

interface FundAccount {
  id: string;
  accountType: '银行存款' | '现金';
  accountCode: string;
  accountName: string;
  bankCardNumber?: string;
  initialDate: string;
  initialBalance: number;
  
  relatedSubjectId: string;
  relatedSubjectCode: string;
  relatedSubjectName: string;
  
  relatedAuxiliaryId?: string;   
  relatedAuxiliaryName?: string; 

  status: '启用' | '停用';
  
  // 前端计算属性
  isReferenced?: boolean;    // 是否已有流水
  isInitialLocked?: boolean; // 是否锁定余额
  accountBookId?: string; 
}

export default function FundAccountManagement() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;

  const [isNextLoading, setIsNextLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'银行存款' | '现金'>('银行存款');
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  
  // 依赖数据
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]); 
  const [allAuxiliaryItems, setAllAuxiliaryItems] = useState<AuxiliaryItem[]>([]); 
  const [auxCategories, setAuxCategories] = useState<AuxCategory[]>([]);

  // 状态控制
  const [isLoading, setIsLoading] = useState(false);
  const [isBookClosed, setIsBookClosed] = useState(false); // 账套是否已结账
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FundAccount | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 表单
  const [formData, setFormData] = useState({
    accountCode: '',
    accountName: '',
    bankCardNumber: '',
    initialDate: new Date().toISOString().split('T')[0],
    initialBalance: '0',
    relatedSubjectId: '',
    relatedAuxiliaryId: '',
    status: '启用' as '启用' | '停用'
  });

  // --- 核心逻辑 1: 加载数据与锁定状态计算 ---
  const loadAccounts = async () => {
    if (!currentBookId) return;
    setIsLoading(true);
    try {
      // 并行获取：资金账户、日记账流水、账套信息
      const [accountsData, journalsData, booksData] = await Promise.all([
          getAllFundAccounts(currentBookId),
          getJournalEntries(currentBookId), // 获取所有流水以检查引用
          getAccountBooks()
      ]);
      
      // 1. 检查账套状态
      const currentBook = (booksData || []).find((b: any) => b.id === currentBookId);
      const closed = currentBook?.status === 'closed';
      setIsBookClosed(closed);

      // 2. 处理账户数据
      const filteredData = (accountsData || [])
        .filter((a: any) => a.accountBookId === currentBookId)
        .map((account: FundAccount) => {
            // 检查是否被引用：如果在日记账中出现了该账户ID，说明已经做过业务了
            const isReferenced = (journalsData || []).some((j: any) => j.accountId === account.id);
            
            return {
                ...account,
                isReferenced: isReferenced,
                // ★★★ 核心严谨逻辑 ★★★
                // 如果已结账 OR 已被引用，则必须锁定期初余额，防止破坏数据一致性
                isInitialLocked: closed || isReferenced 
            };
        });
      
      setAccounts(filteredData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("加载数据失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (router.isReady && currentBookId) {
        loadAccounts();
    }
  }, [router.isReady, currentBookId]);

  // --- 加载下拉菜单依赖 ---
  const loadDependencies = async () => {
    if (!currentBookId) return;

    try {
      const [allSubjectsRaw, auxItemsRaw, auxCatsRaw] = await Promise.all([
          getAllSubjects(currentBookId),
          getAllAuxiliaryItems(currentBookId),
          getAuxiliaryCategories(currentBookId)
      ]);
      
      const bookSubjects = (allSubjectsRaw || []).filter((s: any) => s.accountBookId === currentBookId);
      const bookAuxItems = (auxItemsRaw || []).filter((i: any) => i.accountBookId === currentBookId);
      const bookAuxCats = (auxCatsRaw || []).filter((c: any) => c.accountBookId === currentBookId);

      setAuxCategories(bookAuxCats);

      const processedAuxItems = bookAuxItems.map((item: any) => {
          const cat = bookAuxCats.find((c: any) => c.id === item.categoryId);
          return {
              ...item,
              categoryName: cat ? cat.name : '未知'
          };
      });
      setAllAuxiliaryItems(processedAuxItems);

      const allCodes = bookSubjects.map((s: any) => String(s.code));
      const processedSubjects = bookSubjects
        .map((s: any) => {
            const currentCode = String(s.code);
            const isLeaf = !allCodes.some((otherCode: string) => 
                otherCode !== currentCode && otherCode.startsWith(currentCode)
            );
            return { ...s, isLeaf };
        })
        .filter((s: any) => {
            const codeStr = String(s.code);
            if (!s.isActive || !s.isLeaf) return false;
            if (s.accountBookId !== currentBookId) return false; 
            return activeTab === '银行存款' ? codeStr.startsWith('1002') : codeStr.startsWith('1001');
        })
        .sort((a: any, b: any) => a.code.localeCompare(b.code));
      
      setAvailableSubjects(processedSubjects);

    } catch (e) {
      console.error("加载依赖数据失败", e);
    }
  };

  const generateAccountCode = (accountType: '银行存款' | '现金'): string => {
    const prefix = accountType === '银行存款' ? 'BA' : 'CA'; 
    const existing = accounts.filter(a => a.accountType === accountType);
    const maxNum = existing.length > 0 
      ? Math.max(...existing.map(a => {
          const num = parseInt(a.accountCode.replace(prefix, ''));
          return isNaN(num) ? 0 : num;
        }))
      : 0;
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  // --- 事件处理 ---

  const handleAdd = async () => {
    await loadDependencies();
    setEditTarget(null);
    setFormData({
      accountCode: generateAccountCode(activeTab),
      accountName: '',
      bankCardNumber: '',
      initialDate: new Date().toISOString().split('T')[0],
      initialBalance: '0',
      relatedSubjectId: '',
      relatedAuxiliaryId: '',
      status: '启用'
    });
    setShowModal(true);
  };

  const handleEdit = async (account: FundAccount) => {
    await loadDependencies();
    setEditTarget(account);
    setFormData({
      accountCode: account.accountCode,
      accountName: account.accountName,
      bankCardNumber: account.bankCardNumber || '',
      initialDate: account.initialDate,
      initialBalance: String(account.initialBalance || 0), 
      relatedSubjectId: account.relatedSubjectId,
      relatedAuxiliaryId: account.relatedAuxiliaryId || '',
      status: account.status
    });
    setShowModal(true);
  };

  // --- 核心逻辑 2: 保存与跳转 ---
  const handleSave = async () => {
    if (!currentBookId) return;

    const inputName = formData.accountName.trim();
    
    // 基础校验
    if (!inputName) { toast.error('请输入账户名称'); return; }
    if (!formData.relatedSubjectId) { toast.error('请选择关联会计科目'); return; }
    if (activeTab === '银行存款' && !formData.bankCardNumber.trim()) { toast.error('请输入银行卡号'); return; }

    // 重复校验
    const isNameDuplicate = accounts.some(acc => 
        acc.accountName === inputName && 
        acc.id !== editTarget?.id 
    );
    if (isNameDuplicate) { toast.error("账户名称已存在，请重新输入"); return; }

    const isCodeDuplicate = accounts.some(acc => 
        acc.accountCode === formData.accountCode && 
        acc.id !== editTarget?.id
    );
    if (isCodeDuplicate) { toast.error("账户编码已存在，请重新输入"); return; }

    const selectedSubject = availableSubjects.find(s => s.id === formData.relatedSubjectId);
    
    if (selectedSubject && selectedSubject.auxiliaryItems && selectedSubject.auxiliaryItems.length > 0) {
        if (!formData.relatedAuxiliaryId) {
            toast.error(`该科目已开启【${selectedSubject.auxiliaryItems.join(',')}】辅助核算，请选择对应项目。`);
            return;
        }
    }

    const selectedAuxItem = allAuxiliaryItems.find(i => i.id === formData.relatedAuxiliaryId);

    // ★★★ 变动检测逻辑 ★★★
    const newBalance = parseFloat(formData.initialBalance) || 0;
    let hasBalanceChange = false;

    if (editTarget) {
        // 编辑模式：只有当余额真的变了，且这个变动是允许的（未锁定），才标记为变动
        const oldBalance = Number(editTarget.initialBalance) || 0;
        // 注意：如果 isInitialLocked 为 true，下面的 updateFundAccount 会忽略 initialBalance，所以这里也不用管
        if (!editTarget.isInitialLocked && Math.abs(newBalance - oldBalance) > 0.01) {
            hasBalanceChange = true;
        }
    } else {
        // 新增模式：只要录入了不为0的余额，就视为变动
        if (Math.abs(newBalance) > 0.01) {
            hasBalanceChange = true;
        }
    }

    setIsSaving(true);
    try {
      const payload = {
        accountType: activeTab, 
        accountCode: formData.accountCode, 
        accountName: formData.accountName,
        bankCardNumber: activeTab === '银行存款' ? formData.bankCardNumber : undefined,
        
        initialBalance: newBalance,
        initialDate: formData.initialDate,
        
        relatedSubjectId: formData.relatedSubjectId,
        relatedSubjectCode: String(selectedSubject?.code || '').trim(),
        relatedSubjectName: selectedSubject ? `${selectedSubject.code} ${selectedSubject.name}` : '',
        
        relatedAuxiliaryId: formData.relatedAuxiliaryId || null,
        relatedAuxiliaryName: selectedAuxItem ? selectedAuxItem.name : null,

        status: formData.status,
        accountBookId: currentBookId 
      };

      if (editTarget) {
        await updateFundAccount(editTarget.id, {
            ...payload,
            // 🔒 如果已锁定，强制使用旧数据，防止前端被绕过
            initialBalance: editTarget.isInitialLocked ? editTarget.initialBalance : payload.initialBalance,
            initialDate: editTarget.isInitialLocked ? editTarget.initialDate : payload.initialDate,
        });
      } else {
        await addFundAccount(payload, currentBookId);
      }

      // ★★★ 智能跳转 ★★★
      if (hasBalanceChange) {
          toast.warning("资金期初余额已变更，系统将跳转至【期初数据】进行试算平衡...", { duration: 4000 });
          setTimeout(() => {
              // Next.js 相对路径跳转
              router.push(`/app/${currentBookId}/settings/initial-data`);
          }, 1500);
      } else {
          toast.success(editTarget ? "账户已更新" : "账户已创建");
          await loadAccounts(); 
          setShowModal(false);
      }

    } catch (error) {
      console.error("保存失败", error);
      toast.error("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // --- 核心逻辑 3: 删除与跳转 ---
  const handleDelete = async (account: FundAccount) => {
    // 严谨校验
    if (account.isReferenced) {
        toast.error("该账户已存在业务流水（日记账），禁止删除！请先删除相关凭证和流水。");
        return;
    }
    
    // 余额不为0时的删除警告
    const hasBalance = Math.abs(Number(account.initialBalance)) > 0;
    if (hasBalance) {
       if (!confirm(`该账户有期初余额 ¥${account.initialBalance}。\n删除后可能导致账套不平衡，确定要删除吗？`)) {
           return;
       }
    }

    if (account.status === '启用') {
        toast.error("请先将账户状态设为‘停用’后才能删除");
        return;
    }

    if (!window.confirm(`确定要物理删除账户 "${account.accountName}" 吗？此操作不可恢复。`)) return;

    try {
      await deleteFundAccount(account.id);
      
      // ★★★ 如果删了有钱的账户，也要去试算平衡 ★★★
      if (hasBalance) {
          toast.warning("已删除含有余额的账户，正在跳转至试算平衡页面...", { duration: 3000 });
          setTimeout(() => {
              router.push(`/app/${currentBookId}/settings/initial-data`);
          }, 1500);
      } else {
          toast.success("删除成功");
          await loadAccounts(); 
      }
    } catch (error) {
      toast.error("删除失败");
    }
  };

  const handleCompleteAndNext = async () => {
    if (!currentBookId) return;
    setIsNextLoading(true);
    try {
      await updateAccountBook({ id: currentBookId, fundsConfigured: true });
      router.push(`/app/${currentBookId}/settings/initial-data`);
    } catch (error) {
      router.push(`/app/${currentBookId}/settings/initial-data`);
    } finally {
      setIsNextLoading(false);
    }
  };

  const currentSubject = availableSubjects.find(s => s.id === formData.relatedSubjectId);
  const requiredAuxCategoryName = currentSubject?.auxiliaryItems?.[0]; 
  
  const filteredAuxOptions = requiredAuxCategoryName 
      ? allAuxiliaryItems.filter(i => i.categoryName === requiredAuxCategoryName && i.isActive && i.accountBookId === currentBookId)
      : [];

  const filteredAccounts = accounts.filter(a => 
    a.accountType === activeTab &&
    (a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     a.accountCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* 头部标题与刷新 */}
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-blue-600"/> 
              资金账户管理
            </h1>
            <p className="text-gray-500 text-xs mt-1">
                配置企业银行账户和现金账，系统将自动关联生成日记账。
            </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAccounts} disabled={isLoading} className="h-8">
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
        </Button>
      </div>

      {/* 温馨提示 */}
      <Alert variant="default" className="bg-blue-50/60 border-blue-100 text-blue-900 p-3 flex items-start">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="ml-3">
            <AlertTitle className="text-sm font-bold text-blue-800 mb-1">温馨提示</AlertTitle>
            <AlertDescription className="text-sm text-blue-700 leading-relaxed">
            系统会自动隔离不同账套的资金数据。若账户已有业务发生或账套已结账，期初余额将锁定不可修改。
            </AlertDescription>
        </div>
      </Alert>

      {/* 核心 Tab 区域 */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-0">
        <div className="flex items-center justify-between bg-white p-2 rounded-t-lg border-x border-t border-gray-200">
          <TabsList className="bg-gray-100/80 h-9 p-1">
            <TabsTrigger value="银行存款" className="text-xs sm:text-sm px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">银行存款</TabsTrigger>
            <TabsTrigger value="现金" className="text-xs sm:text-sm px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">现金</TabsTrigger>
          </TabsList>
          <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 h-8 text-sm shadow-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            新增{activeTab === '银行存款' ? '账户' : '现金'}
          </Button>
        </div>

        {['银行存款', '现金'].map((tabName) => (
          <TabsContent key={tabName} value={tabName} className="mt-0">
            <div className="bg-white border-x border-b border-gray-200 rounded-b-lg shadow-sm overflow-hidden min-h-[400px]">
              {/* 搜索栏 */}
              <div className="p-3 border-b flex justify-between items-center bg-gray-50/30">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="搜索账户编码或名称..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white h-9 text-sm"
                  />
                </div>
              </div>

              {/* 列表 */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-100 hover:bg-gray-50">
                    <TableHead className="w-[120px] font-semibold text-gray-700">编码</TableHead>
                    <TableHead className="font-semibold text-gray-700">账户名称</TableHead>
                    {tabName === '银行存款' && <TableHead className="font-semibold text-gray-700">银行卡号</TableHead>}
                    <TableHead className="text-right font-semibold text-gray-700">期初余额</TableHead>
                    <TableHead className="font-semibold text-gray-700">关联科目</TableHead>
                    <TableHead className="font-semibold text-gray-700">辅助核算</TableHead>
                    <TableHead className="font-semibold text-gray-700">状态</TableHead>
                    <TableHead className="text-right pr-6 font-semibold text-gray-700">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-20 text-gray-400"><Loader2 className="animate-spin w-8 h-8 mx-auto mb-3 text-blue-200"/>加载中...</TableCell></TableRow>
                  ) : filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-20 text-gray-400">
                          <div className="flex flex-col items-center">
                              <span className="text-gray-400 mb-2">暂无数据</span>
                              <Button variant="outline" size="sm" onClick={handleAdd}>立即添加</Button>
                          </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((account) => (
                      <TableRow key={account.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-mono text-gray-600 font-medium">{account.accountCode}</TableCell>
                        <TableCell className="font-medium text-gray-900">{account.accountName}</TableCell>
                        {tabName === '银行存款' && (
                          <TableCell className="font-mono text-gray-500 text-xs">{account.bankCardNumber || '-'}</TableCell>
                        )}
                        <TableCell className="text-right font-mono text-blue-700 font-medium relative group">
                          ¥{Number(account.initialBalance).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                          {/* 悬停提示：显示锁定状态 */}
                          {account.isInitialLocked && (
                              <Lock className="w-3 h-3 text-gray-300 absolute top-1/2 -translate-y-1/2 right-[-15px]" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{account.relatedSubjectName}</TableCell>
                        
                        <TableCell>
                            {account.relatedAuxiliaryName ? (
                                <Badge variant="secondary" className="font-normal text-xs bg-indigo-50 text-indigo-700 border-indigo-100 flex w-fit items-center gap-1">
                                    <Tag className="w-3 h-3"/>
                                    {account.relatedAuxiliaryName}
                                </Badge>
                            ) : <span className="text-gray-300">-</span>}
                        </TableCell>

                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`font-normal ${account.status === '启用' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500'}`}
                          >
                            {account.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={() => handleEdit(account)} 
      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
    >
      <Edit className="w-4 h-4" />
    </Button>
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={() => handleDelete(account)} 
      // 这里的 disabled 只是视觉上的，实际拦截在 onClick 里的 handleDelete 逻辑中
      className={`h-8 w-8 transition-colors ${account.isReferenced ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700 hover:bg-red-50'}`}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  </div>
</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 新增/编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? `编辑账户` : `新增账户`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs text-gray-500">账户编码</Label>
                <Input value={formData.accountCode} disabled className="bg-gray-50 text-gray-600 h-9 font-mono" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs text-gray-500">账户名称 <span className="text-red-500">*</span></Label>
                <Input 
                    value={formData.accountName} 
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })} 
                    placeholder="例如：招商银行基本户"
                    className="h-9 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            {/* 关联科目区域 */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4 relative">
               <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-800">关联会计科目 <span className="text-red-500">*</span></Label>
                  <Select 
                      value={formData.relatedSubjectId} 
                      onValueChange={(value) => {
                          const isTaken = accounts.some(a => a.relatedSubjectId === value && a.id !== editTarget?.id);
                          if (isTaken) {
                              toast.warning("该科目已经被其他资金账户绑定！强烈建议一个账户对应一个子科目。");
                          }
                          setFormData({ 
                              ...formData, 
                              relatedSubjectId: value,
                              relatedAuxiliaryId: '' 
                          });
                      }}
                      // 如果已经发生了业务，禁止修改科目，否则账就乱了
                      disabled={editTarget?.isInitialLocked}
                  >
                    <SelectTrigger className={`bg-white h-9 ${editTarget?.isInitialLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <SelectValue placeholder="请选择对应科目" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                           <span className="font-mono mr-2 text-gray-500">{s.code}</span>
                           {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">
                      {editTarget?.isInitialLocked ? "账户已有业务发生或账套已结账，禁止修改科目。" : "只能选择当前账套下的末级科目。"}
                  </p>
                </div>

               {/* 动态渲染：辅助核算选择框 */}
               {requiredAuxCategoryName && (
                   <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 pt-2 border-t border-slate-200">
                      <Label className="text-indigo-700 flex items-center gap-1 font-medium text-sm">
                          <Tag className="w-3.5 h-3.5"/> 
                          绑定{requiredAuxCategoryName} <span className="text-red-500">*</span>
                      </Label>
                      
                      <div className="flex gap-2">
                          <Select 
                            value={formData.relatedAuxiliaryId} 
                            onValueChange={(v) => setFormData({ ...formData, relatedAuxiliaryId: v })}
                            disabled={editTarget?.isInitialLocked}
                          >
                            <SelectTrigger className={`bg-white h-9 focus:ring-indigo-500 ${!formData.relatedAuxiliaryId ? 'border-red-300' : 'border-indigo-200'} ${editTarget?.isInitialLocked ? 'opacity-50' : ''}`}>
                                <SelectValue placeholder={`请选择归属的${requiredAuxCategoryName}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredAuxOptions.length === 0 ? (
                                    <div className="p-3 text-sm text-center text-gray-500">
                                        <p>当前账套暂无“{requiredAuxCategoryName}”档案</p>
                                    </div>
                                ) : (
                                    filteredAuxOptions.map(opt => (
                                        <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                          </Select>
                      </div>
                   </div>
               )}
            </div>

            {/* 银行卡号 */}
            {activeTab === '银行存款' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">银行卡号</Label>
                <Input 
                    value={formData.bankCardNumber} 
                    onChange={(e) => setFormData({ ...formData, bankCardNumber: e.target.value })} 
                    placeholder="输入卡号后4位即可"
                    className="h-9"
                />
              </div>
            )}

            {/* 期初数据区域 (严谨控制) */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5 relative">
                <Label className="text-xs text-gray-500">
                    期初余额 
                    {editTarget?.isInitialLocked && <span className="text-red-500 ml-1 text-[10px]">(已锁定)</span>}
                </Label>
                <div className="relative">
                    <Input 
                        type="number" 
                        className={`h-9 font-mono ${editTarget?.isInitialLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} 
                        value={formData.initialBalance} 
                        onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })} 
                        // ✅ 这里的 disabled 是真正生效的
                        disabled={editTarget?.isInitialLocked} 
                    />
                    {editTarget?.isInitialLocked && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                            <Lock className="w-3.5 h-3.5"/>
                        </div>
                    )}
                </div>
                {/* 业务解释文案 */}
                <p className="text-[10px] text-gray-400 leading-tight">
                    注：仅录入<span className="font-bold">建账日</span>当天的余额。<br/>
                    如果是<span className="text-blue-600">年中新开户</span>，请填 0，并通过“内部转账”或“凭证”录入资金。
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">启用日期</Label>
                <Input type="date" className="h-9" value={formData.initialDate} onChange={(e) => setFormData({ ...formData, initialDate: e.target.value })} disabled={editTarget?.isInitialLocked} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 pt-4 border-t flex justify-end">
        <Button 
            size="default" 
            className="bg-gray-900 text-white hover:bg-gray-800" 
            onClick={handleCompleteAndNext} 
            disabled={isNextLoading}
        >
          {isNextLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          完成，下一步
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}