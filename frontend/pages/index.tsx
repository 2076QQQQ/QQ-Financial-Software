import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 1. 尝试从浏览器缓存获取上次使用的账套 ID
    const lastBookId = localStorage.getItem('lastActiveBookId');

    // 2. 智能跳转逻辑
    if (lastBookId) {
      // 场景 A: 有缓存（老用户），直接进入上次的工作台
      router.replace(`/app/${lastBookId}/dashboard`);
    } else {
      // 场景 B: 无缓存（新用户/被邀请用户），跳转到账套管理页供选择
      router.replace('/setup/account-books');
    }
  }, [router]);

  // 3. 显示全屏加载动画，避免跳转过程出现白屏或闪烁
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
      <p className="text-sm text-gray-500 font-medium">正在进入系统...</p>
    </div>
  );
}