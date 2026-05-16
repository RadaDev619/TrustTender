export default function Loading() {
  return (
    <div className="grid gap-4">
      <div className="h-8 w-64 rounded-md bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-32 rounded-lg border border-slate-200 bg-white shadow-panel" />
        <div className="h-32 rounded-lg border border-slate-200 bg-white shadow-panel" />
        <div className="h-32 rounded-lg border border-slate-200 bg-white shadow-panel" />
      </div>
      <div className="h-72 rounded-lg border border-slate-200 bg-white shadow-panel" />
    </div>
  );
}
