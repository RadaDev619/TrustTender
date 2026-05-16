import { FileSearch } from "lucide-react";

interface EmptyStateProps {
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-panel">
      <FileSearch className="mx-auto h-8 w-8 text-slate-500" aria-hidden />
      <h3 className="mt-3 text-base font-semibold text-gov-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
