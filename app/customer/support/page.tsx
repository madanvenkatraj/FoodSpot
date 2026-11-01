import WorkspaceRouteGuard from '@/components/WorkspaceRouteGuard';
import CustomerWorkspaceApp from '@/components/CustomerWorkspaceApp';

export default function CustomerSupportPage() {
  return (
    <WorkspaceRouteGuard workspace="customer">
      <CustomerWorkspaceApp section="support" />
    </WorkspaceRouteGuard>
  );
}
