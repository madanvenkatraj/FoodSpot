import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import CustomerWorkspaceApp from '@/components/CustomerWorkspaceApp';

export default function CustomerProfilePage() {
  return (
    <WorkspaceRouteGuard workspace="customer">
      <CustomerWorkspaceApp section="profile" />
    </WorkspaceRouteGuard>
  );
}
