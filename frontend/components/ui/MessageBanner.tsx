import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface MessageBannerProps {
  tone: "success" | "warning" | "info" | "error";
  title: string;
  message: string;
}

const classes = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

export function MessageBanner({ tone, title, message }: MessageBannerProps) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;

  return (
    <div className={`rounded-lg border p-4 ${classes[tone]}`} role="status">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}
