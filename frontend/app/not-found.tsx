import Link from "next/link";
import { FileSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-panel">
      <FileSearch className="mx-auto h-8 w-8 text-slate-500" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-gov-ink">
        Procurement record not found
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        The requested tender or audit record is not available in the current
        demo seed.
      </p>
      <Link
        href="/audit"
        className="mt-5 inline-flex rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Open audit trail
      </Link>
    </div>
  );
}
