import type { Proposal } from "@/services/demoData";

export function getProposalAlias(
  proposalOrId: Proposal | string,
  proposals: Proposal[],
): string {
  const proposalId =
    typeof proposalOrId === "string" ? proposalOrId : proposalOrId.id;
  const ordered = [...proposals].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const index = Math.max(
    0,
    ordered.findIndex((proposal) => proposal.id === proposalId),
  );
  return `Proposal ${toAlphabeticIndex(index)}`;
}

export function getAnonymousProposalLabel(
  proposalOrId: Proposal | string,
  proposals: Proposal[],
): string {
  const proposalId =
    typeof proposalOrId === "string" ? proposalOrId : proposalOrId.id;
  return `${getProposalAlias(proposalId, proposals)} (${proposalId})`;
}

export function getProposalDisplayName({
  proposal,
  proposals,
  revealVendorName = false,
}: {
  proposal: Proposal;
  proposals: Proposal[];
  revealVendorName?: boolean;
}): string {
  return revealVendorName
    ? proposal.vendorName
    : getAnonymousProposalLabel(proposal, proposals);
}

export function getAwardDisplayName({
  proposal,
  proposals,
  winningProposalId,
  awardDeclared,
}: {
  proposal: Proposal;
  proposals: Proposal[];
  winningProposalId?: string | null;
  awardDeclared: boolean;
}): string {
  return awardDeclared && proposal.id === winningProposalId
    ? proposal.vendorName
    : getAnonymousProposalLabel(proposal, proposals);
}

function toAlphabeticIndex(index: number): string {
  let value = index;
  let label = "";

  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return label;
}
