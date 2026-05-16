"use client";

import { useEffect, useState } from "react";
import { Eye, KeyRound, LockKeyhole } from "lucide-react";
import type { Tender } from "@/services/demoData";
import {
  PROPOSAL_SECTIONS,
  decryptProposalSection,
  listStoredProposalManifests,
  ProposalCryptoStorageChangedEvent,
  type ProposalEncryptionManifest,
  type ProposalSectionName,
} from "@/services/proposalCrypto";
import {
  canEvaluatorAccessProposalSection,
  formatEvaluatorScope,
  getEvaluatorAllowedProposalSections,
  getProposalSectionKey,
  getSimulatedKmsReleaseDecision,
} from "@/services/simulatedKms";
import { useMockNdiSession } from "@/hooks/useMockNdiSession";
import { canShowProposalContent } from "@/services/deadlineLock";
import { shortHash } from "@/lib/format";
import { MessageBanner } from "@/components/ui/MessageBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface EvaluationDecryptionPanelProps {
  tender: Tender;
}

type DecryptedSections = Record<string, Partial<Record<ProposalSectionName, string>>>;

export function EvaluationDecryptionPanel({
  tender,
}: EvaluationDecryptionPanelProps) {
  const { currentUser } = useMockNdiSession();
  const [manifests, setManifests] = useState<ProposalEncryptionManifest[]>([]);
  const [decryptedSections, setDecryptedSections] =
    useState<DecryptedSections>({});
  const [error, setError] = useState<string | null>(null);
  const [busyManifestHash, setBusyManifestHash] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setManifests(listStoredProposalManifests(tender.id));
    refresh();
    window.addEventListener(ProposalCryptoStorageChangedEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ProposalCryptoStorageChangedEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [tender.id]);

  useEffect(() => {
    setDecryptedSections({});
    setError(null);
  }, [currentUser?.id, tender.id]);

  const kmsDecision = getSimulatedKmsReleaseDecision(currentUser, tender);
  const evaluationUnlocked = canShowProposalContent(tender);
  const allowedSections = getEvaluatorAllowedProposalSections(currentUser);
  const evaluatorScope = formatEvaluatorScope(currentUser);

  async function decryptManifest(manifest: ProposalEncryptionManifest) {
    setBusyManifestHash(manifest.proposalManifestHash);
    setError(null);
    try {
      if (allowedSections.length === 0) {
        throw new Error("This evaluator has no assigned proposal sections.");
      }

      const next: Partial<Record<ProposalSectionName, string>> = {};
      for (const section of allowedSections) {
        const { decision, key } = getProposalSectionKey({
          user: currentUser,
          tender,
          proposalId: manifest.proposalId,
          section,
        });
        if (!decision.allowed) {
          throw new Error(decision.message);
        }
        if (!key) {
          throw new Error(
            `No simulated KMS key found for ${formatSectionLabel(section)}.`,
          );
        }

        next[section] = await decryptProposalSection({
          envelope: manifest.sections[section],
          keyRecord: key,
        });
      }

      setDecryptedSections((current) => ({
        ...current,
        [manifest.proposalManifestHash]: next,
      }));
    } catch (decryptionError) {
      setError(
        decryptionError instanceof Error
          ? decryptionError.message
          : "Proposal sections could not be decrypted.",
      );
    } finally {
      setBusyManifestHash(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700">
            {kmsDecision.allowed ? (
              <KeyRound className="h-5 w-5" aria-hidden />
            ) : (
              <LockKeyhole className="h-5 w-5" aria-hidden />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gov-ink">
              Controlled decryption
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {kmsDecision.message}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Current evaluator scope: {evaluatorScope}
            </p>
          </div>
        </div>
        <StatusBadge
          status={evaluationUnlocked ? "Evaluation unlocked" : "Proposal locked until deadline"}
        />
      </div>

      {error ? (
        <div className="mt-4">
          <MessageBanner tone="error" title="Decryption blocked" message={error} />
        </div>
      ) : null}

      {manifests.length === 0 ? (
        <div className="mt-5">
          <MessageBanner
            tone="info"
            title="No local encrypted manifests"
            message="Proposals submitted through this browser will appear here for evaluator decryption when the tender is in EVALUATION."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {manifests.map((manifest) => {
            const decrypted = decryptedSections[manifest.proposalManifestHash];
            return (
              <article
                key={manifest.proposalManifestHash}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gov-ink">
                      Proposal {manifest.proposalId}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-slate-600">
                      Manifest {shortHash(manifest.proposalManifestHash)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void decryptManifest(manifest)}
                    disabled={
                      !evaluationUnlocked ||
                      !kmsDecision.allowed ||
                      allowedSections.length === 0 ||
                      busyManifestHash === manifest.proposalManifestHash
                    }
                    className="inline-flex items-center gap-2 rounded-md bg-gov-green px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    {busyManifestHash === manifest.proposalManifestHash
                      ? "Decrypting"
                      : "Decrypt assigned sections"}
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {PROPOSAL_SECTIONS.map((section) => {
                    const canAccessSection = canEvaluatorAccessProposalSection(
                      currentUser,
                      section,
                    );
                    const visibleDecryptedSection = canAccessSection
                      ? decrypted?.[section]
                      : null;
                    return (
                      <section
                        key={section}
                        className="rounded-md border border-slate-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">
                            {formatSectionLabel(section)}
                          </h4>
                          <StatusBadge
                            status={
                              visibleDecryptedSection
                                ? "Evaluation unlocked"
                                : canAccessSection
                                  ? "Encrypted"
                                  : "Restricted"
                            }
                          />
                        </div>
                        {visibleDecryptedSection ? (
                          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-900 p-3 text-xs leading-5 text-white">
                            {visibleDecryptedSection}
                          </pre>
                        ) : canAccessSection ? (
                          <p className="mt-2 text-sm text-slate-600">
                            Encrypted hash{" "}
                            {shortHash(manifest.sections[section].encryptedHash)}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-600">
                            This section is restricted to its assigned evaluator.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatSectionLabel(section: ProposalSectionName): string {
  return section.charAt(0).toUpperCase() + section.slice(1);
}
