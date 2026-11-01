import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import CustomerWorkspaceApp from '@/components/CustomerWorkspaceApp';

export default function CustomerFavoritesPage() {
  return (
    <WorkspaceRouteGuard workspace="customer">
      <CustomerWorkspaceApp section="favorites" />
    </WorkspaceRouteGuard>
  );
}
