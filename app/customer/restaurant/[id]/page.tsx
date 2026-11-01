import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import CustomerWorkspaceApp from '@/components/CustomerWorkspaceApp';

export default async function CustomerRestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceRouteGuard workspace="customer">
      <CustomerWorkspaceApp section="restaurant-detail" entityId={id} />
    </WorkspaceRouteGuard>
  );
}
