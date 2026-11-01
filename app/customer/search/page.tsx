import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import CustomerWorkspaceApp from '@/components/CustomerWorkspaceApp';

export default function CustomerSearchPage() {
  return (
    <WorkspaceRouteGuard workspace="customer">
      <CustomerWorkspaceApp section="search" />
    </WorkspaceRouteGuard>
  );
}
