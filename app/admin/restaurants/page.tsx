import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import AdminWorkspaceConsole from '@/components/AdminWorkspaceConsole';

export default function AdminRestaurantsPage() {
  return (
    <WorkspaceRouteGuard workspace="admin">
      <AdminWorkspaceConsole section="restaurants" />
    </WorkspaceRouteGuard>
  );
}
