import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import AdminWorkspaceConsole from '@/components/AdminWorkspaceConsole';

export default function AdminOrdersPage() {
  return (
    <WorkspaceRouteGuard workspace="admin">
      <AdminWorkspaceConsole section="orders" />
    </WorkspaceRouteGuard>
  );
}
