import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  Home, Wallet, FileText, BookOpen, Lock, TrendingUp, Settings,
  ChevronDown, ChevronRight, Building2, PlusCircle, Check, AlertCircle 
} from 'lucide-react';
import { cn } from '@/components/ui/utils';

import {
  Select, SelectContent, SelectItem, SelectTrigger, 
  SelectSeparator, SelectGroup, SelectLabel
} from '@/components/ui/select';

import { getAccountBooks } from '@/lib/mockData';

interface SidebarProps {
  className?: string;
  isLocked?: boolean;
}

export default function Sidebar({ className, isLocked = false }: SidebarProps) {
  const router = useRouter();
  
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['settings']);
  
  const [activeBookId, setActiveBookId] = useState<string | undefined>();

  // --- 1. ID 同步逻辑 ---
  useEffect(() => {
    if (!router.isReady) return;

    const urlBookId = Array.isArray(router.query.bookId) ? router.query.bookId[0] : router.query.bookId;

    if (urlBookId) {
      setActiveBookId(urlBookId);
      localStorage.setItem('lastActiveBookId', urlBookId);
    } else {
      const cachedId = localStorage.getItem('lastActiveBookId');
      if (cachedId) {
        setActiveBookId(cachedId);
      }
    }
  }, [router.isReady, router.query.bookId]);

  // --- 2. 加载账套数据 (封装为 useCallback 以便复用) ---
  const loadBooks = useCallback(async () => {
    try {
      const data = await getAccountBooks();
      if (Array.isArray(data)) {
          setBooks(data);
          
          // 🛡️ 安全检查：如果当前选中的 ID 在新的列表中不存在（说明被删了），则重置
          const currentId = activeBookId || localStorage.getItem('lastActiveBookId');
          if (currentId && data.length > 0) {
              const exists = data.find(b => b.id === currentId);
              if (!exists) {
                  console.log("当前选中账套已被删除，重置状态");
                  setActiveBookId(undefined);
                  localStorage.removeItem('lastActiveBookId');
                  // 如果在业务页面，建议跳回首页或管理页
                  if (!router.pathname.includes('/setup/')) {
                      router.push('/setup/account-books');
                  }
              }
          }
      }
    } catch (error) {
      console.error("加载账套列表失败", error);
    } finally {
      setLoading(false);
    }
  }, [activeBookId, router]);

  // --- 3. 初始加载 & 事件监听 (修复同步问题的关键) ---
  useEffect(() => {
    loadBooks();

    // 监听自定义事件 'ACCOUNT_BOOK_CHANGE'
    const handleBookChange = () => {
        console.log("Sidebar 收到账套变更通知，正在刷新列表...");
        loadBooks();
    };

    window.addEventListener('ACCOUNT_BOOK_CHANGE', handleBookChange);
    return () => {
        window.removeEventListener('ACCOUNT_BOOK_CHANGE', handleBookChange);
    };
  }, [loadBooks]);

  const currentBook = books.find(b => b.id === activeBookId);
  const isBookInitialized = currentBook?.isInitialized ?? false; 

  // --- 4. 切换账套 ---
  const handleSwitchBook = (newBookId: string) => {
    if (newBookId === 'create_new') {
      router.push('/setup/account-books');
      return;
    }
    setActiveBookId(newBookId);
    localStorage.setItem('lastActiveBookId', newBookId);

    if (router.pathname.startsWith('/setup')) {
        router.push(`/app/${newBookId}/dashboard`);
    } else {
        const currentPath = router.asPath;
        if (activeBookId && currentPath.includes(activeBookId)) {
            const newPath = currentPath.replace(activeBookId, newBookId);
            router.push(newPath);
        } else {
            router.push(`/app/${newBookId}/dashboard`);
        }
    }
  };

  // --- 5. 菜单配置 ---
  const menuItems = useMemo(() => {
    const prefix = activeBookId ? `/app/${activeBookId}` : '';
    return [
      { id: 'home', label: '工作台', icon: Home, path: `${prefix}/dashboard`, requiresInit: false },
      {
        id: 'funds', label: '资金管理', icon: Wallet, requiresInit: true,
        children: [
          { id: 'cashier-journal', label: '出纳日记账', path: `${prefix}/accounting/CashJournal` },
          { id: 'internal-transfer', label: '内部转账', path: `${prefix}/accounting/InternalTransfer` },
          { id: 'funds-summary', label: '资金汇总表', path: `${prefix}/reports/FundSummaryReport` }
        ]
      },
      {
        id: 'vouchers', label: '凭证中心', icon: FileText, requiresInit: true,
        children: [
          { id: 'voucher-entry', label: '凭证管理', path: `${prefix}/vouchers/management` },
          { id: 'voucher-management', label: '凭证汇总', path: `${prefix}/vouchers/summary` },
        ]
      },
      {
        id: 'ledgers', label: '账簿中心', icon: BookOpen, requiresInit: true,
        children: [
          { id: 'detail-ledger', label: '明细分类账', path: `${prefix}/reports/DetailedLedger` },
          { id: 'general-ledger', label: '总分类账', path: `${prefix}/reports/GeneralLedger` },
          { id: 'subject-balance', label: '科目余额表', path: `${prefix}/reports/SubjectBalance` },
          { id: 'reconciliation', label: '资金对账', path: `${prefix}/reports/ReconciliationReport` }
        ]
      },
      {
        id: 'closing', label: '期末结账', icon: Lock, requiresInit: true,
        children: [
          { id: 'period-closing', label: '期末结转', path: `${prefix}/accounting/PeriodClosing` }
        ]
      },
      {
        id: 'reports', label: '财务报表', icon: TrendingUp, requiresInit: true,
        children: [
          { id: 'balance-sheet', label: '资产负债表', path: `${prefix}/reports/BalanceSheet` },
          { id: 'income-statement', label: '利润表', path: `${prefix}/reports/IncomeStatement` },
          { id: 'cash-flow', label: '现金流量表', path: `${prefix}/reports/CashFlowStatement` }
        ]
      },
      { id: 'divider', label: '', icon: null },
      {
        id: 'settings', label: '系统设置', icon: Settings, requiresInit: false,
        children: [
          { id: 'subjects', label: '会计科目', path: `${prefix}/settings/subjects` },
          { id: 'auxiliary', label: '辅助核算', path: `${prefix}/settings/auxiliary` },
          { id: 'fund-accounts', label: '资金账户', path: `${prefix}/settings/fund-accounts` },
          { id: 'voucher-templates', label: '凭证模板', path: `${prefix}/settings/VoucherTemplateManagement` },
          { id: 'closing-templates', label: '结转模板', path: `${prefix}/settings/ClosingTemplateManagement` },
          { 
            id: 'initial-data', 
            label: '期初数据', 
            path: `${prefix}/settings/InitialDataEntry`,
            highlight: !isBookInitialized 
          },
          { id: 'account-book', label: '账套信息', path: `/setup/account-books` }, 
          { id: 'team', label: '团队管理', path: `/setup/team` },
        ]
      }
    ];
  }, [activeBookId, isBookInitialized]); 

  const handleMenuClick = (menuId: string, hasChildren: boolean, path?: string, disabled?: boolean) => {
    if (disabled) return;
    if (!hasChildren && path) {
      router.push(path);
    } else if (hasChildren) {
      setExpandedMenus(prev => 
        prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]
      );
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return router.asPath.startsWith(path);
  };

  return (
    <>
      <div className={cn("w-64 bg-gray-900 text-white h-screen flex flex-col fixed left-0 top-0 z-50 transition-all border-r border-gray-800 shadow-2xl", className)}>
        
        {/* 账套切换器 */}
        <div className="px-4 py-4 border-b border-gray-800 bg-gray-900 z-10">
           <div className="mb-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider">当前账套</div>
           
           {loading ? (
               <div className="h-9 w-full bg-gray-800 animate-pulse rounded" />
           ) : (
               <Select value={activeBookId || ''} onValueChange={handleSwitchBook}>
                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white h-9 text-xs focus:ring-offset-gray-900 focus:ring-1 focus:ring-blue-500 hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center truncate">
                          <Building2 className="w-3.5 h-3.5 mr-2 text-blue-400 shrink-0"/>
                          <span className="truncate font-medium">{currentBook?.name || "选择/切换账套..."}</span>
                      </div>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-gray-200 shadow-xl max-h-[300px]">
                    <SelectGroup>
                      <SelectLabel className="text-gray-500 text-[10px] uppercase tracking-wider pl-2 py-1.5">我的企业</SelectLabel>
                      {books.map((book) => (
                          <SelectItem 
                            key={book.id} 
                            value={book.id} 
                            className="focus:bg-gray-700 focus:text-white pl-2 cursor-pointer data-[state=checked]:bg-gray-700/50 text-xs py-2"
                          >
                              <div className="flex items-center justify-between w-full">
                                  <span className="truncate max-w-[140px]">{book.name}</span>
                                  {book.id === activeBookId && <Check className="w-3 h-3 text-blue-400 ml-2 shrink-0"/>}
                              </div>
                          </SelectItem>
                      ))}
                      </SelectGroup>
                      <SelectSeparator className="bg-gray-700 mx-1 my-1"/>
                      <SelectItem value="create_new" className="text-blue-400 focus:bg-gray-700 focus:text-blue-300 pl-2 cursor-pointer text-xs py-2">
                          <div className="flex items-center font-medium">
                              <PlusCircle className="w-3.5 h-3.5 mr-2" />
                              新建/管理账套
                          </div>
                      </SelectItem>
                    </SelectContent>
              </Select>
           )}
        </div>

        {/* 菜单区域 - 这里的 custom-scrollbar 样式由上方的 style jsx 控制 */}
        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {menuItems.map((menu: any) => {
            if (menu.id === 'divider') return <div key={menu.id} className="my-2 mx-4 border-t border-gray-800" />;

            const Icon = menu.icon;
            const hasChildren = !!(menu.children && menu.children.length > 0);
            const isExpanded = expandedMenus.includes(menu.id);
            const isParentActive = menu.path ? isActive(menu.path) : menu.children?.some((child: any) => isActive(child.path));
            const isBookSelected = !!activeBookId;
            const isDisabled = !isBookSelected || (menu.requiresInit && !isBookInitialized);
            
            return (
              <div key={menu.id} className="mb-1 group">
                <div
                  onClick={() => handleMenuClick(menu.id, hasChildren, menu.path, isDisabled)}
                  className={cn(
                    "mx-3 px-3 py-2 rounded-md flex items-center justify-between transition-all duration-200 text-sm cursor-pointer select-none",
                    isParentActive && !hasChildren && !isDisabled ? "bg-blue-600 text-white font-medium shadow-md shadow-blue-900/20" : "text-gray-400 hover:bg-gray-800 hover:text-white",
                    isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-400 grayscale pointer-events-none"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-4 h-4 opacity-80 group-hover:opacity-100" />}
                    <span>{menu.label}</span>
                  </div>
                  {hasChildren && (
                      <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                  )}
                </div>

                {/* 子菜单 */}
                {hasChildren && isExpanded && (
                  <div className="mt-1 ml-3 space-y-0.5 border-l border-gray-800 pl-3">
                    {menu.children?.map((child: any) => {
                      const isChildActive = isActive(child.path);
                      const isChildDisabled = isDisabled;

                      return (
                        <div
                          key={child.id}
                          onClick={() => handleMenuClick(child.id, false, child.path, isChildDisabled)}
                          className={cn(
                            "px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm flex items-center justify-between",
                            isChildActive ? "bg-gray-800 text-blue-400 font-medium border-l-2 border-blue-500 rounded-l-none -ml-px" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50",
                            child.highlight && !isChildDisabled ? "text-orange-400 bg-orange-950/20" : "",
                            isChildDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-500"
                          )}
                        >
                          <span className="truncate">{child.label}</span>
                          {child.highlight && !isChildDisabled && <AlertCircle className="w-3 h-3 text-orange-500"/>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        
        {/* 底部状态栏 */}
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 z-10">
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]", 
                    !activeBookId ? "bg-gray-600" :
                    !isBookInitialized ? "bg-orange-500" : "bg-emerald-500"
                )}></div>
                <span className="truncate">
                    {!activeBookId ? "未选择账套" :
                     !isBookInitialized ? "待初始化数据" : "系统运行正常"}
                </span>
            </div>
        </div>
      </div>
    </>
  );
}