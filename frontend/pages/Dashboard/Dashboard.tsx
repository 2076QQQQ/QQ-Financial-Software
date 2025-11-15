import RouteGuard from '../../components/RouteGuard';

export default function DashboardPage() {
  return (
    <RouteGuard>
      <div className="p-6">首页工作台</div>
    </RouteGuard>
  );
}