"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  clearStoredMockNdiSession,
} from "@/services/mockNdiSession";
import { clearEncryptedProposalStorage } from "@/services/proposalCrypto";
import { clearSimulatedKms } from "@/services/simulatedKms";
import { clearRuntimeTenderState } from "@/services/demoTenderRuntime";
import { clearEvaluationSignatureDb } from "@/services/evaluationSignatureDb";
import { clearBoardVoteDb } from "@/services/boardVoteDb";
import { clearAwardDecisionDb } from "@/services/awardDecisionDb";
import { clearCreatedTenderDb } from "@/services/createdTenderDb";

export function DemoSeedPanel() {
  const [message, setMessage] = useState<string | null>(null);

  function clearMutableDemoState() {
    clearEncryptedProposalStorage();
    clearSimulatedKms();
    clearRuntimeTenderState();
    clearEvaluationSignatureDb();
    clearBoardVoteDb();
    clearAwardDecisionDb();
    clearCreatedTenderDb();
  }

  function handleResetDemo() {
    clearStoredMockNdiSession();
    clearMutableDemoState();
    setMessage("Workflow reset complete. Select a mock NDI user to begin.");
    window.setTimeout(() => window.location.reload(), 450);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gov-ink">
            Workflow controls
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Reset clears live tenders, encrypted proposal storage, signatures,
            votes, awards, and the current mock NDI session.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset workflow
          </button>
        </div>
      </div>
      {message ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          {message}
        </p>
      ) : null}
    </section>
  );
}
