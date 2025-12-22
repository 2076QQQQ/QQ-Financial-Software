import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router'; 
import { 
  ChevronRight, ChevronDown, Wallet, Loader2, Calculator, 
  Plus, Trash2, Lock, AlertCircle, ShieldCheck, CheckCircle2, AlertTriangle, RotateCcw, Save, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// 引入 API
import { 
  batchUpdateInitialBalances,
  deleteInitialBalanceEntry, 
  getAllFundAccounts,
  getAllSubjects,
  getAllAuxiliaryItems,
  getAuxiliaryCategories, 
  completeInitialization,
  getAccountBooks,
  updateAccountBook 
} from '@/lib/mockData';

// --- 辅助工具 ---
const SafeMath = {
  toCents: (val: string | number | undefined) => Math.round(Number(val || 0) * 100),
  toYuan: (cents: number) => (cents / 100).toFixed(2),
  sumBy: <T,>(items: T[], key: keyof T): number => {
    return items.reduce((sum, item) => sum + SafeMath.toCents(item[key] as any), 0);
  }
};

// --- 类型定义 ---
interface Subject { 
    id: string; code: string; name: string; category: string; direction: string; 
    hasAuxiliary: boolean; auxiliaryType?: string; parentId?: string; 
    initialBalance?: number; debitAccumulated?: number; creditAccumulated?: number; 
    accountBookId?: string; 
}
interface AuxiliaryDataEntry { 
    id: string; subjectId: string; auxiliaryItemId: string; name: string; 
    initialBalance: number; debitAccumulated: number; creditAccumulated: number; 
    accountBookId?: string; 
}
interface GlobalAuxiliaryItem { 
    id: string; categoryId: string; category: string; name: string; code: string; isActive: boolean; accountBookId?: string; 
}
interface FundAccount { 
    id: string; accountName: string; accountCode: string; relatedSubjectCode: string; relatedSubjectId: string; initialBalance: number; accountBookId?: string; 
}

// 模拟获取 initialBalances 的 fetch 函数 (如果 mockData 未导出)
const fetchInitialBalances = async (bookId: string) => {
    // 假设后端有这个接口，如果没有，需确保 getAllSubjects 返回了正确数据
    // 这里为了保险，我们复用 mockData 的 client 或者直接 fetch
    try {
        const res = await fetch(`http://localhost:4000/api/initial-balances?accountBookId=${bookId}`);
        if (res.ok) return await res.json();
    } catch (e) { console.warn("Fetch initial balances failed, falling back to subjects"); }
    return [];
};

export default function InitialDataEntry() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;

  const [activeTab, setActiveTab] = useState<'资产' | '负债' | '所有者权益' | '成本' | '损益'>('资产');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  
  // 核心数据状态
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [auxiliaryEntries, setAuxiliaryEntries] = useState<AuxiliaryDataEntry[]>([]);
  const [fundAccounts, setFundAccounts] = useState<FundAccount[]>([]);
  const [globalAuxItems, setGlobalAuxItems] = useState<GlobalAuxiliaryItem[]>([]);
  
  // 账套状态
  const [isBookInitialized, setIsBookInitialized] = useState(false);
  const [isBookClosed, setIsBookClosed] = useState(false); // 结账后锁定
  
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // 试算平衡状态
  const [trialBalance, setTrialBalance] = useState({ debit: 0, credit: 0, diff: 0, isBalanced: true });

  // 构建树形结构
  const buildHierarchy = (rawSubjects: any[]): Subject[] => {
      const list = rawSubjects.map(s => ({ ...s }));
      const codeMap = new Map<string, string>();
      list.forEach(s => codeMap.set(String(s.code), String(s.id)));

      return list.map(subject => {
          const sCode = String(subject.code);
          const sId = String(subject.id);
          
          if (!subject.parentId && sCode.length > 4) {
              const parentCode = sCode.substring(0, sCode.length - 2);
              if (codeMap.has(parentCode)) {
                  subject.parentId = codeMap.get(parentCode);
              }
          }
          return { ...subject, id: sId }; 
      }).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  };

  // 核心初始化逻辑
  const loadData = useCallback(async () => {
      if (!currentBookId) return;
      setLoading(true);

      try {
        console.log(`[InitData] 开始加载数据，bookId: ${currentBookId}`);
        
        // 1. 并行获取所有依赖数据
        const [fundsData, auxItems, auxCats, allSubjectsRaw, books] = await Promise.all([
          getAllFundAccounts(currentBookId),
          getAllAuxiliaryItems(currentBookId),
          getAuxiliaryCategories(currentBookId), 
          getAllSubjects(currentBookId),
          getAccountBooks()
        ]);

        // 2. 尝试获取独立的 initialBalances 表 (数据更准)
        // 注意：这里需要确保你的后端 server.ts 提供了这个 GET 接口，如果没有，请确保 getAllSubjects 返回了最新的 initialBalance
        let rawBalances = [];
        try {
             // 尝试调用后端，如果后端没写这个GET接口，会 fallback 到 catch
             // 也可以直接用 mockData 的 fetch，这里用 fetch 模拟
             const res = await fetch(`http://localhost:4000/api/initial-balances?accountBookId=${currentBookId}`);
             if (res.ok) rawBalances = await res.json();
        } catch (e) {
             console.log("Independent balances fetch failed, relying on subjects data");
        }

        // 3. 确定账套状态
        const currentBook = books?.find((b: any) => b.id === currentBookId);
        if (currentBook) {
            setIsBookInitialized(currentBook.isInitialized);
            setIsBookClosed(currentBook.status === 'closed');
        }

        // 4. 清洗辅助核算档案
        const catMap = new Map<string, string>();
        if (Array.isArray(auxCats)) {
            auxCats.forEach((c: any) => catMap.set(c.id, c.name));
        }
        const validAuxItems = (auxItems || [])
            .filter((i: any) => i.accountBookId === currentBookId)
            .map((item: any) => ({
                ...item,
                category: catMap.get(item.categoryId) || item.category || '未分类'
            }));
        setGlobalAuxItems(validAuxItems);

        // 5. 资金账户
        const validFunds = (fundsData || []).filter((f: any) => f.accountBookId === currentBookId);
        setFundAccounts(validFunds.map((f: any) => ({
          ...f,
          initialBalance: parseFloat(f.initialBalance ?? 0),
          relatedSubjectCode: String(f.relatedSubjectCode || '').trim(),
          relatedSubjectId: f.relatedSubjectId || ''
        })));

        // 6. 整合科目余额数据
        // 逻辑：优先使用 initialBalances 表的数据，如果没有，回退到 subjects 表的字段
        const validSubjectsAll = (allSubjectsRaw || []).filter((s: any) => s.accountBookId === currentBookId);
        
        // 提取辅助核算明细数据 (如果有独立表 rawBalances，优先用；否则用 subjects 里的)
        const auxEntriesMap = new Map<string, any[]>();
        
        // 如果有独立的 initialBalances 记录，用它们
        if (rawBalances.length > 0) {
            rawBalances.forEach((b: any) => {
                if (b.auxiliaryItemId) { // 是辅助明细
                    const list = auxEntriesMap.get(b.subjectId) || [];
                    list.push(b);
                    auxEntriesMap.set(b.subjectId, list);
                } else {
                    // 是科目本身余额，更新 validSubjectsAll
                    const sub = validSubjectsAll.find((s:any) => s.id === b.subjectId);
                    if (sub) sub.initialBalance = b.initialBalance;
                }
            });
        }

        // 构造辅助核算数组
        const mappedAuxEntries: AuxiliaryDataEntry[] = [];
        
        // 如果 rawBalances 没读到，看看 subjects 里是否有潜藏的
        // (通常 batchUpdate 后端会存入 initialBalances 表，所以主要依赖 rawBalances)
        
        // 将 Map 展平
        auxEntriesMap.forEach((list, subjectId) => {
            list.forEach(entry => {
                mappedAuxEntries.push({
                    id: entry.id || `loaded-${Math.random()}`,
                    subjectId: String(entry.subjectId), 
                    auxiliaryItemId: entry.auxiliaryItemId,
                    name: validAuxItems?.find((a: any) => a.id === entry.auxiliaryItemId)?.name || '未知项目',
                    initialBalance: parseFloat(entry.initialBalance || 0),
                    debitAccumulated: 0,
                    creditAccumulated: 0,
                    accountBookId: currentBookId 
                });
            });
        });
        setAuxiliaryEntries(mappedAuxEntries);

        // 7. 构造科目树
        const subjectIdsWithAux = new Set(mappedAuxEntries.map(e => e.subjectId));

        const preMappedSubjects = validSubjectsAll
          .filter((s: any) => s.isActive) 
          .map((s: any) => {
            const sId = String(s.id);
            const forceHasAux = subjectIdsWithAux.has(sId);
            const auxList = s.auxiliaryItems || [];
            
            return {
              ...s,
              id: sId,
              parentId: s.parentId || null,
              category: s.category, 
              hasAuxiliary: forceHasAux || (auxList.length > 0) || false,
              auxiliaryType: auxList.length > 0 ? auxList[0] : undefined, 
              initialBalance: parseFloat(s.initialBalance || 0),
              debitAccumulated: parseFloat(s.debitAccumulated || 0),
              creditAccumulated: parseFloat(s.creditAccumulated || 0),
            };
          });
        
        const finalSubjects = buildHierarchy(preMappedSubjects);
        setSubjects(finalSubjects);
        
        // 8. 默认展开有数据的节点
        const rootIds = finalSubjects.filter(s => !s.parentId).map(s => s.id);
        setExpandedIds(prev => [...new Set([...prev, ...Array.from(subjectIdsWithAux), ...rootIds])]);

      } catch (error) {
        console.error("Init failed", error);
        toast.error("数据加载失败");
      } finally {
        setLoading(false);
      }
  }, [currentBookId]);

  useEffect(() => {
    if (router.isReady && currentBookId) {
        loadData();
    }
  }, [router.isReady, currentBookId, loadData]); 

  // 计算显示金额（递归累加）
  const getSubjectDisplayBalance = useCallback((subject: Subject, field: 'initialBalance' | 'debitAccumulated' | 'creditAccumulated' = 'initialBalance'): number => {
    // 1. 优先：关联的资金账户
    const relatedAccs = fundAccounts.filter(acc => {
         if (acc.relatedSubjectId === subject.id) return true;
         // 兼容按 Code 匹配
         const sCode = String(subject.code);
         const aCode = String(acc.relatedSubjectCode);
         // 如果资金账户关联的是 100201，当前科目是 1002，则不直接加，而是等 100201 自己加完后通过 children 汇总
         // 这里只处理直接关联
         return aCode === sCode;
    });
    
    if (relatedAccs.length > 0 && field === 'initialBalance') {
      return parseFloat(SafeMath.toYuan(SafeMath.sumBy(relatedAccs, 'initialBalance')));
    }

    // 2. 其次：辅助核算明细
    if (subject.hasAuxiliary) {
      const myEntries = auxiliaryEntries.filter(a => a.subjectId === subject.id);
      if (myEntries.length > 0) {
         return parseFloat(SafeMath.toYuan(SafeMath.sumBy(myEntries, field)));
      }
    }

    // 3. 再次：子科目汇总
    const children = subjects.filter(s => s.parentId === subject.id);
    if (children.length > 0) {
      const childrenSumCents = children.reduce((sum, child) => sum + SafeMath.toCents(getSubjectDisplayBalance(child, field)), 0);
      return parseFloat(SafeMath.toYuan(childrenSumCents));
    }

    // 4. 最后：自身录入值
    return subject[field] || 0;
  }, [fundAccounts, auxiliaryEntries, subjects]);

  // 实时试算平衡 (依赖 getSubjectDisplayBalance)
  useEffect(() => {
      if (subjects.length === 0) return;

      let debitTotal = 0;
      let creditTotal = 0;

      // 寻找所有顶层科目进行汇总
      const topLevel = subjects.filter(s => !s.parentId);
      
      topLevel.forEach(s => {
          const val = SafeMath.toCents(getSubjectDisplayBalance(s, 'initialBalance'));
          if (s.direction === '借') debitTotal += val;
          else creditTotal += val;
      });

      const diff = Math.abs(debitTotal - creditTotal);
      setTrialBalance({
          debit: debitTotal / 100,
          credit: creditTotal / 100,
          diff: diff / 100,
          isBalanced: diff < 1
      });
  }, [subjects, auxiliaryEntries, fundAccounts, getSubjectDisplayBalance]);

  const toggleExpand = (id: string, e: React.MouseEvent) => { 
    e.stopPropagation(); 
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); 
  };
  const selectRow = (id: string) => setSelectedRowId(id);
  
  const updateSubjectData = (id: string, field: keyof Subject, value: string) => {
    if (isBookClosed) return; // 锁定
    const numValue = parseFloat(value) || 0;
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: numValue } : s));
  };

  const updateAuxiliaryEntry = (entryId: string, field: keyof AuxiliaryDataEntry, value: string) => {
    if (isBookClosed) return; // 锁定
    setAuxiliaryEntries(prev => prev.map(item => {
      if (item.id !== entryId) return item;
      
      if (field === 'auxiliaryItemId') {
        const selected = globalAuxItems.find(g => g.id === value);
        return { 
          ...item, 
          auxiliaryItemId: value, 
          name: selected?.name || '' 
        };
      } else { 
        return { ...item, [field]: parseFloat(value) || 0 }; 
      }
    }));
  };

  const addAuxiliaryEntry = (subjectId: string, auxType: string | undefined) => {
    if (isBookClosed) return; 
    if (!auxType) { toast.error("该科目未设置辅助核算类别"); return; }

    const availableItems = globalAuxItems.filter(g => g.category === auxType && g.isActive);
    if (availableItems.length === 0) {
      alert(`暂无【${auxType}】档案数据。\n\n请先前往“系统设置 -> 辅助核算”中添加档案。`);
      return;
    }

    setAuxiliaryEntries(prev => [...prev, { 
      id: `new-${Date.now()}`, 
      subjectId, 
      auxiliaryItemId: '', 
      name: '', 
      initialBalance: 0, 
      debitAccumulated: 0, 
      creditAccumulated: 0,
      accountBookId: currentBookId || undefined
    }]);

    if (!expandedIds.includes(subjectId)) setExpandedIds(prev => [...prev, subjectId]);
  };

  const removeAuxiliaryEntry = async (entryId: string) => {
    if (isBookClosed) return;
    
    if (entryId.startsWith('new-')) {
        setAuxiliaryEntries(prev => prev.filter(item => item.id !== entryId));
        return;
    }

    if (!window.confirm("确定删除此条明细吗？删除后需点击保存以生效。")) return;
    try {
        await deleteInitialBalanceEntry(entryId); 
        setAuxiliaryEntries(prev => prev.filter(item => item.id !== entryId));
        toast.success("已删除");
    } catch (e) { toast.error("删除失败"); }
  };

  const handleSaveAndCheck = async () => {
    if (isBookClosed) { toast.error("账套已结账，无法修改期初数据"); return; }

    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
    if (!currentBookId) return;

    setIsSaving(true);
    try {
      // 1. 准备科目数据 (非辅助核算的科目余额)
      // 我们需要把所有有余额的科目都保存下来
      // 注意：如果有子科目，父科目的余额由后端计算或前端计算后只存子科目
      // 这里采用策略：只保存末级科目的余额
      const leafSubjects = subjects.filter(s => {
          const hasChildren = subjects.some(child => child.parentId === s.id);
          const hasAux = auxiliaryEntries.some(a => a.subjectId === s.id);
          // 如果有辅助核算，主科目的 initialBalance 应该为 0（由 auxiliary 表承担），或者存总额
          // 为了避免重复，如果有辅助核算，subject 表里存 0
          return !hasChildren && !hasAux; 
      });

      const subjectPayload = leafSubjects.map(s => ({
        subjectId: s.id,
        initialBalance: s.initialBalance || 0,
        debitAccumulated: s.debitAccumulated || 0,
        creditAccumulated: s.creditAccumulated || 0,
        auxiliaryItemId: null, // 无辅助
        accountBookId: currentBookId 
      }));

      // 2. 准备辅助核算数据
      const validAuxEntries = auxiliaryEntries.filter(entry => entry.auxiliaryItemId);
      const auxPayload = validAuxEntries.map(entry => ({
        id: entry.id.startsWith('new-') ? undefined : entry.id, // 新增的不传ID，更新的传ID
        subjectId: entry.subjectId,
        initialBalance: entry.initialBalance,
        debitAccumulated: entry.debitAccumulated,
        creditAccumulated: entry.creditAccumulated,
        auxiliaryItemId: entry.auxiliaryItemId,
        accountBookId: currentBookId
      }));

      const finalPayload = [...subjectPayload, ...auxPayload];
      
      await batchUpdateInitialBalances(finalPayload);

      // 检查平衡
      if (trialBalance.isBalanced) {
      // 情况 1：第一次初始化且平衡 -> 弹窗引导启用
      if (!isBookInitialized) {
        toast.success("数据保存成功，试算平衡！");
        setShowSuccessDialog(true); // 显示启用账套对话框
      } 
      // 情况 2：已启用的账套，再次保存 -> 仅提示
      else {
        toast.success("保存成功，试算平衡！✅");
      }
    } else {
      // 不平衡的情况
      toast.warning(`保存成功，但试算不平衡！差额：${trialBalance.diff}`, {
        duration: 5000
      });
    }
      
      // 重新加载以确保 ID 同步
      loadData(); 

    } catch (e) { 
        console.error(e);
        toast.error('保存失败，请重试'); 
    } finally { setIsSaving(false); }
  };
  
  const handleConfirmComplete = async () => {
    if (!currentBookId) return;
    try { 
        await completeInitialization(currentBookId); 
        toast.success("账套启用成功！");
        setIsBookInitialized(true);
        router.push(`/app/${currentBookId}/dashboard`); 
    } catch (e) { 
        toast.error('启用失败'); 
    }
  };

  const handleReset = async () => {
      if (isBookClosed) return toast.error("已结账状态下无法重置");
      if (!confirm("重新初始化不会删除已录入的数据，但允许您重新调整设置。\n确定要继续吗？")) return;
      if (!currentBookId) return;
      try {
           await updateAccountBook({ 
              id: currentBookId, 
              isInitialized: false
          });
          setIsBookInitialized(false);
          toast.success("已切换回初始化状态");
      } catch (e) {
          toast.error("操作失败");
      }
  };

  const renderSubjectRows = (categorySubjects: Subject[]) => {
    const rows: any[] = [];
    const topLevel = categorySubjects.filter(s => !s.parentId);

    topLevel.forEach(subject => {
      const children = subjects.filter(s => s.parentId === subject.id);
      const relatedAccs = fundAccounts.filter(acc => acc.relatedSubjectId === subject.id);
      const hasFundAccounts = relatedAccs.length > 0;
      const myEntries = auxiliaryEntries.filter(a => a.subjectId === subject.id);
      const hasAux = subject.hasAuxiliary;
      const hasAuxData = myEntries.length > 0;
      const hasChildren = children.length > 0;

      const showExpand = hasChildren || hasFundAccounts || hasAux;
      const isExpanded = expandedIds.includes(subject.id);
      const isSelected = selectedRowId === subject.id;

      const displayInitial = getSubjectDisplayBalance(subject, 'initialBalance');
      const debitAcc = getSubjectDisplayBalance(subject, 'debitAccumulated');
      const creditAcc = getSubjectDisplayBalance(subject, 'creditAccumulated');
      
      const initialCents = SafeMath.toCents(displayInitial);
      const debitCents = SafeMath.toCents(debitAcc);
      const creditCents = SafeMath.toCents(creditAcc);
      let resultCents = subject.direction === '借' ? initialCents - debitCents + creditCents : initialCents - creditCents + debitCents;
      const yearBeginStr = SafeMath.toYuan(resultCents);

      const isLocked = hasFundAccounts || hasChildren || hasAuxData || isBookClosed; 
      const isInputDisabled = isBookClosed || hasFundAccounts || hasChildren || hasAuxData;

      rows.push(
        <TableRow key={subject.id} className={`cursor-pointer border-b border-gray-100 ${isSelected ? 'bg-blue-50/80 border-l-4 border-l-blue-600' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`} onClick={() => selectRow(subject.id)}>
          <TableCell>
             <div className="flex items-center">
              {showExpand ? (
                <button onClick={(e) => toggleExpand(subject.id, e)} className="mr-2 p-1 hover:bg-gray-200 rounded">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500"/> : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                </button>
              ) : <span className="w-8"/>}
              <span className={hasFundAccounts ? "font-medium text-blue-700" : "font-medium text-gray-900"}>{subject.code}</span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span className={hasFundAccounts ? "text-blue-700 font-medium" : "text-gray-700"}>{subject.name}</span>
              {hasFundAccounts && <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-50 text-blue-700 px-1 py-0">资金</Badge>}
              {hasAux && <Badge variant="outline" className="text-[10px] border-orange-200 bg-orange-50 text-orange-700 px-1 py-0">辅助</Badge>}
            </div>
          </TableCell>
          <TableCell><Badge variant="secondary" className="text-xs font-normal">{subject.direction}</Badge></TableCell>
          <TableCell>
             <div className="relative">
              <Input type="number" value={displayInitial === 0 ? '' : displayInitial} onChange={(e) => !isInputDisabled && updateSubjectData(subject.id, 'initialBalance', e.target.value)} disabled={isInputDisabled} className={isInputDisabled ? "bg-gray-100 text-gray-500 border-transparent cursor-not-allowed pl-8 h-8 text-right font-bold" : "bg-white border-gray-300 h-8 text-right font-medium shadow-sm"} placeholder="0.00"/>
              {isInputDisabled && <Lock className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />}
            </div>
          </TableCell>
          <TableCell><Input type="number" value={debitAcc===0?'':debitAcc} onChange={(e) => !isInputDisabled && updateSubjectData(subject.id, 'debitAccumulated', e.target.value)} disabled={isInputDisabled} className={isInputDisabled?"bg-gray-100 text-gray-500 border-transparent h-8 text-right":"bg-white border-gray-300 h-8 text-right shadow-sm"}/></TableCell>
          <TableCell><Input type="number" value={creditAcc===0?'':creditAcc} onChange={(e) => !isInputDisabled && updateSubjectData(subject.id, 'creditAccumulated', e.target.value)} disabled={isInputDisabled} className={isInputDisabled?"bg-gray-100 text-gray-500 border-transparent h-8 text-right":"bg-white border-gray-300 h-8 text-right shadow-sm"}/></TableCell>
          <TableCell><span className="text-gray-600 font-mono text-sm block text-right pr-3">{yearBeginStr}</span></TableCell>
        </TableRow>
      );

      // 渲染子级内容
      if (isExpanded) {
          // 子科目
          if (hasChildren) {
             const childRows = renderSubjectRows(children);
             rows.push(
                <TableRow key={`child-container-${subject.id}`}>
                    <TableCell colSpan={7} className="p-0 border-none">
                        <div className="pl-6 border-l-2 border-gray-100 ml-4">
                            <Table className="border-collapse"><TableBody>{childRows}</TableBody></Table>
                        </div>
                    </TableCell>
                </TableRow>
             );
          }

          // 资金账户提示
          if (hasFundAccounts) {
              rows.push(
                <TableRow key={`tip-${subject.id}`} className="bg-blue-50/30 h-8 border-none">
                  <TableCell colSpan={7} className="py-1 px-12 text-xs text-blue-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1"/> 数据源于资金账户 (请去资金账户页面修改)
                  </TableCell>
                </TableRow>
              );
              relatedAccs.forEach(acc => {
                rows.push(
                  <TableRow key={`fa-${acc.id}`} className="bg-blue-50/30 border-none hover:bg-blue-50">
                    <TableCell><div className="pl-12 text-xs text-gray-500 flex items-center"><Wallet className="w-3 h-3 mr-1"/>{acc.accountCode}</div></TableCell>
                    <TableCell className="text-sm text-blue-900">{acc.accountName}</TableCell>
                    <TableCell className="text-xs text-center text-gray-400">借</TableCell>
                    <TableCell><Input disabled value={acc.initialBalance} className="h-7 bg-white/50 text-gray-600 border-transparent text-right font-medium" /></TableCell>
                    <TableCell colSpan={3} className="text-center text-xs text-gray-400">--</TableCell>
                  </TableRow>
                );
              });
          }

          // 辅助核算明细
          if (hasAux) {
             const availableAux = globalAuxItems.filter(g => g.category === subject.auxiliaryType && g.isActive);
             rows.push(
               <TableRow key={`action-aux-${subject.id}`} className="bg-orange-50/30 h-8 border-none">
                <TableCell colSpan={7} className="py-1 pl-12">
                  <Button disabled={isBookClosed} variant="ghost" size="sm" onClick={() => addAuxiliaryEntry(subject.id, subject.auxiliaryType)} className="h-6 text-xs text-orange-700 hover:bg-orange-100 px-2 -ml-2">
                    <Plus className="w-3 h-3 mr-1"/> 添加【{subject.auxiliaryType}】明细
                  </Button>
                </TableCell>
              </TableRow>
            );
             myEntries.forEach(item => {
              rows.push(
                <TableRow key={item.id} className="bg-orange-50/20 hover:bg-orange-50 border-none">
                  <TableCell><div className="pl-12 text-xs text-gray-400">明细</div></TableCell>
                  <TableCell>
                     <Select disabled={isBookClosed} value={item.auxiliaryItemId} onValueChange={(val) => updateAuxiliaryEntry(item.id, 'auxiliaryItemId', val)}>
                       <SelectTrigger className="h-7 w-full bg-white border-orange-200 text-xs">
                         <SelectValue placeholder={`选择${subject.auxiliaryType}...`} />
                       </SelectTrigger>
                       <SelectContent>
                         {availableAux.length === 0 ? <div className="p-2 text-xs text-gray-500 text-center">暂无数据</div> : availableAux.map(opt => <SelectItem key={opt.id} value={opt.id} className="text-xs">{opt.code} - {opt.name}</SelectItem>)}
                       </SelectContent>
                     </Select>
                  </TableCell>
                  <TableCell className="text-xs text-center text-gray-400">{subject.direction}</TableCell>
                  <TableCell><Input disabled={isBookClosed} type="number" step="0.01" value={item.initialBalance===0?'':item.initialBalance} onChange={(e) => updateAuxiliaryEntry(item.id, 'initialBalance', e.target.value)} className="h-7 bg-white border-orange-200 text-right text-xs" placeholder="0.00"/></TableCell>
                  <TableCell><Input disabled={isBookClosed} type="number" step="0.01" value={item.debitAccumulated===0?'':item.debitAccumulated} onChange={(e) => updateAuxiliaryEntry(item.id, 'debitAccumulated', e.target.value)} className="h-7 bg-white border-orange-200 text-right text-xs"/></TableCell>
                  <TableCell><Input disabled={isBookClosed} type="number" step="0.01" value={item.creditAccumulated===0?'':item.creditAccumulated} onChange={(e) => updateAuxiliaryEntry(item.id, 'creditAccumulated', e.target.value)} className="h-7 bg-white border-orange-200 text-right text-xs"/></TableCell>
                  <TableCell className="text-right pr-2">
                    <Button disabled={isBookClosed} variant="ghost" size="icon" onClick={() => removeAuxiliaryEntry(item.id)} className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="w-3 h-3"/>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            });
          }
      }
    });
    return rows;
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-20 p-6 space-y-6">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-3">
                    期初数据录入
                    {isBookClosed ? (
                        <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200"><Lock className="w-3 h-3 mr-1"/> 已锁定 (已结账)</Badge>
                    ) : isBookInitialized ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/> 已启用</Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200"><AlertCircle className="w-3 h-3 mr-1"/> 初始化中</Badge>
                    )}
                </h1>
                <p className="text-gray-500 text-sm">
                    录入科目在建账日期的期初余额。
                </p>
            </div>
            <div className="flex gap-2">
                {!isBookClosed && isBookInitialized && (
                     <Button variant="outline" size="sm" onClick={handleReset} className="text-gray-600">
                        <RotateCcw className="w-4 h-4 mr-2"/> 重新初始化
                     </Button>
                )}
                <Button onClick={handleSaveAndCheck} disabled={isSaving || isBookClosed} className="bg-blue-600 hover:bg-blue-700">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                    保存数据
                </Button>
            </div>
        </div>

        {isBookClosed && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <Lock className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                    <strong>账套已结账，期初数据已被锁定保护。</strong><br/>
                    如需修改期初余额，请先前往 <span className="underline cursor-pointer font-bold hover:text-red-950" onClick={()=>router.push(`/app/${currentBookId}/accounting/PeriodClosing`)}>期末结转</span> 页面执行“反结账”操作。
                </div>
            </div>
        )}

        {/* 试算平衡条 */}
        <div className={`rounded-lg border p-4 flex items-center justify-between shadow-sm transition-colors ${trialBalance.isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
             <div className="flex gap-8">
                 <div className="space-y-1">
                     <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">借方合计</span>
                     <div className="text-xl font-mono font-bold text-gray-900">¥ {trialBalance.debit.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                 </div>
                 <div className="space-y-1">
                     <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">贷方合计</span>
                     <div className="text-xl font-mono font-bold text-gray-900">¥ {trialBalance.credit.toLocaleString('zh-CN', {minimumFractionDigits: 2})}</div>
                 </div>
             </div>
             
             <div className="text-right">
                 {trialBalance.isBalanced ? (
                     <div className="flex items-center text-green-700 font-bold gap-2">
                         <CheckCircle2 className="w-6 h-6"/> 试算平衡
                     </div>
                 ) : (
                     <div className="flex items-center text-red-700 font-bold gap-2">
                         <AlertTriangle className="w-6 h-6"/> 
                         <span>不平衡 (差额: {trialBalance.diff.toLocaleString()})</span>
                     </div>
                 )}
             </div>
        </div>

        {/* 标签页与表格 */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
          <div className="flex justify-between bg-white p-1 rounded-lg border shadow-sm sticky top-0 z-10">
            <TabsList className="bg-transparent h-9">
                {['资产', '负债', '所有者权益', '成本', '损益'].map(t => (
                    <TabsTrigger key={t} value={t} className="data-[state=active]:bg-gray-100 data-[state=active]:text-blue-700 font-medium text-sm px-4">{t}</TabsTrigger>
                ))}
            </TabsList>
          </div>
          
          {['资产', '负债', '所有者权益', '成本', '损益'].map((cat) => (
             <TabsContent key={cat} value={cat} className="mt-0">
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50 border-b border-gray-200 h-10">
                                <TableHead className="w-[180px] pl-4">科目编码</TableHead>
                                <TableHead className="w-[220px]">科目名称</TableHead>
                                <TableHead className="w-[80px]">方向</TableHead>
                                <TableHead className="w-[150px] text-right pr-4 text-blue-700 font-bold">期初余额</TableHead>
                                <TableHead className="w-[130px] text-right pr-4">本年借方</TableHead>
                                <TableHead className="w-[130px] text-right pr-4">本年贷方</TableHead>
                                <TableHead className="w-[140px] text-right pr-4 text-gray-400">年初余额</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-20 text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2"/>加载中...</TableCell></TableRow>
                            ) : (
                                renderSubjectRows(subjects.filter(s => s.category === activeTab))
                            )}
                        </TableBody>
                    </Table>
                </div>
             </TabsContent>
          ))}
        </Tabs>

<Dialog open={showSuccessDialog && !isBookInitialized} onOpenChange={setShowSuccessDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        试算平衡通过
                    </DialogTitle>
                    <DialogDescription>
                        所有科目期初余额借贷平衡，数据已保存成功！
                        <br/>
                        <strong className="text-slate-900 mt-2 block">
                            是否立即启用账套开始记账？
                        </strong>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-between">
                    <Button 
                        variant="outline" 
                        onClick={() => setShowSuccessDialog(false)}
                        className="text-slate-600"
                    >
                        稍后启用
                    </Button>
                    <Button 
                        onClick={handleConfirmComplete} 
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        启用账套
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}