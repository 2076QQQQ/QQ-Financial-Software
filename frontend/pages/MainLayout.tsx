import { useState, useEffect } from 'react';
import { Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar';
import HomePage from './HomePage';
import AccountBookList from '@/settings/AccountBookList';
import TeamManagement from '@/team/TeamManagement';
import SubjectManagement from '@/settings/SubjectManagement';
import FundAccountManagement from '@/settings/FundAccountManagement';
import InitialDataEntry from '@/setup/InitialDataEntry';
import AuxiliaryManagement from './AuxiliaryManagement';
import VoucherTemplateManagement from './VoucherTemplateManagement';
import IncomeCategoryManagement from './IncomeCategoryManagement';
import VoucherManagement from './VoucherManagement';
import VoucherSummary from './VoucherSummary';
import CashJournal from './CashJournal';
import InternalTransfer from './InternalTransfer';
import FundSummaryReport from './FundSummaryReport';
import ReconciliationReport from './ReconciliationReport';
import DetailedLedger from './DetailedLedger';
import GeneralLedger from './GeneralLedger';
import PeriodClosing from './PeriodClosing';
import BalanceSheet from './BalanceSheet';
import IncomeStatement from './IncomeStatement';
import CashFlowStatement from './CashFlowStatement';

interface MainLayoutProps {
  user: {
    email: string;
    name?: string;
    companyName?: string;
    role?: string;
    isAdmin?: boolean;
    isOwner?: boolean;
  };
  onLogout: () => void;
  initialHasAccountBook?: boolean;
}

export default function MainLayout({ user, onLogout, initialHasAccountBook = false }: MainLayoutProps) {
  const [currentPath, setCurrentPath] = useState('');
  
  // 系统设置状态
  const [setupStatus, setSetupStatus] = useState({
    hasAccountBook: initialHasAccountBook,
    hasSubjects: false,
    hasFundAccounts: false,
    hasInitialBalances: false
  });

  // 路由守卫：根据 has_account_book 决定初始路径
  useEffect(() => {
    if (setupStatus.hasAccountBook) {
      // 已有账套：跳转到首页
      setCurrentPath('/home');
    } else {
      // 无账：强制跳转到账套管理
      setCurrentPath('/settings/account-books');
    }
  }, []);

  // 检查是否完全解锁（所有设置都完成）
  const isFullyUnlocked = 
    setupStatus.hasAccountBook && 
    setupStatus.hasSubjects && 
    setupStatus.hasFundAccounts && 
    setupStatus.hasInitialBalances;

  // 处理导航
  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  // 处理账套创建成功
  const handleAccountBookCreated = () => {
    setSetupStatus({
      ...setupStatus,
      hasAccountBook: true
    });
    // 跳转到会计科目设置
    setCurrentPath('/settings/subjects');
  };

  // 处理期初数据完成
  const handleInitialDataComplete = () => {
    setSetupStatus({
      ...setupStatus,
      hasAccountBook: true,
      hasSubjects: true,
      hasFundAccounts: true,
      hasInitialBalances: true
    });
    // 跳转到首页工作台
    setCurrentPath('/home');
  };

  // 渲染内容区
  const renderContent = () => {
    // 账套管理
    if (currentPath === '/settings/account-books') {
      return (
        <AccountBookList 
          isFirstTime={!setupStatus.hasAccountBook}
          onAccountBookCreated={handleAccountBookCreated}
        />
      );
    }

    // 团队成员管理
    if (currentPath === '/settings/team') {
      return <TeamManagement currentUserId="1" />;
    }

    // 首页
    if (currentPath === '/home') {
      return (
        <HomePage 
          onNavigate={handleNavigate}
          setupStatus={setupStatus}
        />
      );
    }

    // 其他页面（占位符）
    if (currentPath.startsWith('/settings/subjects')) {
      return <SubjectManagement onNavigate={handleNavigate} userName={user.name || user.email} />;
    }

    if (currentPath.startsWith('/settings/fund-accounts')) {
      return <FundAccountManagement onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/settings/initial-data')) {
      return <InitialDataEntry onInitialDataComplete={handleInitialDataComplete} />;
    }

    if (currentPath.startsWith('/settings/auxiliary')) {
      return <AuxiliaryManagement onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/settings/categories')) {
      return <IncomeCategoryManagement />;
    }

    if (currentPath.startsWith('/settings/templates')) {
      return <VoucherTemplateManagement />;
    }

    if (currentPath.startsWith('/vouchers/summary')) {
      return <VoucherSummary />;
    }

    if (currentPath.startsWith('/vouchers/')) {
      return <VoucherManagement />;
    }

    if (currentPath.startsWith('/funds/journal')) {
      return <CashJournal />;
    }

    if (currentPath.startsWith('/funds/transfer')) {
      return <InternalTransfer />;
    }

    if (currentPath.startsWith('/funds/summary')) {
      return <FundSummaryReport />;
    }

    if (currentPath.startsWith('/funds/')) {
      return <PlaceholderPage title="资金管理" description="此功能将在完成初始设置后解锁" />;
    }

    if (currentPath.startsWith('/ledgers/detail')) {
      return <DetailedLedger />;
    }

    if (currentPath.startsWith('/ledgers/general')) {
      return <GeneralLedger />;
    }

    if (currentPath.startsWith('/ledgers/reconciliation')) {
      return <ReconciliationReport />;
    }

    if (currentPath.startsWith('/ledgers/')) {
      return <PlaceholderPage title="账簿中心" description="此功能将在完成初始设置后解锁" />;
    }

    if (currentPath.startsWith('/closing/')) {
      return <PeriodClosing />;
    }

    // 财务报表
    if (currentPath === '/reports/balance-sheet') {
      return <BalanceSheet />;
    }

    if (currentPath === '/reports/income') {
      return <IncomeStatement />;
    }

    if (currentPath === '/reports/cash-flow') {
      return <CashFlowStatement />;
    }

    if (currentPath.startsWith('/reports/')) {
      return <PlaceholderPage title="财务报表" description="此功能将在完成初始设置后解锁" />;
    }

    // 默认首页
    return (
      <HomePage 
        onNavigate={handleNavigate}
        setupStatus={setupStatus}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 侧边栏 */}
      <Sidebar 
        currentPath={currentPath}
        onNavigate={handleNavigate}
        isLocked={!isFullyUnlocked}
      />

      {/* 主内容区 */}
      <div className="ml-56">
        {/* 顶部导航栏 */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-gray-900">{user.companyName || '财务中心'}</h2>
                  <p className="text-sm text-gray-500">{user.name || user.email}</p>
                </div>
              </div>
              <Button variant="ghost" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </header>

        {/* 内容区 */}
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// 占位符页面组件
function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg border p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <Building2 className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
        <p className="text-sm text-gray-500 mt-4">此功能正在开发中...</p>
      </div>
    </div>
  );
}