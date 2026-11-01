import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import AdminWorkspaceConsole from '@/components/AdminWorkspaceConsole';

export default function AdminDashboardPage() {
  return (
    <WorkspaceRouteGuard workspace="admin">
      <AdminWorkspaceConsole section="dashboard" />
    </WorkspaceRouteGuard>
  );
}
