import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../components/ui/utils';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  path: string;
  completed: boolean;
}

interface SetupWizardProps {
  onNavigate: (path: string) => void;
  setupStatus: {
    hasAccountBook: boolean;
    hasSubjects: boolean;
    hasFundAccounts: boolean;
    hasInitialBalances: boolean;
  };
}

export default function SetupWizard({ onNavigate, setupStatus }: SetupWizardProps) {
  const steps: SetupStep[] = [
    {
      id: 'account-book',
      title: '创建您的账套',
      description: '设置会计期间和基本信息',
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
      id: 'fund-accounts',
      title: '添加资金账户',
      description: '设置银行账户、现金账户等',
      path: '/settings/fund-accounts',
      completed: setupStatus.hasFundAccounts
    },
    {
      id: 'initial-data',
      title: '录入期初数据',
      description: '录入期初余额和数据',
      path: '/settings/initial-data',
      completed: setupStatus.hasInitialBalances
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const allCompleted = completedCount === steps.length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 进度卡片 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-gray-900 mb-1">
              {allCompleted ? '🎉 设置完成！' : '🚀 您的系统还差几步即可启用'}
            </h2>
            <p className="text-gray-600">
              {allCompleted 
                ? '恭喜！您已完成所有必要设置，现在可以开始使用系统了。'
                : '完成以下设置步骤后，您将解锁所有功能。'
              }
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{completedCount}/{steps.length}</div>
            <p className="text-sm text-gray-500">已完成</p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>

        {/* 设置步骤列表 */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg border transition-all",
                step.completed 
                  ? "bg-green-50 border-green-200" 
                  : "bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
              )}
            >
              {/* 步骤图标 */}
              <div className="flex-shrink-0">
                {step.completed ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-300">
                    <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                  </div>
                )}
              </div>

              {/* 步骤信息 */}
              <div className="flex-1">
                <h3 className={cn(
                  "font-medium mb-1",
                  step.completed ? "text-green-900" : "text-gray-900"
                )}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>

              {/* 操作按钮 */}
              {!step.completed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(step.path)}
                  className="flex-shrink-0"
                >
                  前往设置
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* 完成提示 */}
        {allCompleted && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              ✨ 所有功能已解锁！您现在可以通过左侧菜单访问凭证管理、账簿查询、财务报表等功能。
            </p>
          </div>
        )}
      </div>

      {/* 温馨提示 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-900">
          💡 <span className="font-medium">温馨提示：</span>在完成上述所有步骤之前，凭证、账簿等功能将暂时锁定。
        </p>
      </div>
    </div>
  );
}
