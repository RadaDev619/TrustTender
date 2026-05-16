import {
  Award,
  DatabaseZap,
  FileLock2,
  Gavel,
  LockKeyhole,
  PenLine,
  type LucideIcon,
} from "lucide-react";

const proofLabels: Array<{
  label: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    label: "Encrypted before storage",
    icon: FileLock2,
    tone: "border-blue-200 bg-blue-50 text-blue-900",
  },
  {
    label: "Locked until deadline",
    icon: LockKeyhole,
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    label: "Evaluator signed",
    icon: PenLine,
    tone: "border-red-200 bg-red-50 text-red-900",
  },
  {
    label: "Board vote recorded",
    icon: Gavel,
    tone: "border-sky-200 bg-sky-50 text-sky-900",
  },
  {
    label: "Ethereum proof recorded",
    icon: DatabaseZap,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  {
    label: "Winner declared by majority vote",
    icon: Award,
    tone: "border-violet-200 bg-violet-50 text-violet-900",
  },
];

export function DemoProofLabels({ compact = false }: { compact?: boolean }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="px-4 py-3 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {!compact ? (
            <p className="mr-1 text-xs font-semibold uppercase text-slate-500">
              Judge proof chain
            </p>
          ) : null}
          {proofLabels.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${item.tone}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
