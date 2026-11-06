'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import type { WorkspaceType } from '@/lib/db/models';

interface WorkspaceRouteGuardProps {
  workspace: WorkspaceType;
  children: React.ReactNode;
}

export default function WorkspaceRouteGuard({
  workspace,
  children,
}: WorkspaceRouteGuardProps) {
  const router = useRouter();
  const {
    customerUser,
    customerAuthReady,
    adminUser,
    adminAuthReady,
    revalidateWorkspace,
  } = useWorkspace();

  const [checking, setChecking] = useState(true);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      void (async () => {
        const result = await revalidateWorkspace(workspace);
        if (cancelled) return;

        if (!result.authenticated || !result.user) {
          router.replace(workspace === 'admin' ? '/admin/login' : '/customer/login');
          return;
        }

        if (!result.user.allowedWorkspaces?.includes(workspace)) {
          setDeniedMessage(
            `Access Denied: Your account is not authorized for the ${workspace} workspace.`
          );
          setChecking(false);
          return;
        }

        setDeniedMessage(null);
        setChecking(false);
      })();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [workspace, revalidateWorkspace, router]);

  const isReady = workspace === 'admin' ? adminAuthReady : customerAuthReady;
  const activeUser = workspace === 'admin' ? adminUser : customerUser;

  if (checking || !isReady) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm max-w-sm w-full space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 animate-pulse">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="font-display text-base font-extrabold text-stone-900">
            Verifying {workspace === 'admin' ? 'Admin Console' : 'Customer App'} Session...
          </h2>
          <p className="text-xs text-stone-500">
            Validating workspace authorization &amp; session token
          </p>
        </div>
      </div>
    );
  }

  if (deniedMessage || !activeUser) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-stone-800 bg-stone-900 p-8 text-center space-y-5 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-extrabold">Workspace Access Restricted</h1>
          <p className="text-xs text-stone-300 leading-relaxed">
            {deniedMessage ||
              `Please sign in with an authorized ${workspace} account to access this workspace.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href={workspace === 'admin' ? '/admin/login' : '/customer/login'}
              className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-xs font-bold text-white hover:bg-orange-700"
            >
              Sign In to {workspace === 'admin' ? 'Admin Console' : 'Customer App'}
            </Link>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 px-4 py-3 text-xs font-bold text-stone-200 hover:bg-stone-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Workspace Selection
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
