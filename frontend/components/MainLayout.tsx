import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/router';
import { Building2, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from './Sidebar'; 
import { me, logout } from '@/lib/api/auth';

interface UserStatus {
  user: { email: string; name?: string; companyName?: string };
  company: { has_account_book: boolean; has_initial_balances: boolean };
}

interface AppContextType {
  status: UserStatus | null;
  refreshStatus: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  status: null,
  refreshStatus: async () => {},
});

export const useApp = () => useContext(AppContext);

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const data = await me();
      setStatus(data);
    } catch (error) {
      console.error("Fetch user failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/LoginEntry');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isLocked = status?.company?.has_initial_balances === false;

  return (
    <AppContext.Provider value={{ status, refreshStatus: fetchUser }}>
      <div className="min-h-screen bg-gray-50">
        
        <Sidebar isLocked={isLocked} />

        <div className="pl-64 min-h-screen flex flex-col transition-all duration-300">
          {/* 顶部 Header */}
          <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
            <div className="px-6 py-2 flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg shadow-sm">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="leading-none">
                  <h2 className="text-gray-900 text-sm font-bold">{status?.user?.companyName || '财务中心'}</h2>
                  <p className="text-[10px] text-gray-500 mt-1">当前用户: {status?.user?.name || status?.user?.email || 'Guest'}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-red-600 hover:bg-red-50 h-9">
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </div>
          </header>

          {/* 
             ✅ 修复点：
             原 p-6 (24px) 改为 px-6 pt-2 pb-6 
             pt-2 只有 8px，大大缩小了与 Header 的距离
          */}
          <main className="flex-1 px-6 pt-2 pb-6 w-full overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}