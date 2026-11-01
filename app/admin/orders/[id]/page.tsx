import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import AdminWorkspaceConsole from '@/components/AdminWorkspaceConsole';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceRouteGuard workspace="admin">
      <AdminWorkspaceConsole section="order-detail" entityId={id} />
    </WorkspaceRouteGuard>
  );
}
