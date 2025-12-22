import { useState, useEffect } from 'react';
import { useRouter } from 'next/router'; // ✅ 改用 Next.js 路由
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
// ✅ 优化引用路径
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';

// 定义 SetupStatus 类型 (最好从 common/types 引入，这里为了演示直接定义)
interface SetupStatus {
  hasAccountBook: boolean;
  hasSubjects: boolean;
  hasFundAccounts: boolean;
  hasInitialBalances: boolean;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  path: string; // 基础路径，后续会动态拼接 bookId
  completed: boolean;
}

interface SetupWizardProps {
  setupStatus: SetupStatus;
}

export default function SetupWizard({ setupStatus }: SetupWizardProps) {
  const router = useRouter();
  
  // 获取当前账套ID (如果 URL 里有)
  const { bookId } = router.query;
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;

  // 动态生成路径前缀
  // 如果已经有 bookId，就拼接到路径中；如果没有（比如刚注册），前缀为空
  const getPath = (basePath: string) => {
    // 账套管理页不需要 bookId 前缀，因为它是选账套的地方
    if (basePath === '/settings/account-books') return basePath;
    
    // 其他设置项，必须要有 bookId 才能进入
    if (currentBookId) {
        return `/app/${currentBookId}${basePath}`;
    }
    
    // 如果没有 bookId，默认跳回账套列表让用户先选
    return '/settings/account-books';
  };

  const steps: SetupStep[] = [
    {
      id: 'account-book',
      title: '创建/选择账套',
      description: '设置公司信息和会计年度',
      path: '/settings/account-books', 
      completed: setupStatus.hasAccountBook
    },
    {
      id: 'subjects',
      title: '设置会计科目',
      description: '配置您的会计科目体系',
      path: '/settings/subjects',
      completed: setupStatus.hasSubjects
    },
    {
      id: 'auxiliary',
      title: '辅助核算设置',
      description: '添加客户、供应商、部门等基础资料',
      path: '/settings/auxiliary',
      // 这里没有后端对应状态，暂时默认为 false，或者你可以认为只要有科目就算开始了
      completed: setupStatus.hasSubjects 
    },
    {
      id: 'fund-accounts',
      title: '添加资金账户',
      description: '设置银行账户、现金账户等',
      path: '/settings/fund-accounts',
      completed: setupStatus.hasFundAccounts
    },
    {
      id: 'initial-data',
      title: '录入期初数据',
      description: '录入期初余额并试算平衡',
      path: '/settings/initial-data',
      completed: setupStatus.hasInitialBalances
    }
  ];

  // 计算完成度
  const mandatorySteps = steps; // 建议所有步骤都算
  const completedCount = mandatorySteps.filter(s => s.completed).length;
  const allCompleted = completedCount === mandatorySteps.length;

  const handleNavigate = (path: string) => {
      // 动态跳转
      router.push(getPath(path));
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* 进度卡片 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1.5">
              {allCompleted ? '🎉 设置完成！' : '🚀 快速上手向导'}
            </h2>
            <p className="text-base text-gray-600">
              {allCompleted 
                ? '恭喜！您已完成初始化设置，可以开始记账了。'
                : '请按顺序完成以下设置，以确保系统正常运行。'
              }
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-blue-600">{completedCount}/{mandatorySteps.length}</div>
            <p className="text-base text-gray-500">已完成</p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-6 overflow-hidden">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(completedCount / mandatorySteps.length) * 100}%` }}
          />
        </div>

        {/* 设置步骤列表 */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            // 简单逻辑：如果前一步没完成，当前步骤（及其后续）暂时不可点（可选功能，提升引导性）
            // const isDisabled = index > 0 && !steps[index - 1].completed;
            const isDisabled = false; // 暂时放开限制

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border transition-all relative overflow-hidden",
                  step.completed 
                    ? "bg-green-50/50 border-green-200" 
                    : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                )}
              >
                {/* 步骤图标 */}
                <div className="flex-shrink-0 z-10">
                  {step.completed ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  ) : (
                    <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm",
                        isDisabled ? "border-gray-200 text-gray-300" : "border-blue-600 text-blue-600"
                    )}>
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* 步骤信息 */}
                <div className="flex-1 z-10">
                  <h3 className={cn(
                    "text-base font-medium mb-0.5",
                    step.completed ? "text-green-900" : "text-gray-900",
                    isDisabled && "text-gray-400"
                  )}>
                    {step.title}
                  </h3>
                  <p className={cn("text-sm", isDisabled ? "text-gray-300" : "text-gray-500")}>
                      {step.description}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="z-10">
                    <Button
                        variant={step.completed ? "ghost" : "default"}
                        size="sm"
                        onClick={() => handleNavigate(step.path)}
                        disabled={isDisabled}
                        className={cn(
                        "h-9 px-4 transition-all",
                        step.completed 
                            ? "text-green-700 hover:text-green-800 hover:bg-green-100" 
                            : "bg-blue-600 hover:bg-blue-700 shadow-sm"
                        )}
                    >
                        {step.completed ? '重新设置' : '前往设置'}
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 完成提示 */}
        {allCompleted && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <div className="mt-0.5 text-blue-600">✨</div>
            <div>
                <p className="text-sm font-medium text-blue-900">系统已就绪</p>
                <p className="text-sm text-blue-700 mt-1">
                    您可以点击左侧菜单的“凭证管理”开始录入第一张凭证，或者查看“财务报表”。
                </p>
            </div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      {!allCompleted && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mt-4 text-center">
          <p className="text-sm text-yellow-800">
            💡 提示：在完成“期初数据录入”并“启用账套”之前，凭证录入功能将暂时锁定。
          </p>
        </div>
      )}
    </div>
  );
}