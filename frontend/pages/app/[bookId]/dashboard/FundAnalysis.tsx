// components/FundAnalysis.tsx
import { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, TrendingUp, Wallet } from 'lucide-react';

interface FundAnalysisProps {
  entries: any[];     // 出纳流水
  initialTotal: number; // 月初余额
}

export default function FundAnalysis({ entries, initialTotal }: FundAnalysisProps) {
  
  const { chartData, topExpenses } = useMemo(() => {
    // 如果没有数据，返回空结构，防止报错
    if (!entries) return { chartData: [], topExpenses: [] };

    // 1. 按日期排序
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. 准备容器
    const expenseMap = new Map<string, number>();
    const dailyMap = new Map<string, { income: number; expense: number }>();
    
    sortedEntries.forEach(e => {
      const inc = Number(e.income || 0);
      const exp = Number(e.expense || 0);
      const date = e.date; // YYYY-MM-DD

      // A. 图表数据聚合
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { income: 0, expense: 0 });
      }
      const dayData = dailyMap.get(date)!;
      dayData.income += inc;
      dayData.expense += exp;

      // B. 排行榜聚合 (排除内部转账)
      if (exp > 0 && e.sourceType !== 'internal_transfer') {
        // 优先取辅助核算名 > 对方科目名 > 摘要
        let category = e.partnerName || e.categoryName || '未分类';
        // 截断太长的摘要
        if (category === '未分类' && e.summary) category = e.summary.slice(0, 8);
        
        expenseMap.set(category, (expenseMap.get(category) || 0) + exp);
      }
    });

    // 3. 生成每日余额曲线
    let currentBalance = initialTotal;
    // 如果没有任何流水，至少显示一个起点
    const chartData = Array.from(dailyMap.keys()).map(date => {
      const { income, expense } = dailyMap.get(date)!;
      currentBalance = currentBalance + income - expense;
      return {
        date: date.slice(5), // MM-DD
        balance: Number(currentBalance.toFixed(2)),
        income,
        expense
      };
    });

    // 4. 生成 Top 5 支出
    const topExpenses = Array.from(expenseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name,
        value,
        percent: 0
      }));

    const totalExp = Array.from(expenseMap.values()).reduce((a, b) => a + b, 0);
    if (totalExp > 0) {
      topExpenses.forEach(item => item.percent = (item.value / totalExp) * 100);
    }

    return { chartData, topExpenses };
  }, [entries, initialTotal]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 左侧：资金走势 */}
      <Card className="lg:col-span-2 shadow-sm border-gray-200">
        <CardHeader className="pb-2 border-b border-gray-100">
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600"/>
            本月资金余额走势 (出纳口径)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {/* 强制高度，解决图表不显示问题 */}
          <div style={{ width: '100%', height: '300px' }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{fontSize: 12, fill: '#6b7280'}} 
                    tickLine={false}
                    axisLine={false}
                    padding={{ left: 10, right: 10 }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '余额']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed">
                <Wallet className="w-10 h-10 mb-2 text-gray-300"/>
                <p>本月暂无资金变动</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 右侧：支出排行 */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="pb-2 border-b border-gray-100">
          <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            <ArrowDown className="w-5 h-5 text-red-600"/>
            本月支出排行 (损益/资产)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-6 mt-2">
            {topExpenses.length > 0 ? (
              topExpenses.map((item, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700 truncate max-w-[140px]" title={item.name}>
                        {index + 1}. {item.name}
                    </span>
                    <span className="font-mono font-bold text-gray-900">
                        ¥{item.value.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full" 
                      style={{ width: `${item.percent}%` }} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed">
                <p>暂无支出数据</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}