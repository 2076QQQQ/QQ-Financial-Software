import { useEffect, useState } from 'react';
import { me } from '@/lib/api/auth';
import { useRouter } from 'next/router';

export default function RouteGuard({ children }: { children: any }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const run = async () => {
      try {
        const info = await me();
        if (!info.has_account_book) {
          router.push('/settings/account-books');
          return;
        }
        setReady(true);
      } catch {
        router.push('/auth/LoginEntry');
      }
    };
    run();
  }, [router]);
  if (!ready) return null;
  return children;
}