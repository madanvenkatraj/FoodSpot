import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import AdminWorkspaceConsole from '@/components/AdminWorkspaceConsole';

export default async function AdminRestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceRouteGuard workspace="admin">
      <AdminWorkspaceConsole section="restaurant-detail" entityId={id} />
    </WorkspaceRouteGuard>
  );
}
