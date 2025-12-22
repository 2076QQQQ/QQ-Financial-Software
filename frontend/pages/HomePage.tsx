import { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; 
import FundAnalysis from './app/[bookId]/dashboard/FundAnalysis'; // 确保路径正确

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, CheckCircle2, ArrowRight, BookOpen, Loader2, 
  TrendingUp, TrendingDown, Wallet, PieChart
} from 'lucide-react';
import { 
  getAllVouchers, 
  getJournalEntries, 
  getFundAccounts 
} from '@/lib/mockData';

interface HomePageProps {
  onNavigate: (path: string) => void;
  setupStatus?: {
    hasAccountBook: boolean;
    hasSubjects: boolean;
    hasFundAccounts: boolean;
    hasInitialBalances: boolean;
  };
}

export default function HomePage({ onNavigate, setupStatus }: HomePageProps) {
  const router = useRouter();
  const { bookId } = router.query; 

  const [loading, setLoading] = useState(false);
  
  // 核心财务数据 (损益口径)
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

  // 图表数据 (仍然使用现金流数据，因为这是"资金概览"图表)
  const [chartDataRaw, setChartDataRaw] = useState({
    entries: [] as any[],
    monthStartBalance: 0 
  });

  const isFullyUnlocked = 
    setupStatus?.hasAccountBook && 
    setupStatus?.hasSubjects && 
    setupStatus?.hasFundAccounts && 
    setupStatus?.hasInitialBalances;

  useEffect(() => {
    if (router.isReady && bookId && isFullyUnlocked) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupStatus, router.isReady, bookId]); 

  const loadDashboardData = async () => {
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
    if (!currentBookId) return;

    setLoading(true);
    try {
      const [vouchers, entries, accounts] = await Promise.all([
        getAllVouchers(currentBookId),
        getJournalEntries(currentBookId), 
        getFundAccounts(currentBookId)
      ]);

      // 确定本月范围 (例如 2025-12)
      const now = new Date();
      // 这里为了演示你的数据，强制设为 2025-12。实际使用请用 now.getMonth() + 1
      const currentMonthPrefix = "2025-12"; 
      
      // ==========================================
      // 1. 计算损益 (Profit & Loss) - 核心逻辑
      // ==========================================
      let totalRevenue = 0;
      let totalExpense = 0;

      const validVouchers = (vouchers || []).filter((v: any) => 
        v.status === 'approved' && 
        v.voucherDate.startsWith(currentMonthPrefix) &&
        v.closingType !== 'profit' // ★ 关键：排除结转损益的凭证，否则余额为0
      );

      validVouchers.forEach((v: any) => {
        v.lines.forEach((line: any) => {
          const code = String(line.subjectCode);
          const debit = Number(line.debitAmount || 0);
          const credit = Number(line.creditAmount || 0);

          // 收入类：6001, 6051, 6301 (贷方增加)
          if (['6001', '6051', '6111', '6301'].some(p => code.startsWith(p))) {
             totalRevenue += (credit - debit);
          }

          // 支出类：6401, 6403, 6601, 6602, 6603, 6711, 6801 (借方增加)
          // 注意：排除 60xx, 61xx, 63xx 剩下的 6 开头基本都是支出
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

      // ==========================================
      // 2. 准备图表数据 (Cash Flow)
      // ==========================================
      // 图表依然展示“资金”变动，因为老板也想看银行卡里钱的走势
      const currentBookEntries = (entries || []).filter((e: any) => e.accountBookId === currentBookId);
      
      // 计算本月期初余额 (用于画图起点)
      // 逻辑：所有账户初始余额 + 历史(本月前)净流水
      const initialSetupBalance = (accounts || []).reduce((sum: number, acc: any) => sum + Number(acc.initialBalance || 0), 0);
      
      let historyNetChange = 0;
      const monthEntries: any[] = [];

      currentBookEntries.forEach((e: any) => {
        const date = e.date;
        const inc = Number(e.income || 0);
        const exp = Number(e.expense || 0);

        if (date < `${currentMonthPrefix}-01`) {
            historyNetChange += (inc - exp);
        } else if (date.startsWith(currentMonthPrefix)) {
            monthEntries.push(e);
        }
      });

      setChartDataRaw({
        entries: monthEntries,
        monthStartBalance: initialSetupBalance + historyNetChange
      });

      // ==========================================
      // 3. 待办事项
      // ==========================================
      const pendingCount = (vouchers || []).filter((v: any) => v.status !== 'approved').length;
      const unclassifiedCount = currentBookEntries.filter((e: any) => !e.categoryId).length;

      setTodoItems({
        pendingVouchers: pendingCount,
        unclassifiedTransactions: unclassifiedCount,
        accountsToReconcile: (accounts || []).length 
      });

    } catch (e) {
      console.error("加载数据失败", e);
    } finally {
      setLoading(false);
    }
  };

  // 计算距离月底天数
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysUntilMonthEnd = lastDayOfMonth.getDate() - today.getDate();

  if (!isFullyUnlocked) {
      return <div className="p-10 text-center text-gray-500">系统初始化未完成</div>;
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto p-6">
      
      {/* 1. 顶部：经营成果 (损益口径) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900">本月经营成果</h2>
          <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 ml-2">
             损益口径 (权责发生制)
          </Badge>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400"/>}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 总收入 */}
          <Card className="p-6 border-t-4 border-t-emerald-500 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <TrendingUp className="w-5 h-5" />
                <p className="text-sm font-bold">总收入 (Revenue)</p>
              </div>
              <p className="text-3xl font-bold text-emerald-800 font-mono">
                ¥ {pnlData.revenue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-emerald-600 opacity-80">
                主营业务 + 其他业务 + 营业外
              </p>
            </div>
          </Card>

          {/* 总支出 */}
          <Card className="p-6 border-t-4 border-t-rose-500 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-700">
                <TrendingDown className="w-5 h-5" />
                <p className="text-sm font-bold">总支出 (Expense)</p>
              </div>
              <p className="text-3xl font-bold text-rose-800 font-mono">
                ¥ {pnlData.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-rose-600 opacity-80">
                成本 + 税金 + 三费 + 所得税
              </p>
            </div>
          </Card>

          {/* 净利润 */}
          <Card className={`p-6 border-t-4 shadow-sm ${pnlData.netProfit >= 0 ? 'border-t-blue-500' : 'border-t-orange-500'}`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-700">
                <Wallet className="w-5 h-5" />
                <p className="text-sm font-bold">净利润 (Net Profit)</p>
              </div>
              <p className={`text-3xl font-bold font-mono ${pnlData.netProfit >= 0 ? 'text-blue-800' : 'text-orange-600'}`}>
                {pnlData.netProfit >= 0 ? '+' : ''} 
                ¥ {pnlData.netProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600 opacity-80">
                总收入 - 总支出
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* 2. 中部：图表分析 (资金口径) */}
      <section className="mb-8">
         <FundAnalysis 
            entries={chartDataRaw.entries} 
            initialTotal={chartDataRaw.monthStartBalance} 
         />
      </section>

      {/* 3. 底部：待办与入口 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：待办事项 (2/3) */}
        <Card className="col-span-2 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500"/> 待办事项
            </h3>
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 flex flex-col justify-between hover:shadow-sm transition-shadow">
                    <span className="text-sm text-orange-600 font-medium">待审核凭证</span>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-bold text-orange-900">{todoItems.pendingVouchers}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-orange-700 hover:text-orange-900 px-0" onClick={() => onNavigate('/vouchers/management')}>处理 &rarr;</Button>
                    </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col justify-between hover:shadow-sm transition-shadow">
                    <span className="text-sm text-blue-600 font-medium">未分类流水</span>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-bold text-blue-900">{todoItems.unclassifiedTransactions}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-blue-700 hover:text-blue-900 px-0" onClick={() => onNavigate('/funds/journal')}>处理 &rarr;</Button>
                    </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex flex-col justify-between hover:shadow-sm transition-shadow">
                    <span className="text-sm text-purple-600 font-medium">资金待核对</span>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-bold text-purple-900">{todoItems.accountsToReconcile} <span className="text-sm font-normal">个</span></span>
                        <Button variant="ghost" size="sm" className="h-6 text-purple-700 hover:text-purple-900 px-0" onClick={() => onNavigate('/reports/reconciliation')}>去核对 &rarr;</Button>
                    </div>
                </div>
            </div>
        </Card>

        {/* 右侧：快捷入口 (1/3) */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-white">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-gray-500"/> 常用功能
            </h3>
            <div className="space-y-2">
                <Button variant="outline" className="w-full justify-between group" onClick={() => onNavigate('/vouchers/entry')}>
                    <span className="text-gray-700">录入凭证</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors"/>
                </Button>
                <Button variant="outline" className="w-full justify-between group" onClick={() => onNavigate('/funds/journal')}>
                    <span className="text-gray-700">出纳日记账</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors"/>
                </Button>
                <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>本月结账倒计时</span>
                        <span className="font-mono font-bold text-blue-600">{daysUntilMonthEnd} 天</span>
                    </div>
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => onNavigate('/accounting/closing')}>
                        去结转损益
                    </Button>
                </div>
            </div>
        </Card>
      </div>
    </div>
  );
}