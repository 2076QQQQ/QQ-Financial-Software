import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Search, Loader2, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Decimal from 'decimal.js';
import {
  getFundAccounts,
  getJournalEntries,
  getAllVouchers,
} from '@/lib/mockData';
import { toast } from 'sonner';

// 基础映射关系
interface AccountSubjectMapping {
  accountId: string;
  accountName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  initialDate: string;
  initialBalance: number;
  relatedAuxiliaryId?: string;
  relatedAuxiliaryName?: string; 
  accountBookId?: string; // 新增：用于调试或校验
}

// 左右对照行数据结构
interface ComparisonRow {
  mappingId: string; // accountId
  accountName: string;
  subjectDisplayName: string;
  auxiliaryName?: string; 
  
  // 左侧：出纳账户数据
  accInitial: number;
  accIncome: number;
  accExpense: number;
  accEnd: number;

  // 右侧：总账科目数据
  subInitial: number;
  subDebit: number;
  subCredit: number;
  subEnd: number;

  // 差异 (账户 - 科目)
  diffInitial: number;
  diffIncome: number; // 借方差异
  diffExpense: number; // 贷方差异
  diffEnd: number;     // 期末差异 (核心指标)
}

export default function ReconciliationReport() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = (Array.isArray(bookId) ? bookId[0] : bookId) || '';

  const [filters, setFilters] = useState({
    dateFrom: new Date().getFullYear() + '-01-01',
    dateTo: new Date().toISOString().split('T')[0]
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDrilling, setIsDrilling] = useState(false);

  // 状态
  const [mappings, setMappings] = useState<AccountSubjectMapping[]>([]);
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  
  // 差异明细
  const [diffDetails, setDiffDetails] = useState<{onlyInJournal: any[], onlyInLedger: any[]}>({ onlyInJournal: [], onlyInLedger: [] });

  // Dialogs
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [selectedMappings, setSelectedMappings] = useState<string[]>([]); 
  const [showDifferenceDialog, setShowDifferenceDialog] = useState(false);
  
  // 1. 初始化 (核心修复点)
  useEffect(() => {
    if (!router.isReady || !currentBookId) return;
    
    const init = async () => {
      try {
        const fundAccounts = await getFundAccounts(currentBookId);
        
        // ★★★ 核心修复：前端过滤，只保留当前账套的资金账户 ★★★
        // 防止后端没有严格过滤 fundAccounts 接口时出现串账
        const validAccounts = (fundAccounts || []).filter((acc: any) => 
            !acc.accountBookId || acc.accountBookId === currentBookId
        );

        // 自动建立映射
        const autoMappings: AccountSubjectMapping[] = validAccounts.map((acc: any) => ({
          accountId: acc.id,
          accountName: acc.accountName,
          subjectId: acc.relatedSubjectId,
          subjectCode: acc.relatedSubjectCode,
          subjectName: acc.relatedSubjectName,
          initialDate: acc.initialDate || '2020-01-01', 
          initialBalance: Number(acc.initialBalance || 0),
          relatedAuxiliaryId: acc.relatedAuxiliaryId,
          relatedAuxiliaryName: acc.relatedAuxiliaryName,
          accountBookId: acc.accountBookId
        }));
        
        setMappings(autoMappings);
        // 默认全选
        setSelectedMappings(autoMappings.map(m => m.accountId));
      } catch (error) {
        console.error("初始化失败", error);
        toast.error("加载账户数据失败");
      }
    };
    init();
  }, [router.isReady, currentBookId]);
  
  const toggleMapping = (accountId: string) => {
    if (selectedMappings.includes(accountId)) {
      setSelectedMappings(selectedMappings.filter(id => id !== accountId));
    } else {
      setSelectedMappings([...selectedMappings, accountId]);
    }
  };
  
  const getPreviousDay = (dateStr: string): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  // 2. 核心查询逻辑
  const handleQuery = async () => {
    if (!currentBookId) return;

    const selectedAccounts = mappings.filter(m => selectedMappings.includes(m.accountId));
    if (selectedAccounts.length === 0) {
      toast.warning('请先选择要核对的账户');
      return;
    }
    
    setIsLoading(true);
    setComparisonRows([]);

    try {
        // 获取所有凭证 (并再次过滤账套)
        const allVouchersRaw = await getAllVouchers(currentBookId);
        const approvedVouchers = (allVouchersRaw || []).filter((v: any) => 
            v.status === 'approved' && v.accountBookId === currentBookId
        );

        const promises = selectedAccounts.map(async (mapping) => {
            const prevDay = getPreviousDay(filters.dateFrom);
            
            // 获取日记账 (getJournalEntries 内部应该已经传了 accountBookId，但也可能没传)
            // 这里我们假设 API 已经安全了，或者前端二次过滤
            const [beforePeriodEntries, periodEntries] = await Promise.all([
                getJournalEntries(currentBookId, mapping.accountId, mapping.initialDate, prevDay),
                getJournalEntries(currentBookId, mapping.accountId, filters.dateFrom, filters.dateTo)
            ]);

            // --- 1. 左侧：账户数据 (出纳) ---
            const beforeIncome = beforePeriodEntries.reduce((sum: number, e: any) => new Decimal(sum).plus(e.income || 0).toNumber(), 0);
            const beforeExpense = beforePeriodEntries.reduce((sum: number, e: any) => new Decimal(sum).plus(e.expense || 0).toNumber(), 0);
            const accInitial = new Decimal(mapping.initialBalance || 0).plus(beforeIncome).minus(beforeExpense).toNumber();

            const accIncome = periodEntries.reduce((sum: number, e: any) => new Decimal(sum).plus(e.income || 0).toNumber(), 0);
            const accExpense = periodEntries.reduce((sum: number, e: any) => new Decimal(sum).plus(e.expense || 0).toNumber(), 0);
            const accEnd = new Decimal(accInitial).plus(accIncome).minus(accExpense).toNumber();

            // --- 2. 右侧：科目数据 (凭证) ---
            const beforeVouchers = approvedVouchers.filter((v: any) => v.voucherDate >= mapping.initialDate && v.voucherDate < filters.dateFrom);
            const periodVouchers = approvedVouchers.filter((v: any) => v.voucherDate >= filters.dateFrom && v.voucherDate <= filters.dateTo);

            const calcVoucherSum = (vouchers: any[], isPeriod: boolean) => {
                let debit = 0, credit = 0; 
                
                vouchers.forEach(v => {
                    v.lines?.forEach((line: any) => {
                        const isSubMatch = String(line.subjectCode) === String(mapping.subjectCode);
                        
                        const lineAux = line.auxiliary || line.auxiliaryName || line.partnerName || "";
                        const isAuxMatch = !mapping.relatedAuxiliaryName || lineAux === mapping.relatedAuxiliaryName;

                        if (isSubMatch && isAuxMatch) {
                            debit = new Decimal(debit).plus(Number(line.debitAmount) || 0).toNumber();
                            credit = new Decimal(credit).plus(Number(line.creditAmount) || 0).toNumber();
                        } 
                    });
                });
                return { debit, credit }; 
            };

            const beforeSum = calcVoucherSum(beforeVouchers, false);
            const periodSum = calcVoucherSum(periodVouchers, true);

            // 科目期初
            const subInitial = new Decimal(mapping.initialBalance || 0).plus(beforeSum.debit).minus(beforeSum.credit).toNumber();
            
            // 科目本期
            const subDebit = periodSum.debit;
            const subCredit = periodSum.credit;
            const subEnd = new Decimal(subInitial).plus(subDebit).minus(subCredit).toNumber();

            // --- 3. 构造对照行 ---
            const row: ComparisonRow = {
                mappingId: mapping.accountId,
                accountName: mapping.accountName,
                subjectDisplayName: `${mapping.subjectCode} ${mapping.subjectName}`,
                auxiliaryName: mapping.relatedAuxiliaryName,
                
                accInitial, accIncome, accExpense, accEnd,
                subInitial, subDebit, subCredit, subEnd,

                // 差异计算
                diffInitial: new Decimal(accInitial).minus(subInitial).toNumber(),
                diffIncome: new Decimal(accIncome).minus(subDebit).toNumber(),
                diffExpense: new Decimal(accExpense).minus(subCredit).toNumber(),
                diffEnd: new Decimal(accEnd).minus(subEnd).toNumber(),
            };
            return row;
        });

        const rows = await Promise.all(promises);
        setComparisonRows(rows);

    } catch (error) {
        console.error("查询失败", error);
        toast.error("查询核对数据失败");
    } finally {
        setIsLoading(false);
    }
  };
  
  // 3. 差异明细查询
  const handleDrillDownDifference = async () => {
    if (!currentBookId) return;
    setIsDrilling(true);
    try {
        const onlyInJournal: any[] = []; 
        const onlyInLedger: any[] = []; 
        
        const selectedAccounts = mappings.filter(m => selectedMappings.includes(m.accountId));
        const allVouchers = await getAllVouchers(currentBookId);
        
        // 同样增加账套过滤
        const approvedVouchers = (allVouchers || []).filter((v: any) => 
            v.status === 'approved' &&
            v.accountBookId === currentBookId &&
            v.voucherDate >= filters.dateFrom &&
            v.voucherDate <= filters.dateTo
        );

        for (const mapping of selectedAccounts) {
            // A. 查出纳账
            const periodEntries = await getJournalEntries(currentBookId, mapping.accountId, filters.dateFrom, filters.dateTo);
            
            // 1. 找 "出纳有，总账无"
            periodEntries.forEach((entry: any) => {
                if (!entry.voucherCode) {
                    onlyInJournal.push({ ...entry, accountName: mapping.accountName, status: '未生成凭证' });
                } else {
                    const voucher = approvedVouchers.find((v: any) => v.voucherCode === entry.voucherCode);
                    if (!voucher) {
                         // 这里的判断要小心，如果 voucherCode 存在但找不到 voucher，可能是被删了，或者 voucher 未审核
                         const rawVoucher = allVouchers.find((v:any) => v.voucherCode === entry.voucherCode);
                         if (!rawVoucher) {
                             onlyInJournal.push({ ...entry, accountName: mapping.accountName, status: '凭证被删除' });
                         } else if (rawVoucher.status !== 'approved') {
                             onlyInJournal.push({ ...entry, accountName: mapping.accountName, status: '凭证未审核' });
                         }
                    }
                }
            });
        }

        // B. 找 "总账有，出纳无"
        const allJournalVoucherCodes = new Set();
        const journalPromises = selectedAccounts.map(m => getJournalEntries(currentBookId, m.accountId, filters.dateFrom, filters.dateTo));
        const journalResults = await Promise.all(journalPromises);
        journalResults.flat().forEach((e: any) => {
            if(e.voucherCode) allJournalVoucherCodes.add(e.voucherCode);
        });

        approvedVouchers.forEach((voucher: any) => {
            if (!allJournalVoucherCodes.has(voucher.voucherCode)) {
                voucher.lines.forEach((line: any) => {
                    const isRelated = selectedAccounts.some(m => {
                        const codeMatch = String(m.subjectCode) === String(line.subjectCode);
                        let auxMatch = true;
                        if (m.relatedAuxiliaryName) {
                             const lineAux = line.auxiliary || '';
                             if (!lineAux.includes(m.relatedAuxiliaryName)) auxMatch = false;
                        }
                        return codeMatch && auxMatch;
                    });

                    if (isRelated) {
                        onlyInLedger.push({
                            date: voucher.voucherDate,
                            voucherCode: voucher.voucherCode,
                            summary: line.summary,
                            subjectName: line.subjectName,
                            auxiliary: line.auxiliary, 
                            debitAmount: parseFloat(line.debitAmount) || 0,
                            creditAmount: parseFloat(line.creditAmount) || 0
                        });
                    }
                });
            }
        });

        setDiffDetails({ onlyInJournal, onlyInLedger });
        setShowDifferenceDialog(true);
    } catch (e) {
        console.error(e);
        toast.error("分析差异明细失败");
    } finally {
        setIsDrilling(false);
    }
  };

  const fmt = (n: number) => Math.abs(n) < 0.01 ? '-' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  const isDiff = (n: number) => Math.abs(n) > 0.01;

  const totalRow = comparisonRows.reduce((acc, row) => ({
      accInitial: acc.accInitial + row.accInitial,
      accEnd: acc.accEnd + row.accEnd,
      subInitial: acc.subInitial + row.subInitial,
      subEnd: acc.subEnd + row.subEnd,
      diffEnd: acc.diffEnd + row.diffEnd
  }), { accInitial: 0, accEnd: 0, subInitial: 0, subEnd: 0, diffEnd: 0 });

  return (
    <div className="max-w-[1600px] mx-auto pb-10">
      <div className="mb-6 flex justify-between items-end">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
               <ArrowRightLeft className="w-6 h-6 text-blue-600"/>
               资金账务核对表
           </h1>
           <p className="text-gray-600 text-sm">
             左侧为出纳日记账，右侧为总账会计凭证，自动比对期初、发生额及期末余额
           </p>
        </div>
      </div>
      
      {/* 筛选栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>日期区间（起）</Label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>日期区间（止）</Label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
          <div className="col-span-8 space-y-2 flex items-end">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowMappingDialog(true)}>
                选择账户 ({selectedMappings.length})
              </Button>
              <Button onClick={handleQuery} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 w-32">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Search className="w-4 h-4 mr-2" />}
                执行核对
              </Button>
              
              {comparisonRows.length > 0 && isDiff(totalRow.diffEnd) && (
                 <Button variant="destructive" onClick={handleDrillDownDifference} disabled={isDrilling} className="ml-4">
                    {isDrilling ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <AlertCircle className="w-4 h-4 mr-2" />}
                    查看差异原因
                 </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 数据列表 */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="w-[200px] border-r">账户 / 科目</TableHead>
              <TableHead colSpan={2} className="text-center border-r bg-green-50 text-green-700 font-bold">出纳日记账 (资金)</TableHead>
              <TableHead colSpan={2} className="text-center border-r bg-blue-50 text-blue-700 font-bold">总账 (凭证)</TableHead>
              <TableHead className="text-right text-gray-900 font-bold">核对结果</TableHead>
            </TableRow>
            <TableRow className="bg-gray-50 text-xs">
              <TableHead className="border-r">名称</TableHead>
              <TableHead className="text-right bg-green-50/50">期初余额</TableHead>
              <TableHead className="text-right border-r bg-green-50/50">期末余额</TableHead>
              <TableHead className="text-right bg-blue-50/50">期初余额</TableHead>
              <TableHead className="text-right border-r bg-blue-50/50">期末余额</TableHead>
              <TableHead className="text-right">余额差额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>数据计算中...</TableCell></TableRow>
            ) : comparisonRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-gray-400">暂无数据</TableCell></TableRow>
            ) : (
                comparisonRows.map((row) => (
                  <TableRow key={row.mappingId} className="hover:bg-gray-50 group">
                    <TableCell className="border-r">
                        <div className="font-bold text-gray-800">{row.accountName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{row.subjectDisplayName}</div>
                        {row.auxiliaryName && (
                            <div className="text-xs text-indigo-600 mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                                {row.auxiliaryName}
                            </div>
                        )}
                    </TableCell>
                    
                    <TableCell className="text-right font-mono bg-green-50/10 text-gray-600">{fmt(row.accInitial)}</TableCell>
                    <TableCell className="text-right font-mono border-r bg-green-50/10 font-medium text-gray-900">{fmt(row.accEnd)}</TableCell>
                    
                    <TableCell className="text-right font-mono bg-blue-50/10 text-gray-600">{fmt(row.subInitial)}</TableCell>
                    <TableCell className="text-right font-mono border-r bg-blue-50/10 font-medium text-gray-900">{fmt(row.subEnd)}</TableCell>
                    
                    <TableCell className="text-right font-mono">
                        {isDiff(row.diffEnd) ? (
                            <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">
                                {row.diffEnd > 0 ? '+' : ''}{row.diffEnd.toFixed(2)}
                            </span>
                        ) : (
                            <span className="text-green-600 text-xs font-bold flex items-center justify-end gap-1">
                                <AlertCircle className="w-3 h-3"/> 平
                            </span>
                        )}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 账户选择弹窗 */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent>
           <DialogHeader><DialogTitle>选择核对账户</DialogTitle></DialogHeader>
           <div className="py-4 max-h-[300px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader><TableRow><TableHead className="w-12"></TableHead><TableHead>账户</TableHead><TableHead>关联科目</TableHead></TableRow></TableHeader>
              <TableBody>
                {mappings.map(m => (
                  <TableRow key={m.accountId}>
                    <TableCell><Checkbox checked={selectedMappings.includes(m.accountId)} onCheckedChange={() => toggleMapping(m.accountId)} /></TableCell>
                    <TableCell>
                        {m.accountName}
                        {m.relatedAuxiliaryName && <span className="block text-xs text-indigo-500">{m.relatedAuxiliaryName}</span>}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{m.subjectCode} {m.subjectName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button onClick={() => setShowMappingDialog(false)}>确定</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 差异明细弹窗 */}
      <Dialog open={showDifferenceDialog} onOpenChange={setShowDifferenceDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
           <DialogHeader><DialogTitle>差异明细分析</DialogTitle></DialogHeader>
           <div className="flex-1 overflow-y-auto space-y-6 py-2 pr-2">
             <div>
                 <h3 className="font-bold text-orange-700 mb-2 text-sm flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                     出纳日记账有，但总账未体现 (漏记凭证)
                 </h3>
                 {diffDetails.onlyInJournal.length === 0 ? <div className="text-xs text-gray-400 pl-4">无差异</div> : (
                     <Table>
                         <TableHeader className="bg-orange-50"><TableRow><TableHead>日期</TableHead><TableHead>摘要</TableHead><TableHead className="text-right">金额</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
                         <TableBody>{diffDetails.onlyInJournal.map((e,i)=>(<TableRow key={i}><TableCell>{e.date}</TableCell><TableCell>{e.summary}</TableCell><TableCell className="text-right">{(e.income||e.expense).toFixed(2)}</TableCell><TableCell>{e.status}</TableCell></TableRow>))}</TableBody>
                     </Table>
                 )}
             </div>
             <div>
                 <h3 className="font-bold text-blue-700 mb-2 text-sm flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                     总账有凭证，但出纳账未登记 (漏登日记账)
                 </h3>
                 {diffDetails.onlyInLedger.length === 0 ? <div className="text-xs text-gray-400 pl-4">无差异</div> : (
                     <Table>
                         <TableHeader className="bg-blue-50"><TableRow><TableHead>日期</TableHead><TableHead>凭证号</TableHead><TableHead>科目/辅助</TableHead><TableHead className="text-right">金额</TableHead></TableRow></TableHeader>
                         <TableBody>{diffDetails.onlyInLedger.map((e,i)=>(
                             <TableRow key={i}>
                                 <TableCell>{e.date}</TableCell>
                                 <TableCell>{e.voucherCode}</TableCell>
                                 <TableCell>
                                     <div className="text-xs">{e.subjectName}</div>
                                     {e.auxiliary && <div className="text-xs text-indigo-500">{e.auxiliary}</div>}
                                 </TableCell>
                                 <TableCell className="text-right">{(e.debitAmount||e.creditAmount).toFixed(2)}</TableCell>
                             </TableRow>
                         ))}</TableBody>
                     </Table>
                 )}
             </div>
           </div>
           <DialogFooter><Button onClick={() => setShowDifferenceDialog(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}