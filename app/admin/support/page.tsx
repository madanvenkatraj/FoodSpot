import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import AdminWorkspaceConsole from '@/components/AdminWorkspaceConsole';

export default function AdminSupportPage() {
  return (
    <WorkspaceRouteGuard workspace="admin">
      <AdminWorkspaceConsole section="support" />
    </WorkspaceRouteGuard>
  );
}
