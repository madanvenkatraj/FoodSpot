import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import CustomerWorkspaceApp from '@/components/CustomerWorkspaceApp';

export default function CustomerRestaurantsPage() {
  return (
    <WorkspaceRouteGuard workspace="customer">
      <CustomerWorkspaceApp section="restaurants" />
    </WorkspaceRouteGuard>
  );
}
