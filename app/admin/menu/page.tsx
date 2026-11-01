import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import AdminWorkspaceConsole from '@/components/AdminWorkspaceConsole';

export default function AdminMenuPage() {
  return (
    <WorkspaceRouteGuard workspace="admin">
      <AdminWorkspaceConsole section="menu" />
    </WorkspaceRouteGuard>
  );
}
