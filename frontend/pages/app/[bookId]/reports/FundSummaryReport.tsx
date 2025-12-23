import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Search, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// 引入 mockData 中的请求函数（确保 mockData.ts 已清理重复代码）
import { getFundSummaryReport } from '@/lib/mockData';
import { toast } from 'sonner';
// 定义接口（直接写在这里，避免 mockData 导出问题）
interface AccountSummary {
  accountId: string;
  accountName: string;
  initialBalance: number;
  periodIncome: number;
  periodExpense: number;
  endingBalance: number;
}

interface SubjectSummary {
  type: 'income' | 'expense' | 'uncategorized';
  categoryName: string;
  incomeAmount: number;
  expenseAmount: number;
  count: number;
}

export default function FundSummaryReport() {
  const [isLoading, setIsLoading] = useState(false); 
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;

  const [currentTab, setCurrentTab] = useState<'account' | 'subject'>('account');
  const [loading, setLoading] = useState(false);
  
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    // 默认上个月1号到今天，避免刚建账查不到数据的尴尬
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    return {
      dateFrom: firstDay,
      dateTo: today
    };
  });
  
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
  
  useEffect(() => {
    if (router.isReady && currentBookId) {
        handleQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, currentBookId]); 

  const handleQuery = async () => {
    if (filters.dateFrom && filters.dateTo && filters.dateTo < filters.dateFrom) {
        toast.error("结束时间不能早于开始时间");
        return; // 阻止查询
    }

    setIsLoading(true);
    if (!currentBookId) return;
    if (!filters.dateFrom || !filters.dateTo) {
      alert('请选择完整的日期范围');
      return;
    }
    
    setLoading(true);

    try {
      // ✅ 调用 mockData 的函数，它内部会把 currentBookId 转换为 accountBookId 发送给后端
      const data = await getFundSummaryReport(currentBookId, filters.dateFrom, filters.dateTo);
      
      setAccountSummaries(data.accountSummaries || []);
      setSubjectSummaries(data.subjectSummaries || []);

    } catch (error: any) {
      console.error("统计失败", error);
      // 如果后端没有数据返回 400/500，这里 catch 住防止崩坏页面
      setAccountSummaries([]);
      setSubjectSummaries([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleExport = () => {
      if (accountSummaries.length === 0) {
        toast.warning("没有可导出的数据，请先查询");
        return;
      }
      
      const csvHeader = "账户名称,期初余额,本期收入,本期支出,期末余额\n";
      const csvBody = accountSummaries.map(e => 
        `${e.accountName},${e.initialBalance},${e.periodIncome},${e.periodExpense},${e.endingBalance}`
      ).join("\n");
      
      const blob = new Blob(["\ufeff" + csvHeader + csvBody], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `资金汇总表_${filters.dateFrom}_${filters.dateTo}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };
  
  const totalIncome = subjectSummaries.reduce((sum, item) => sum + item.incomeAmount, 0);
  const totalExpense = subjectSummaries.reduce((sum, item) => sum + item.expenseAmount, 0);
  const netFlow = totalIncome - totalExpense;

  const incomeList = subjectSummaries.filter(s => (s.incomeAmount > 0 || s.type === 'income') && s.type !== 'uncategorized');
  const expenseList = subjectSummaries.filter(s => (s.expenseAmount > 0 || s.type === 'expense') && s.type !== 'uncategorized');
  const uncategorized = subjectSummaries.find(s => s.type === 'uncategorized');

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">资金汇总表</h1>
          <p className="text-sm text-gray-500">
          统计周期内各资金账户的流水变动情况，数据来源于出纳日记账。
          </p>
      </div>
      
      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 ml-1">开始日期</Label>
            <Input
              type="date"
              className="w-40 bg-gray-50 border-gray-200 focus:bg-white transition-all"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 ml-1">结束日期</Label>
            <Input
              type="date"
              className="w-40 bg-gray-50 border-gray-200 focus:bg-white transition-all"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button onClick={handleQuery} disabled={loading} className="w-24 bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Search className="w-4 h-4 mr-2" />查询</>}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={loading || accountSummaries.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              导出
            </Button>
          </div>
        </div>
      </div>
      
      {/* 概览卡片区 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">本期总收入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 font-mono">+{totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">本期总支出</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 font-mono">-{totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">期间净现金流</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${netFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {netFlow > 0 ? '+' : ''}{netFlow.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as 'account' | 'subject')} className="space-y-4">
        <TabsList className="bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="account" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">按资金账户汇总</TabsTrigger>
          <TabsTrigger value="subject" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">按收支类别汇总</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="w-[200px] font-semibold text-gray-900">账户名称</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">期初余额</TableHead>
                  <TableHead className="text-right font-semibold text-emerald-700">本期收入</TableHead>
                  <TableHead className="text-right font-semibold text-red-700">本期支出</TableHead>
                  <TableHead className="text-right font-semibold text-blue-700">期末余额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-12 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>数据计算中...</TableCell></TableRow>
                ) : accountSummaries.length === 0 ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-12 text-gray-500">暂无数据</TableCell></TableRow>
                ) : (
                  accountSummaries.map(acc => (
                    <TableRow key={acc.accountId} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="font-medium text-gray-900">{acc.accountName}</TableCell>
                      <TableCell className="text-right text-gray-500 font-mono">
                        {acc.initialBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 font-mono">
                        {acc.periodIncome > 0 ? `+${acc.periodIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-mono">
                        {acc.periodExpense > 0 ? `-${acc.periodExpense.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-900 font-mono bg-gray-50/30">
                        {acc.endingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="subject">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b bg-emerald-50/30 font-medium text-emerald-800 flex justify-between items-center">
                  <span>收入构成</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">流入</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>类别名称</TableHead>
                    <TableHead className="text-right">笔数</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeList.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.categoryName}</TableCell>
                      <TableCell className="text-right text-gray-500 text-xs">{item.count}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-medium font-mono">
                        {item.incomeAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </TableCell>
                    </TableRow>
                  ))}
                  {incomeList.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400 text-sm">无收入记录</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b bg-red-50/30 font-medium text-red-800 flex justify-between items-center">
                  <span>支出构成</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">流出</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>类别名称</TableHead>
                    <TableHead className="text-right">笔数</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseList.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.categoryName}</TableCell>
                      <TableCell className="text-right text-gray-500 text-xs">{item.count}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium font-mono">
                        {item.expenseAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenseList.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400 text-sm">无支出记录</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>

          {uncategorized && (uncategorized.incomeAmount > 0 || uncategorized.expenseAmount > 0) && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-bold text-orange-800">存在未分类的收支流水</div>
                <div className="text-sm text-orange-700 mt-1 leading-relaxed">
                  共 <span className="font-mono font-bold">{uncategorized.count}</span> 笔流水未指定收支类别
                  （收入: <span className="font-mono">{uncategorized.incomeAmount}</span>, 支出: <span className="font-mono">{uncategorized.expenseAmount}</span>）。
                  建议前往 <Link href={`/app/${currentBookId}/accounting/CashJournal`} className="underline font-bold hover:text-orange-950 decoration-orange-400 underline-offset-2">出纳日记账</Link> 进行分类。
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}