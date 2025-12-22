import { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; 
import FundAnalysis from './FundAnalysis'; 

import { 
  Card, CardHeader, CardTitle,CardContent
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, TrendingUp, Clock, AlertCircle, 
  ArrowRight, BookOpen, Loader2, PieChart, Wallet, ArrowRightLeft
} from 'lucide-react';
import { 
  Table, TableBody, TableCell, TableRow 
} from '@/components/ui/table';

import { 
  getAllVouchers, 
  getJournalEntries, 
  getFundAccounts,
  me 
} from '@/lib/mockData';

export default function DashboardPage() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;

  // --- 状态管理 ---
  const [loading, setLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const [setupStatus, setSetupStatus] = useState({
    hasAccountBook: false,
    hasSubjects: false,
    hasFundAccounts: false,
    hasInitialBalances: false
  });
  
  const [financialData, setFinancialData] = useState({
    totalBalance: 0,
    monthInflow: 0, 
    monthOutflow: 0 
  });

  const [pnlData, setPnlData] = useState({
    revenue: 0,
    expense: 0,
    netProfit: 0
  });

  const [todoItems, setTodoItems] = useState({
    pendingVouchers: 0,
    unclassifiedTransactions: 0,
    accountsToReconcile: 0 
  });

  const [chartDataRaw, setChartDataRaw] = useState({
    entries: [] as any[],
    monthStartBalance: 0
  });

  // 1. 检查状态
  useEffect(() => {
    const checkStatus = async () => {
        try {
            const data = await me(); 
            if (data && data.company) {
                setSetupStatus({
                    hasAccountBook: data.company.has_account_book,
                    hasSubjects: data.company.has_subjects_configured,
                    hasFundAccounts: data.company.has_fund_accounts,
                    hasInitialBalances: data.company.has_initial_balances
                });
            }
        } catch (e) {
            console.error("获取系统状态失败", e);
        } finally {
            setIsCheckingStatus(false);
        }
    };
    checkStatus();
  }, []);

  const isFullyUnlocked = 
    setupStatus.hasAccountBook && 
    setupStatus.hasSubjects && 
    setupStatus.hasFundAccounts && 
    setupStatus.hasInitialBalances;

  // 2. 加载数据
  useEffect(() => {
    if (router.isReady && currentBookId && isFullyUnlocked) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, currentBookId, isFullyUnlocked]); 

  const onNavigate = (path: string) => {
      if (!currentBookId) return;
      router.push(`/app/${currentBookId}${path}`);
  };

  const loadDashboardData = async () => {
    if (!currentBookId) return;

    setLoading(true);
    try {
      const [vouchers, entries, accounts] = await Promise.all([
        getAllVouchers(currentBookId),
        getJournalEntries(currentBookId), 
        getFundAccounts(currentBookId)
      ]);

      const now = new Date();
      // 这里的月份前缀逻辑请根据实际情况调整，演示用 2025-12
      const currentMonthPrefix = "2025-12"; 
      
      // --- A. 计算损益 ---
      let totalRevenue = 0;
      let totalExpense = 0;

      // ★★★ 核心修复 1：凭证强制过滤账套 ID ★★★
      const validVouchers = (vouchers || []).filter((v: any) => 
        v.accountBookId === currentBookId && // 确保只统计本账套
        v.status === 'approved' && 
        v.voucherDate.startsWith(currentMonthPrefix) &&
        v.closingType !== 'profit' 
      );

      validVouchers.forEach((v: any) => {
        v.lines.forEach((line: any) => {
          const code = String(line.subjectCode);
          const debit = Number(line.debitAmount || 0);
          const credit = Number(line.creditAmount || 0);

          if (['6001', '6051', '6111', '6301'].some(p => code.startsWith(p))) {
             totalRevenue += (credit - debit);
          }
          if (/^6[4-9]/.test(code)) {
             totalExpense += (debit - credit);
          }
        });
      });

      setPnlData({
        revenue: totalRevenue,
        expense: totalExpense,
        netProfit: totalRevenue - totalExpense
      });

      // --- B. 资金数据 ---
      
      // ★★★ 核心修复 2：流水强制过滤账套 ID ★★★
      const currentBookEntries = (entries || []).filter((e: any) => e.accountBookId === currentBookId);
      
      // ★★★ 核心修复 3：资金账户强制过滤账套 ID ★★★
      // 之前这里可能把所有账套的银行卡余额都加起来了，导致“串账”
      const currentBookAccounts = (accounts || []).filter((a: any) => a.accountBookId === currentBookId);
      
      const initialSetupBalance = currentBookAccounts.reduce((sum: number, acc: any) => sum + Number(acc.initialBalance || 0), 0);
      
      let historyNetChange = 0;
      let monthInflow = 0;
      let monthOutflow = 0;
      let monthNetChange = 0;
      const monthEntries: any[] = [];

      currentBookEntries.forEach((e: any) => {
        const date = e.date;
        const inc = Number(e.income || 0);
        const exp = Number(e.expense || 0);

        if (date < `${currentMonthPrefix}-01`) {
            historyNetChange += (inc - exp);
        } else if (date.startsWith(currentMonthPrefix)) {
            monthInflow += inc;
            monthOutflow += exp;
            monthNetChange += (inc - exp);
            monthEntries.push(e);
        }
      });

      setFinancialData({
        totalBalance: initialSetupBalance + historyNetChange + monthNetChange,
        monthInflow,
        monthOutflow
      });

      setChartDataRaw({
        entries: monthEntries,
        monthStartBalance: initialSetupBalance + historyNetChange
      });

      // --- C. 待办事项 ---
      const pendingCount = (vouchers || []).filter((v: any) => 
          v.accountBookId === currentBookId && // 确保待办也过滤
          v.status !== 'approved'
      ).length;

      const unclassifiedCount = currentBookEntries.filter((e: any) => 
          !e.categoryId && 
          e.sourceType !== 'internal_transfer' && 
          !e.voucherCode
      ).length;
      
      const accountsToReconcile = 0; 

      setTodoItems({
        pendingVouchers: pendingCount,
        unclassifiedTransactions: unclassifiedCount,
        accountsToReconcile: accountsToReconcile 
      });

    } catch (e) {
      console.error("加载数据失败", e);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysUntilMonthEnd = lastDayOfMonth.getDate() - today.getDate();

  if (isCheckingStatus) {
      return (
          <div className="flex h-[50vh] items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
          </div>
      );
  }

  if (!isFullyUnlocked) {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                    <CardTitle className="text-xl font-bold text-slate-900 text-center">欢迎使用</CardTitle>
                </CardHeader>
                <CardContent className="p-8 text-center">
                    <p className="text-slate-600 mb-6">请先完成系统初始化设置。</p>
                    <Button onClick={() => onNavigate('/settings/subjects')} className="bg-slate-900">前往设置</Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto p-4">
      
      {/* 1. 顶部：核心数据 */}
      <div className="grid grid-cols-2 gap-5">
        
        {/* 左侧：损益表速览 */}
        <Card className="shadow-sm border border-slate-200 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-blue-600"/> 本月经营成果
                </CardTitle>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-slate-500 bg-white">
                    权责发生制
                </Badge>
            </CardHeader>
            <div className="p-0">
                <Table>
                    <TableBody>
                        <TableRow className="hover:bg-transparent border-b-0">
                            <TableCell className="py-2 pl-4 text-slate-500 font-medium text-sm w-24">总收入</TableCell>
                            <TableCell className="py-2 pr-4 text-right font-mono text-2xl font-bold text-slate-800">
                                ¥ {pnlData.revenue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-transparent border-b-0">
                            <TableCell className="py-2 pl-4 text-slate-500 font-medium text-sm">总支出</TableCell>
                            <TableCell className="py-2 pr-4 text-right font-mono text-2xl font-bold text-slate-800">
                                ¥ {pnlData.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </TableCell>
                        </TableRow>
                        <TableRow className="bg-blue-50/30 hover:bg-blue-50/40 border-t border-blue-100">
                            <TableCell className="py-3 pl-4 text-blue-900 font-bold text-sm">净利润</TableCell>
                            <TableCell className={`py-3 pr-4 text-right font-mono text-2xl font-bold ${pnlData.netProfit >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                                {pnlData.netProfit >= 0 ? '+' : ''} 
                                ¥ {pnlData.netProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </Card>

        {/* 右侧：现金流速览 */}
        <Card className="shadow-sm border border-slate-200 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600"/> 资金变动
                </CardTitle>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-slate-500 bg-white">
                    收付实现制
                </Badge>
            </CardHeader>
            <div className="p-0">
                <Table>
                    <TableBody>
                        <TableRow className="hover:bg-transparent border-b-0">
                            <TableCell className="py-2 pl-4 text-slate-500 font-medium text-sm w-24">本月流入</TableCell>
                            <TableCell className="py-2 pr-4 text-right font-mono text-2xl font-bold text-green-700">
                                +{financialData.monthInflow.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-transparent border-b-0">
                            <TableCell className="py-2 pl-4 text-slate-500 font-medium text-sm">本月流出</TableCell>
                            <TableCell className="py-2 pr-4 text-right font-mono text-2xl font-bold text-red-700">
                                -{financialData.monthOutflow.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </TableCell>
                        </TableRow>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/60 border-t border-slate-100">
                            <TableCell className="py-3 pl-4 text-slate-900 font-bold text-sm">当前余额</TableCell>
                            <TableCell className="py-3 pr-4 text-right font-mono text-2xl font-bold text-slate-800">
                                ¥ {financialData.totalBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </Card>
      </div>

      {/* 2. 中间：常用功能 & 待办 */}
      <div className="grid grid-cols-12 gap-5">
          
          {/* 左侧：快捷入口 (4/12) */}
          <Card className="col-span-4 shadow-sm border border-slate-200 h-full flex flex-col">
            <CardHeader className="py-3 px-4 border-b bg-white">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-500"/> 快捷入口
                </CardTitle>
            </CardHeader>
            <div className="p-4 space-y-3 flex-1">
                <Button variant="outline" className="w-full justify-start gap-3 h-10 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-700" 
                        onClick={() => onNavigate('/accounting/CashJournal')}>
                    <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-blue-600"/></div>
                    出纳日记账
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3 h-10 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-700" 
                        onClick={() => onNavigate('/vouchers/management')}>
                    <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center"><BookOpen className="w-3.5 h-3.5 text-blue-600"/></div>
                    凭证管理
                </Button>
                
                <div className="bg-slate-50 rounded-md p-3 border border-slate-100 mt-2">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3"/> 本月结账倒计时
                        </span>
                        <span className="text-xs font-bold text-slate-700 font-mono">{daysUntilMonthEnd} 天</span>
                    </div>
                    <Button size="sm" className="w-full bg-slate-800 hover:bg-slate-900 h-8 text-xs font-medium" onClick={() => onNavigate('/accounting/PeriodClosing')}>
                        期末结转
                    </Button>
                </div>
            </div>
          </Card>

          {/* 右侧：待办事项 (8/12) */}
          <Card className="col-span-8 shadow-sm border border-slate-200 h-full flex flex-col">
            <CardHeader className="py-3 px-4 border-b bg-white">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-500"/> 待办事项
                </CardTitle>
            </CardHeader>
            <div className="p-4 grid grid-cols-3 gap-4 flex-1">
                
                <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
                     onClick={() => onNavigate('/vouchers/management')}>
                    <span className="text-3xl font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors font-mono">
                        {todoItems.pendingVouchers}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-blue-500">待审核凭证</span>
                </div>

                <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
                     onClick={() => onNavigate('/accounting/CashJournal')}>
                    <span className="text-3xl font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors font-mono">
                        {todoItems.unclassifiedTransactions}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-blue-500">未分类流水</span>
                </div>

                <div className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all 
                    ${todoItems.accountsToReconcile > 0 
                        ? 'bg-white border-slate-200 hover:border-blue-400 cursor-pointer group' 
                        : 'bg-slate-50 border-slate-100 cursor-default'}`}
                     onClick={() => todoItems.accountsToReconcile > 0 && onNavigate('/reports/ReconciliationReport')}>
                    <span className={`text-3xl font-bold mb-1 font-mono ${todoItems.accountsToReconcile > 0 ? 'text-slate-800 group-hover:text-blue-600' : 'text-slate-300'}`}>
                        {todoItems.accountsToReconcile}
                    </span>
                    <span className="text-xs text-slate-400">资金待核对</span>
                </div>

            </div>
          </Card>
      </div>

      {/* 3. 底部：图表分析 */}
      <section className="pt-2">
         <h3 className="text-sm font-bold text-slate-700 mb-3 ml-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600"/> 资金趋势分析
         </h3>
         <FundAnalysis 
            entries={chartDataRaw.entries} 
            initialTotal={chartDataRaw.monthStartBalance} 
         />
      </section>

    </div>
  );
}