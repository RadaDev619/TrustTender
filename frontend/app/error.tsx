"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold">Unable to load route</h1>
          <p className="mt-1 text-sm">
            {error.message || "The dashboard could not load this page."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
