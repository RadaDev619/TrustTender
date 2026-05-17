"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, FilePlus2, ShieldCheck } from "lucide-react";
import { Permission, Role } from "@shared/mockBhutanNdiRbac";
import type { Tender, TenderState } from "@/services/demoData";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TxHashLink } from "@/components/ui/TxHashLink";
import { hashCanonicalJson } from "@/services/browserHash";
import { postAuditRelayer } from "@/services/auditRelayerClient";
import {
  type CreatedTenderRecord,
  upsertCreatedTenderRecord,
} from "@/services/createdTenderDb";

interface ProcurementApiTender {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: TenderState;
  tenderHash: string;
  ethereumTxHash?: string;
  evaluatorIds: string[];
  boardMemberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export function DemoTenderCreateForm() {
  const { session, currentUser } = useMockNdiSession();
  const [tenderId, setTenderId] = useState(() => makeTenderId());
  const [title, setTitle] = useState(
    "Trongsa Dzongkhag road maintenance package",
  );
  const [agency, setAgency] = useState("Ministry of Infrastructure");
  const [deadline, setDeadline] = useState(() => {
    const date = new Date(Date.now() + 2 * 60 * 1000);
    return toDateTimeLocalValue(date);
  });
  const [budget, setBudget] = useState("BTN 18.4M");
  const [description, setDescription] = useState(
    "Road maintenance works with sealed proposal submissions and four-member evaluation review.",
  );
  const [record, setRecord] = useState<CreatedTenderRecord | null>(null);
  const [busy, setBusy] = useState<"create" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canCreate = useMemo(
    () =>
      !!session &&
      currentUser?.role === Role.PROCUREMENT_OFFICER &&
      title.trim().length > 0 &&
      agency.trim().length > 0 &&
      description.trim().length > 0 &&
      new Date(deadline).getTime() > Date.now() &&
      !record &&
      !busy,
    [agency, busy, currentUser, deadline, description, record, session, title],
  );
  const canPublish =
    !!session &&
    currentUser?.role === Role.PROCUREMENT_OFFICER &&
    record?.tender.state === "DRAFT" &&
    !busy;

  async function handleCreateTender() {
    if (!session || currentUser?.role !== Role.PROCUREMENT_OFFICER) {
      setError("Switch to Karma Dorji, Procurement Officer, before creating.");
      return;
    }

    setBusy("create");
    setError(null);
    setSuccess(null);

    try {
      const timestamp = new Date().toISOString();
      const nextTenderId = tenderId.trim();
      const nextDeadline = new Date(deadline).toISOString();
      const nextTitle = title.trim();
      const nextDescription = description.trim();
      const tenderHash = await hashCanonicalJson({
        tenderId: nextTenderId,
        title: nextTitle,
        description: nextDescription,
        deadline: nextDeadline,
        createdBy: session.userId,
        createdAt: timestamp,
      });
      const receipt = await postAuditRelayer("tender-created", {
        tenderId: nextTenderId,
        tenderHash,
        actorHash: session.identityHash,
      });
      const tender: ProcurementApiTender = {
        id: nextTenderId,
        title: nextTitle,
        description: nextDescription,
        deadline: nextDeadline,
        status: "DRAFT",
        tenderHash,
        ethereumTxHash: receipt.txHash,
        evaluatorIds: [],
        boardMemberIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const nextRecord: CreatedTenderRecord = {
        tender: toDemoTender({
          apiTender: tender,
          agency,
          budget,
          lastAction: "Draft tender created",
        }),
        createTxHash: receipt.txHash,
        createdAt: timestamp,
      };

      upsertCreatedTenderRecord(nextRecord);
      setRecord(nextRecord);
      setSuccess("Tender created in DRAFT. Secure proof recorded.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setBusy(null);
    }
  }

  async function handlePublishTender() {
    if (!session || !record) return;

    setBusy("publish");
    setError(null);
    setSuccess(null);

    try {
      const timestamp = new Date().toISOString();
      const stageHash = await hashCanonicalJson({
        tenderId: record.tender.id,
        eventType: "TENDER_PUBLISHED",
        actorHash: session.identityHash,
        fromStatus: "DRAFT",
        toStatus: "OPEN",
        timestamp,
      });
      const receipt = await postAuditRelayer("stage-changed", {
        tenderId: record.tender.id,
        stageHash,
        actorHash: session.identityHash,
        requiredPermission: Permission.PUBLISH_TENDER,
      });
      const tender: ProcurementApiTender = {
        id: record.tender.id,
        title: record.tender.title,
        description: record.tender.lastAction,
        deadline: record.tender.deadline,
        status: "OPEN",
        tenderHash: record.tender.documentHash,
        ethereumTxHash: receipt.txHash,
        evaluatorIds: record.tender.evaluatorIds ?? [],
        boardMemberIds: record.tender.boardMemberIds ?? [],
        createdAt: record.createdAt,
        updatedAt: timestamp,
      };

      const nextRecord: CreatedTenderRecord = {
        ...record,
        tender: toDemoTender({
          apiTender: tender,
          agency: record.tender.agency,
          budget: record.tender.budget,
          lastAction: "Tender published for vendor proposals",
        }),
        publishTxHash: receipt.txHash,
        publishedAt: timestamp,
      };

      upsertCreatedTenderRecord(nextRecord);
      setRecord(nextRecord);
      setSuccess("Tender published to OPEN. Stage change proof recorded.");
    } catch (publishError) {
      setError(getErrorMessage(publishError));
    } finally {
      setBusy(null);
    }
  }

  function resetForm() {
    setTenderId(makeTenderId());
    setRecord(null);
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <form
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreateTender();
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700">
            <FilePlus2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Tender details
            </h2>
            <p className="text-sm text-slate-600">
              Create stores a draft record and records a secure proof.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Tender ID
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={tenderId}
              onChange={(event) => setTenderId(event.target.value)}
              disabled={!!record}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Tender title
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!!record}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Agency
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={agency}
              onChange={(event) => setAgency(event.target.value)}
              disabled={!!record}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Submission deadline
              <input
                type="datetime-local"
                step={1}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                disabled={!!record}
              />
              {!record ? (
                <div className="mt-1 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setDeadline(
                        toDateTimeLocalValue(
                          new Date(Date.now() + 2 * 60 * 1000),
                        ),
                      )
                    }
                    className="text-xs font-semibold text-gov-blue hover:underline"
                  >
                    Use 2 minute demo deadline
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeadline(
                        toDateTimeLocalValue(
                          new Date(Date.now() + 10 * 60 * 1000),
                        ),
                      )
                    }
                    className="text-xs font-semibold text-gov-blue hover:underline"
                  >
                    Use 10 minute submission window
                  </button>
                </div>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Budget estimate
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                disabled={!!record}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Tender description
            <textarea
              rows={5}
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!!record}
            />
          </label>
        </div>

        {error ? (
          <div className="mt-5">
            <MessageBanner tone="error" title="Action blocked" message={error} />
          </div>
        ) : null}
        {success ? (
          <div className="mt-5">
            <MessageBanner
              tone="success"
              title="Secure proof recorded"
              message={success}
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={!canCreate}
            className="inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {busy === "create" ? "Creating draft" : "Create Draft Tender"}
          </button>
          <button
            type="button"
            onClick={() => void handlePublishTender()}
            disabled={!canPublish}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            {busy === "publish" ? "Publishing" : "Publish Tender"}
          </button>
          {record ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Create another
            </button>
          ) : null}
          {record ? (
            <Link
              href={`/tenders/${record.tender.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-gov-green px-4 py-2 text-sm font-semibold text-gov-green hover:bg-emerald-50"
            >
              Open tender workspace
            </Link>
          ) : null}
        </div>
      </form>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h2 className="text-base font-semibold text-gov-ink">
            Action result
          </h2>
          {record ? (
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Tender</dt>
                <dd className="mt-1 font-semibold text-gov-ink">
                  {record.tender.id}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Current state</dt>
                <dd className="mt-1">
                  <StatusBadge status={record.tender.state} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Create proof</dt>
                <dd className="mt-1">
                  {record.createTxHash ? (
                    <TxHashLink txHash={record.createTxHash} />
                  ) : (
                    "Pending"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Publish proof</dt>
                <dd className="mt-1">
                  {record.publishTxHash ? (
                    <TxHashLink txHash={record.publishTxHash} />
                  ) : (
                    "Not published yet"
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Create a draft tender to see the generated proof and publish
              action.
            </p>
          )}
        </section>

        <MessageBanner
          tone="info"
          title="Demo note"
          message="Created tenders appear in the dashboard queue for this browser and drive the role-specific workflow pages."
        />
      </aside>
    </div>
  );
}

function toDemoTender({
  apiTender,
  agency,
  budget,
  lastAction,
}: {
  apiTender: ProcurementApiTender;
  agency: string;
  budget: string;
  lastAction: string;
}): Tender {
  return {
    id: apiTender.id,
    title: apiTender.title,
    agency,
    state: apiTender.status,
    evaluatorIds: apiTender.evaluatorIds,
    boardMemberIds: apiTender.boardMemberIds,
    version: "v1",
    createdByRole: Role.PROCUREMENT_OFFICER,
    lastAction,
    updatedAt: apiTender.updatedAt,
    deadline: apiTender.deadline,
    budget,
    proofStatus: "Secure Proof Recorded",
    documentHash: apiTender.tenderHash,
    storageRef: `encrypted://local/proposals/${apiTender.id}`,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The action could not be completed.";
}

function makeTenderId(): string {
  return `TT-DEMO-${Date.now().toString().slice(-6)}`;
}

function toDateTimeLocalValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}
