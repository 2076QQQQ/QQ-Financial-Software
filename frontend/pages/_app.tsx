import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import RouteGuard from '../components/RouteGuard';
import MainLayout from '../components/MainLayout'; // 路径已更新

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // 定义公共页面 (不需要侧边栏)
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

  const isPublicPage = publicPages.includes(router.pathname);

  return (
    <RouteGuard>
      {isPublicPage ? (
        <Component {...pageProps} />
      ) : (
        // 修复：现在 MainLayout 接受 children，不再需要其他 props
        <MainLayout>
          <Component {...pageProps} />
        </MainLayout>
      )}
    </RouteGuard>
  );
}