// 文件: ./components/RouteGuard.tsx

import { useEffect, useState } from 'react';
import { me } from '@/lib/mockData'; 
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner'; 
// 定义用户状态的类型
interface UserStatus {
  user: {
    id: string;
    email: string;
    name: string;
  };
  company: {
    id: string;
    name: string;
    has_account_book: boolean;
  } | null;
}

export default function RouteGuard({ children }: { children: any }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // ✅ 核心修改：白名单页面
  // 这些页面不需要登录即可访问
  const publicPages = [
    '/auth/LoginEntry',
    '/auth/LoginPassword',
    '/auth/register',
    '/auth/ResetPassword',  
    '/auth/ResetPasswordSent', 
    '/auth/SetNewPassword',
    '/setup/CreateCompany',
    '/join'
  ];
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      // 1. 检查是否被锁定
      const isLocked = typeof window !== 'undefined' && localStorage.getItem('TRIAL_BALANCE_ERROR') === 'true';
      
      // 2. 如果被锁定，且目标页面不是“期初数据录入页”
      // 注意：这里检查 URL 是否包含 InitialDataEntry，防止误判
      if (isLocked && !url.includes('/settings/InitialDataEntry')) {
        
        // 3. 给出提示
        toast.error("期初数据试算不平衡，系统已锁定！请先调平借贷差额后再离开。", {
          duration: 4000,
        });

        // 4. 🔴 抛出错误以强行中止 Next.js 的路由跳转
        // 这是 Next.js Pages Router 拦截跳转的标准 Hack 方法
        router.events.emit('routeChangeError');
        throw 'Abort route change due to trial balance imbalance';
      }
    };

    // 注册监听器
    router.events.on('routeChangeStart', handleRouteChangeStart);

    // 清理监听器
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [router]);

  useEffect(() => {
    // 标记组件是否挂载，防止异步操作导致的内存泄漏警告
    let isMounted = true;

    const run = async () => {
      // 获取当前路径（不含查询参数，例如 /join?token=... 这里的 pathname 只是 /join）
      const path = router.pathname;

      // 1. 白名单直接放行
      if (publicPages.includes(path)) {
        if (isMounted) setReady(true);
        return;
      }

      let status: UserStatus | null = null;

      try {
        // 调用接口获取用户信息
        status = (await me()) as UserStatus | null;
        
      } catch (error: any) {
        // 2. 优雅处理未登录错误
        // 如果是 401 或者 unauthorized，这是正常的“未登录”状态
        const isAuthError = 
            error?.message === 'unauthorized' || 
            error?.status === 401 ||
            error?.response?.status === 401 ||
            (error?.message && error.message.includes('not_found')); // 兼容 mockData 可能抛出的 not_found

        if (isAuthError) {
            // 静默跳转，避免开发模式红屏
            if (path !== '/auth/LoginEntry') {
                router.replace({
                    pathname: '/auth/LoginEntry',
                    query: { returnUrl: router.asPath } // 保存完整路径以便登录后跳回
                });
            }
            return; 
        }

        // 真正的系统错误（如断网、500错误）才打印出来
        console.error("RouteGuard 系统异常:", error);
        // 出错时也跳回登录页保险
        if (path !== '/auth/LoginEntry') {
            router.replace('/auth/LoginEntry');
        }
        return;
      }

      // 如果组件已经卸载，停止后续逻辑
      if (!isMounted) return;

      // 阶段 A: 鉴权检查 (Session)
      if (!status || !status.user?.id) {
        if (path !== '/auth/LoginEntry') {
          router.replace('/auth/LoginEntry');
        }
        return;
      }

      // 阶段 B: 公司初始化检查
      const hasCompany = !!status.company?.id;
      if (!hasCompany && path !== '/setup/CreateCompany') {
        router.push('/setup/CreateCompany');
        return;
      }

      // 阶段 C: 账套初始化检查
      // 注意：请确保你的路径是 /setup/account-books 还是 /settings/account-books，保持一致
      if (hasCompany) {
        const needAccountBook = !status.company!.has_account_book;
        // 假设你的账套管理页路径是 /setup/account-books
        const accountBookSetupPath = '/setup/account-books'; 
        
        if (needAccountBook && path !== accountBookSetupPath) {
          router.push(accountBookSetupPath);
          return;
        }
      }

      // 检查通过
      setReady(true);
    };

    // 确保路由准备好后再执行
    if (router.isReady) {
        run();
    }

    // 清理函数
    return () => {
        isMounted = false;
    };

  }, [router, router.pathname, router.isReady]);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return children;
}