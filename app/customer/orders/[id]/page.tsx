import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import CustomerWorkspaceApp from '@/components/CustomerWorkspaceApp';

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceRouteGuard workspace="customer">
      <CustomerWorkspaceApp section="order-detail" entityId={id} />
    </WorkspaceRouteGuard>
  );
}
