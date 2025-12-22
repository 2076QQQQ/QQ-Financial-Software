import MainLayout from '@/components/MainLayout';
// 引入你的组件
import TeamManagement from './TeamManagement'; 

export default function TeamPage() {
  return (
    <MainLayout>
      <TeamManagement />
    </MainLayout>
  );
}