import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';      
import { Bell, FileText, TrendingUp, Clock, ChevronRight, AlertCircle, CheckCircle2, ArrowRight, DollarSign, ArrowUpCircle, ArrowDownCircle, BookOpen } from 'lucide-react';
import { getPendingVouchersCount, getUnclassifiedCount, getCurrentBalance } from '../lib/mockData';

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
  // 检查是否完全解锁
  const isFullyUnlocked = setupStatus?.hasAccountBook && 
    setupStatus?.hasSubjects && 
    setupStatus?.hasFundAccounts && 
    setupStatus?.hasInitialBalances;

  // 如果未完全解锁，显示设置向导
  if (!isFullyUnlocked) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-blue-900 mb-2">欢迎使用财务管理系统！</h2>
          <p className="text-blue-700 mb-4">
            请完成以下4步设置向导，开启您的财务管理之旅
          </p>
          
          <div className="space-y-3">
            {/* 步骤1：会计科目 */}
            <Card className={`p-4 ${setupStatus?.hasSubjects ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-gray-900">步骤1：会计科目设置</h3>
                  <p className="text-sm text-gray-600">设置企业会计科目体系</p>
                </div>
                {setupStatus?.hasSubjects ? (
                  <Badge className="bg-green-600">已完成</Badge>
                ) : (
                  <Button onClick={() => onNavigate('/settings/subjects')}>
                    前往设置
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </Card>

            {/* 步骤2：辅助核算 */}
            <Card className={`p-4 ${setupStatus?.hasSubjects ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={setupStatus?.hasSubjects ? 'text-gray-900' : 'text-gray-500'}>
                    步骤2：辅助核算项目
                  </h3>
                  <p className="text-sm text-gray-600">设置客户、供应商等</p>
                </div>
                {setupStatus?.hasSubjects ? (
                  <Button onClick={() => onNavigate('/settings/auxiliary')}>
                    前往设置
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Badge variant="outline">待解锁</Badge>
                )}
              </div>
            </Card>

            {/* 步骤3：资金账户 */}
            <Card className={`p-4 ${setupStatus?.hasFundAccounts ? 'bg-green-50 border-green-200' : setupStatus?.hasSubjects ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={setupStatus?.hasSubjects ? 'text-gray-900' : 'text-gray-500'}>
                    步骤3：资金账户设置
                  </h3>
                  <p className="text-sm text-gray-600">设置现金、银行账户</p>
                </div>
                {setupStatus?.hasFundAccounts ? (
                  <Badge className="bg-green-600">已完成</Badge>
                ) : setupStatus?.hasSubjects ? (
                  <Button onClick={() => onNavigate('/settings/fund-accounts')}>
                    前往设置
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Badge variant="outline">待解锁</Badge>
                )}
              </div>
            </Card>

            {/* 步骤4：期初数据 */}
            <Card className={`p-4 ${setupStatus?.hasInitialBalances ? 'bg-green-50 border-green-200' : setupStatus?.hasFundAccounts ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={setupStatus?.hasFundAccounts ? 'text-gray-900' : 'text-gray-500'}>
                    步骤4：期初数据录入
                  </h3>
                  <p className="text-sm text-gray-600">录入期初余额数据</p>
                </div>
                {setupStatus?.hasInitialBalances ? (
                  <Badge className="bg-green-600">已完成</Badge>
                ) : setupStatus?.hasFundAccounts ? (
                  <Button onClick={() => onNavigate('/settings/initial-data')}>
                    前往设置
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Badge variant="outline">待解锁</Badge>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // 完全解锁后显示工作台
  // 从全局数据获取实时资金数据
  // BR2: 总期末余额 = 所有UC09资金账户的期初余额 + UC11日记账流水累计
  // 数据来源：UC11出纳日记账（不依赖UC06凭证或UC07审核状态）
  const balanceData = getCurrentBalance();
  const financialData = {
    totalBalance: balanceData.totalBalance,  // 总期末余额（期初 + 流入 - 流出）
    totalInflow: balanceData.totalInflow,    // 本期流入总额
    totalOutflow: balanceData.totalOutflow,  // 本期流出总额
  };

  // 待办事项数据（实时从数据库获取）
  const todoItems = {
    pendingVouchers: getPendingVouchersCount(),        // 待审核凭证（必须等于UC06中状态为"未审核"的凭证总数）
    unclassifiedTransactions: getUnclassifiedCount(), // 未分类流水
    accountsToReconcile: 0      // 资金待核对（TODO: 需要从实际核对数据中计算）
  };

  // 计算距离月底天数
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysUntilMonthEnd = lastDayOfMonth.getDate() - today.getDate();

  return (
    <div className="space-y-8">
      {/* 顶部：实时资金概览 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-6 h-6 text-blue-600" />
          <h2 className="text-gray-900">实时资金概览</h2>
          <span className="text-sm text-gray-500">(本月至今)</span>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 总期末余额 */}
          <Card 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onNavigate('/funds/summary')}
          >
            <div className="space-y-2">
              <p className="text-sm text-gray-600">总期末余额</p>
              <p className="text-3xl text-blue-600">
                ¥{financialData.totalBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">点击查看资金汇总表明细</p>
            </div>
          </Card>

          {/* 本期流入总额 */}
          <Card 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onNavigate('/funds/summary')}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-gray-600">本期流入总额</p>
              </div>
              <p className="text-3xl text-green-600">
                ¥{financialData.totalInflow.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">点击查看收入明细</p>
            </div>
          </Card>

          {/* 本期流出总额 */}
          <Card 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onNavigate('/funds/summary')}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-gray-600">本期流出总额</p>
              </div>
              <p className="text-3xl text-red-600">
                ¥{financialData.totalOutflow.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">点击查看支出明细</p>
            </div>
          </Card>
        </div>
      </section>

      {/* 中部：待办事项与流程指引 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-6 h-6 text-orange-600" />
          <h2 className="text-gray-900">待办事项</h2>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 待审核凭证 */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">待审核凭证</p>
                {todoItems.pendingVouchers > 0 && (
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    {todoItems.pendingVouchers} 张
                  </Badge>
                )}
              </div>
              <p className="text-2xl">{todoItems.pendingVouchers}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onNavigate('/vouchers/management')}
              >
                去审核
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>

          {/* 未分类流水 */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">未分类流水</p>
                {todoItems.unclassifiedTransactions > 0 && (
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    {todoItems.unclassifiedTransactions} 笔
                  </Badge>
                )}
              </div>
              <p className="text-2xl">{todoItems.unclassifiedTransactions}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onNavigate('/funds/journal')}
              >
                去分类
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>

          {/* 资金待核对 */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">资金待核对</p>
                {todoItems.accountsToReconcile > 0 && (
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    {todoItems.accountsToReconcile} 个账户
                  </Badge>
                )}
              </div>
              <p className="text-2xl">{todoItems.accountsToReconcile}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onNavigate('/ledgers/reconciliation')}
              >
                去核对
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 底部：核心功能快捷入口 */}
      <section>
        <h2 className="text-gray-900 mb-4">核心功能快捷入口</h2>

        <div className="grid grid-cols-2 gap-6">
          {/* 左侧：日常流水操作 */}
          <Card className="p-6">
            <h3 className="text-gray-900 mb-4">日常流水操作</h3>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => onNavigate('/funds/journal')}
              >
                <FileText className="w-4 h-4 mr-2" />
                录入出纳流水
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => onNavigate('/vouchers/management')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                新增记账凭证
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => onNavigate('/funds/transfer')}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                新增内部转账
              </Button>
            </div>
          </Card>

          {/* 右侧：月末工作提醒 */}
          <Card className="p-6">
            <h3 className="text-gray-900 mb-4">月末工作提醒</h3>
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700 mb-2">
                  距本月结账截止还有 <span className="font-semibold">{daysUntilMonthEnd}</span> 天
                </p>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => onNavigate('/closing/execute')}
                >
                  执行期末结转
                </Button>
              </div>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => onNavigate('/reports/balance-sheet')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                查看本期报表
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}