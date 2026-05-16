import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { BhutanNdiLoginButton } from "@/components/BhutanNdiLoginButton";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gov-mist px-4 py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel md:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-6 text-sm font-semibold text-gov-green">
            Bhutan procurement trust platform
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-gov-ink md:text-4xl">
            TenderTrust
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Login with Bhutan NDI to verify employment identity, map a
            procurement role, and continue with the actions allowed for that
            role.
          </p>

          <div className="mt-8 grid max-w-md place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8">
            <div className="grid h-36 w-36 place-items-center rounded-lg border border-slate-300 bg-white text-center text-sm font-semibold text-slate-600">
              Mock QR
            </div>
            <p className="mt-4 text-sm font-medium text-slate-800">
              Scan with Bhutan NDI Wallet
            </p>
          </div>

          <Link
            href="/dashboard"
            className="mt-8 inline-flex rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Continue to dashboard
          </Link>
        </section>

        <BhutanNdiLoginButton />
      </div>
    </main>
  );
}
