import { useState } from 'react';
import { 
  Home, 
  Wallet, 
  FileText, 
  BookOpen, 
  Lock, 
  TrendingUp, 
  Settings,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path?: string;
  children?: {
    id: string;
    label: string;
    path: string;
  }[];
}

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isLocked?: boolean;
}

const menuItems: MenuItem[] = [
  {
    id: 'home',
    label: '首页',
    icon: Home,
    path: '/home'
  },
  {
    id: 'funds',
    label: '资金管理',
    icon: Wallet,
    children: [
      { id: 'cashier-journal', label: '出纳日记账', path: '/funds/journal' },
      { id: 'internal-transfer', label: '内部转账', path: '/funds/transfer' },
      { id: 'funds-summary', label: '资金汇总表', path: '/funds/summary' }
    ]
  },
  {
    id: 'vouchers',
    label: '凭证中心',
    icon: FileText,
    children: [
      { id: 'voucher-management', label: '凭证管理', path: '/vouchers/management' },
      { id: 'voucher-summary', label: '凭证汇总', path: '/vouchers/summary' }
    ]
  },
  {
    id: 'ledgers',
    label: '账簿中心',
    icon: BookOpen,
    children: [
      { id: 'detail-ledger', label: '明细分类账', path: '/ledgers/detail' },
      { id: 'general-ledger', label: '总分类账', path: '/ledgers/general' },
      { id: 'reconciliation', label: '核对总账与出纳账', path: '/ledgers/reconciliation' }
    ]
  },
  {
    id: 'closing',
    label: '期末结账',
    icon: Lock,
    children: [
      { id: 'period-closing', label: '执行期末结转', path: '/closing/execute' }
    ]
  },
  {
    id: 'reports',
    label: '财务报表',
    icon: TrendingUp,
    children: [
      { id: 'balance-sheet', label: '资产负债表', path: '/reports/balance-sheet' },
      { id: 'income-statement', label: '利润表', path: '/reports/income' },
      { id: 'cash-flow', label: '现金流量表', path: '/reports/cash-flow' }
    ]
  },
  {
    id: 'divider',
    label: '',
    icon: null
  },
  {
    id: 'settings',
    label: '系统设置',
    icon: Settings,
    children: [
      { id: 'account-books', label: '账套管理', path: '/settings/account-books' },
      { id: 'team-members', label: '团队成员管理', path: '/settings/team' },
      { id: 'subjects', label: '会计科目', path: '/settings/subjects' },
      { id: 'auxiliary', label: '辅助核算', path: '/settings/auxiliary' },
      { id: 'fund-accounts', label: '资金账户', path: '/settings/fund-accounts' },
      { id: 'categories', label: '收支类别', path: '/settings/categories' },
      { id: 'templates', label: '凭证模板', path: '/settings/templates' },
      { id: 'initial-data', label: '期初数据', path: '/settings/initial-data' }
    ]
  }
];

export default function Sidebar({ currentPath, onNavigate, isLocked = false }: SidebarProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['settings']); // 默认展开系统设置

  const handleMenuClick = (menuId: string, hasChildren: boolean, path?: string) => {
    if (!hasChildren && path) {
      // 没有子菜单，直接跳转
      onNavigate(path);
    } else if (hasChildren) {
      // 有子菜单，切换展开/收起状态
      setExpandedMenus(prev => 
        prev.includes(menuId) 
          ? prev.filter(id => id !== menuId)
          : [...prev, menuId]
      );
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  const isMenuActive = (menu: MenuItem) => {
    if (menu.path) return isActive(menu.path);
    if (menu.children) {
      return menu.children.some(child => isActive(child.path));
    }
    return false;
  };

  const canAccess = (menuId: string) => {
    // 首页和系统设置始终可访问
    if (menuId === 'home' || menuId === 'settings') return true;
    // 其他功能在锁定时不可访问
    return !isLocked;
  };

  return (
    <div className="w-56 bg-gray-900 text-white h-screen flex flex-col fixed left-0 top-0 z-50">
      {/* Logo区域 */}
      <div className="px-4 py-5 border-b border-gray-800">
        <h1 className="text-white">财务管理系统</h1>
        <p className="text-gray-400 text-xs mt-1">Finance Management</p>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((menu) => {
          // 分隔线
          if (menu.id === 'divider') {
            return <div key={menu.id} className="my-2 mx-4 border-t border-gray-800" />;
          }

          const Icon = menu.icon;
          const active = isMenuActive(menu);
          const accessible = canAccess(menu.id);
          const hasChildren = menu.children && menu.children.length > 0;
          const isExpanded = expandedMenus.includes(menu.id);

          return (
            <div key={menu.id} className="mb-1">
              {/* 父菜单项 */}
              <div
                onClick={() => accessible && handleMenuClick(menu.id, hasChildren, menu.path)}
                className={cn(
                  "mx-2 px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors",
                  accessible && "cursor-pointer",
                  active && "bg-blue-600 text-white",
                  !active && accessible && "text-gray-300 hover:bg-gray-800",
                  !accessible && "text-gray-600 cursor-not-allowed opacity-50"
                )}
              >
                <div className="flex items-center gap-2.5">
                  {Icon && <Icon className="w-4 h-4" />}
                  <span className="text-sm">{menu.label}</span>
                </div>
                {hasChildren && accessible && (
                  isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )
                )}
              </div>

              {/* 子菜单 - 嵌入在父菜单下方 */}
              {hasChildren && isExpanded && accessible && (
                <div className="mt-1 ml-4 space-y-0.5">
                  {menu.children?.map((child) => (
                    <div
                      key={child.id}
                      onClick={() => onNavigate(child.path)}
                      className={cn(
                        "px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                        isActive(child.path) 
                          ? "bg-blue-500 text-white" 
                          : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                      )}
                    >
                      {child.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 底部信息 */}
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">© 2025 财务系统</p>
      </div>
    </div>
  );
}
