import { useRouter } from 'next/router';
import AuxiliaryManagement from './AuxiliaryManagement';

export default function AuxiliaryPage() {
  const router = useRouter();
  return <AuxiliaryManagement onNavigate={(path) => router.push(path)} />;
}