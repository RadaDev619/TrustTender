export default function TenderLoading() {
  return (
    <div className="grid gap-6">
      <div className="h-10 w-72 rounded-md bg-slate-200" />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="h-80 rounded-lg border border-slate-200 bg-white shadow-panel" />
        <div className="h-80 rounded-lg border border-slate-200 bg-white shadow-panel" />
      </div>
      <div className="h-72 rounded-lg border border-slate-200 bg-white shadow-panel" />
    </div>
  );
}
