import { useRouter } from 'next/router';
import FundAccountManagement from './FundAccountManagement';

export default function FundAccountsPage() {
  const router = useRouter();
  return <FundAccountManagement onNavigate={(path) => router.push(path)} />;
}