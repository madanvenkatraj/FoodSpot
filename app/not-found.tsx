import Link from 'next/link';
import { ArrowLeft, Compass, Flame, ShieldCheck } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-xl space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-md">
          <Flame className="h-7 w-7" />
        </div>
        <div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-orange-700">
            Error 404
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-stone-950">
            Route Not Found
          </h1>
          <p className="mt-1.5 text-xs text-stone-500 leading-relaxed">
            The page you requested does not exist in the FoodSpot Customer App or Admin Console
            workspaces.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Link
            href="/customer/home"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-4 py-3 text-xs font-bold text-white hover:bg-orange-700"
          >
            <Compass className="h-4 w-4" />
            Customer App
          </Link>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white hover:bg-stone-800"
          >
            <ShieldCheck className="h-4 w-4" />
            Admin Console
          </Link>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-900 pt-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Return to Workspace Selection (/)
        </Link>
      </div>
    </div>
  );
}
