"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  DatabaseZap,
  FileCheck2,
  Hash,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Role } from "@shared/mockBhutanNdiRbac";
import type { Proposal, Tender } from "@/services/demoData";
import {
  PROPOSAL_SECTIONS,
  createProposalId,
  encryptProposalSections,
  type ProposalEncryptionManifest,
  type ProposalSectionName,
} from "@/services/proposalCrypto";
import {
  getSimulatedKmsReleaseDecision,
  storeProposalSectionKey,
} from "@/services/simulatedKms";
import {
  submitEncryptedProposal,
  type ProposalRelayerReceipt,
} from "@/services/proposalRelayer";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { formatDateTime, shortHash } from "@/lib/format";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProposalCard } from "@/components/ProposalCard";
import { DeadlineLockNotice } from "@/components/DeadlineLockNotice";

type SectionUiStatus = "Pending" | "Encrypting" | "Encrypted" | "Hash generated";
type ProofUiStatus =
  | "Pending"
  | "Submission proof ready"
  | "Recording proof"
  | "Recorded on Ethereum";

interface EncryptedProposalSubmissionFormProps {
  tender: Tender;
  existingProposals: Proposal[];
}

export function EncryptedProposalSubmissionForm({
  tender,
  existingProposals,
}: EncryptedProposalSubmissionFormProps) {
  const { currentUser } = useMockNdiSession();
  const [sectionText, setSectionText] = useState(() =>
    createSectionRecord(() => ""),
  );
  const [sectionStatus, setSectionStatus] = useState(() =>
    createSectionRecord<SectionUiStatus>(() => "Pending"),
  );
  const [proofStatus, setProofStatus] = useState<ProofUiStatus>("Pending");
  const [manifest, setManifest] = useState<ProposalEncryptionManifest | null>(
    null,
  );
  const [receipt, setReceipt] = useState<ProposalRelayerReceipt | null>(null);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<
    "idle" | "encrypting" | "recording" | "recorded" | "error"
  >("idle");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sampleLoadedForUserId, setSampleLoadedForUserId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const deadlinePassed = useMemo(
    () => nowMs >= new Date(tender.deadline).getTime(),
    [nowMs, tender.deadline],
  );
  const allSectionsFilled = PROPOSAL_SECTIONS.every(
    (section) => sectionText[section].trim().length > 0,
  );
  const kmsDecision = getSimulatedKmsReleaseDecision(currentUser, tender);
  const submitDisabled =
    submitState === "encrypting" ||
    submitState === "recording" ||
    !currentUser ||
    currentUser.role !== Role.VENDOR ||
    tender.state !== "OPEN" ||
    deadlinePassed ||
    !allSectionsFilled;

  useEffect(() => {
    if (
      !currentUser ||
      currentUser.role !== Role.VENDOR ||
      tender.state !== "OPEN" ||
      deadlinePassed ||
      sampleLoadedForUserId === currentUser.id
    ) {
      return;
    }

    const allSectionsEmpty = PROPOSAL_SECTIONS.every(
      (section) => sectionText[section].trim().length === 0,
    );
    const readyForNewVendor =
      submitState === "idle" || submitState === "recorded" || submitState === "error";

    if (!allSectionsEmpty && submitState !== "recorded") return;
    if (!readyForNewVendor) return;

    setError(null);
    setManifest(null);
    setReceipt(null);
    setActiveProposalId(null);
    setProofStatus("Pending");
    setSubmitState("idle");
    setSectionStatus(createSectionRecord(() => "Pending"));
    setSectionText(
      createSampleProposalContent(
        tender,
        currentUser.company ?? currentUser.name,
      ),
    );
    setSampleLoadedForUserId(currentUser.id);
  }, [
    currentUser,
    deadlinePassed,
    sampleLoadedForUserId,
    sectionText,
    submitState,
    tender,
  ]);

  async function handleSubmit() {
    if (!currentUser) {
      setError("Sign in with mock Bhutan NDI before submitting.");
      return;
    }
    if (currentUser.role !== Role.VENDOR) {
      setError("Only a vendor can submit a proposal.");
      return;
    }
    if (tender.state !== "OPEN") {
      setError("Proposal submission is available only while the tender is OPEN.");
      return;
    }
    if (deadlinePassed) {
      setError("The proposal deadline has passed.");
      return;
    }
    if (!allSectionsFilled) {
      setError("Complete all four proposal sections before submission.");
      return;
    }

    const proposalId = createProposalId(tender.id);
    setActiveProposalId(proposalId);
    setError(null);
    setReceipt(null);
    setManifest(null);
    setProofStatus("Pending");
    setSectionStatus(createSectionRecord(() => "Encrypting"));

    try {
      setSubmitState("encrypting");
      const result = await encryptProposalSections({
        tenderId: tender.id,
        proposalId,
        vendorIdentityHash: currentUser.identityHash,
        sections: PROPOSAL_SECTIONS.map((section) => ({
          section,
          fileName: `${proposalId}-${section}.txt`,
          mimeType: "text/plain",
          content: new Blob([sectionText[section]], { type: "text/plain" }),
        })),
        persistKey: storeProposalSectionKey,
        onSectionProgress: (section, progress) => {
          setSectionStatus((current) => ({
            ...current,
            [section]: progress,
          }));
        },
      });

      setManifest(result.manifest);
      setSectionText(createSectionRecord(() => ""));
      setProofStatus("Submission proof ready");
      setSubmitState("recording");
      setProofStatus("Recording proof");

      const nextReceipt = await submitEncryptedProposal(result.manifest);
      setReceipt(nextReceipt);
      setProofStatus("Recorded on Ethereum");
      setSubmitState("recorded");
    } catch (submissionError) {
      setSubmitState("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Proposal submission could not be completed.",
      );
    }
  }

  function loadSampleContent() {
    if (deadlinePassed) {
      setError("Submissions closed. The proposal deadline has passed.");
      return;
    }

    setError(null);
    setManifest(null);
    setReceipt(null);
    setProofStatus("Pending");
    setSubmitState("idle");
    setSectionStatus(createSectionRecord(() => "Pending"));
    setSectionText(
      createSampleProposalContent(
        tender,
        currentUser?.company ?? currentUser?.name ?? "Vendor",
      ),
    );
    setSampleLoadedForUserId(currentUser?.id ?? null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gov-ink">
                {tender.id}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{tender.title}</p>
              <p className="mt-2 text-sm text-slate-600">
                Deadline {formatDateTime(tender.deadline)}
              </p>
            </div>
            <StatusBadge status={tender.state} />
          </div>
        </section>

        <DeadlineLockNotice tender={tender} />

        {error ? (
          <MessageBanner tone="error" title="Submission blocked" message={error} />
        ) : null}
        {deadlinePassed ? (
          <MessageBanner
            tone="warning"
            title="Submissions closed"
            message="The deadline has passed. The submit button is disabled and proposal contents remain sealed for evaluation."
          />
        ) : null}
        {receipt ? (
          <MessageBanner
            tone="success"
            title="Secure proof recorded"
            message="Proposal hashes, timestamp, and submission proof are recorded. Proposal content remains off-chain."
          />
        ) : null}

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Proposal sections
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Four editable sample sections are prefilled for the selected
                vendor and encrypted separately at submission.
              </p>
            </div>
            <button
              type="button"
              onClick={loadSampleContent}
              disabled={deadlinePassed}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileCheck2 className="h-4 w-4" aria-hidden />
              Use sample content
            </button>
          </div>

          {PROPOSAL_SECTIONS.map((section) => (
            <section
              key={section}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label
                  htmlFor={`proposal-section-${section}`}
                  className="text-sm font-semibold text-gov-ink"
                >
                  {formatSectionLabel(section)}
                </label>
                <StatusBadge status={sectionStatus[section]} />
              </div>
              <textarea
                id={`proposal-section-${section}`}
                rows={5}
                value={sectionText[section]}
                onChange={(event) => {
                  setSectionText((current) => ({
                    ...current,
                    [section]: event.target.value,
                  }));
                  setSectionStatus((current) => ({
                    ...current,
                    [section]: "Pending",
                  }));
                  setProofStatus("Pending");
                  setSubmitState("idle");
                  setReceipt(null);
                  setManifest(null);
                }}
                disabled={submitState === "encrypting" || submitState === "recording"}
                readOnly={deadlinePassed}
                className="mt-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder={`${formatSectionLabel(section)} details`}
              />
            </section>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <div className="text-sm text-slate-600">
              {activeProposalId ? (
                <span>
                  Proposal reference{" "}
                  <span className="font-semibold text-slate-900">
                    {activeProposalId}
                  </span>
                </span>
              ) : (
                <span>Proposal reference will be generated at submission.</span>
              )}
            </div>
            <button
              type="submit"
              disabled={submitDisabled}
              className="inline-flex items-center gap-2 rounded-md bg-gov-green px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {getSubmitLabel(submitState)}
            </button>
          </div>
        </form>
      </div>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <h3 className="text-sm font-semibold text-gov-ink">
            Submission status
          </h3>
          <div className="mt-4 grid gap-3">
            <ProofStep
              icon={<LockKeyhole className="h-4 w-4" aria-hidden />}
              label="Encrypted before storage"
              status={manifest ? "Encrypted" : submitState === "encrypting" ? "Encrypting" : "Pending"}
            />
            <ProofStep
              icon={<Hash className="h-4 w-4" aria-hidden />}
              label="Hash generated"
              status={manifest ? "Hash generated" : "Pending"}
            />
            <ProofStep
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
              label="Submission proof ready"
              status={
                manifest || receipt ? "Submission proof ready" : "Pending"
              }
            />
            <ProofStep
              icon={<DatabaseZap className="h-4 w-4" aria-hidden />}
              label="Ethereum proof recorded"
              status={proofStatus}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-amber-50 text-amber-700">
              <KeyRound className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gov-ink">
                Key release control
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {kmsDecision.message}
              </p>
            </div>
          </div>
        </section>

        {manifest ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-sm font-semibold text-gov-ink">
              Proposal manifest
            </h3>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Manifest hash</dt>
                <dd className="mt-1 font-mono text-xs text-slate-900">
                  {shortHash(manifest.proposalManifestHash)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Vendor identity hash</dt>
                <dd className="mt-1 font-mono text-xs text-slate-900">
                  {shortHash(manifest.vendorIdentityHash)}
                </dd>
              </div>
              {receipt ? (
                <>
                  <div>
                    <dt className="text-slate-500">Proof hash</dt>
                    <dd className="mt-1 font-mono text-xs text-slate-900">
                      {shortHash(receipt.txHash)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Recorded</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {formatDateTime(receipt.recordedAt)}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
            <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
              {PROPOSAL_SECTIONS.map((section) => {
                const envelope = manifest.sections[section];
                return (
                  <div
                    key={section}
                    className="py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {formatSectionLabel(section)}
                      </span>
                      <StatusBadge status="Encrypted" />
                    </div>
                    <dl className="mt-3 grid gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500">Envelope hash</dt>
                        <dd className="mt-1 font-mono text-slate-900">
                          {shortHash(envelope.envelopeHash)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">IV</dt>
                        <dd className="mt-1 break-all font-mono text-slate-900">
                          {envelope.iv}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Encrypted reference</dt>
                        <dd className="mt-1 break-all font-mono text-slate-900">
                          {envelope.encryptedBlobRef}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {existingProposals.slice(0, 1).map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </aside>
    </div>
  );
}

function ProofStep({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: SectionUiStatus | ProofUiStatus;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span className="text-slate-500">{icon}</span>
        {label}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function createSectionRecord<T>(
  factory: (section: ProposalSectionName) => T,
): Record<ProposalSectionName, T> {
  return PROPOSAL_SECTIONS.reduce(
    (record, section) => {
      record[section] = factory(section);
      return record;
    },
    {} as Record<ProposalSectionName, T>,
  );
}

function createSampleProposalContent(
  tender: Tender,
  vendorName: string,
): Record<ProposalSectionName, string> {
  return {
    eligibility: `${vendorName}\nTender: ${tender.title}\nCompany registration, tax clearance, and procurement eligibility confirmed for demo submission.`,
    technical:
      "Method statement, delivery schedule, site supervision plan, safety approach, and quality assurance plan for the proposed works.",
    financial:
      "Itemized commercial offer with total price, validity period, payment milestones, and warranty commitments.",
    supporting:
      "Past project references, equipment availability, staffing summary, and signed declaration attachments listed for the procurement record.",
  };
}

function formatSectionLabel(section: ProposalSectionName): string {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function getSubmitLabel(
  state: "idle" | "encrypting" | "recording" | "recorded" | "error",
): string {
  if (state === "encrypting") return "Encrypting sections";
  if (state === "recording") return "Recording secure proof";
  if (state === "recorded") return "Recorded on Ethereum";
  if (state === "error") return "Try submission again";
  return "Encrypt and submit proposal";
}
