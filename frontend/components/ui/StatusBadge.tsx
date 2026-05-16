import type { TenderState, ProofStatus } from "@/services/demoData";

type BadgeTone = "gray" | "green" | "blue" | "gold" | "maroon" | "red";

interface StatusBadgeProps {
  status:
    | TenderState
    | ProofStatus
    | "Signed"
    | "Pending"
    | "Encrypting"
    | "Encrypted"
    | "Hash generated"
    | "Submission proof ready"
    | "Recording proof"
    | "Recorded on Ethereum"
    | "Encrypted before storage"
    | "Locked until deadline"
    | "Evaluator signed"
    | "Board vote recorded"
    | "Ethereum proof recorded"
    | "Winner declared by majority vote"
    | "Proposal locked until deadline"
    | "Submissions closed"
    | "Evaluation unlocked"
    | `${number}/4 signed`
    | "Complete"
    | "Voted"
    | "Not voted"
    | "Tie requires chairperson decision"
    | "MOCK_CHAIN_CONFIRMED"
    | "CHAIN_CONFIRMED"
    | "Ready For Review"
    | "Evaluated"
    | "Awarded"
    | "Restricted"
    | "SUCCESS"
    | "BLOCKED"
    | "PROOF_RECORDED";
}

const toneByStatus: Record<string, BadgeTone> = {
  DRAFT: "gray",
  OPEN: "blue",
  CLOSED: "gold",
  EVALUATION: "maroon",
  BOARD_VOTING: "blue",
  AWARDED: "green",
  ARCHIVED: "gray",
  "Secure Proof Recorded": "green",
  "Pending Proof": "gold",
  "Blocked And Logged": "red",
  Signed: "green",
  Pending: "gold",
  Encrypting: "blue",
  Encrypted: "blue",
  "Hash generated": "green",
  "Submission proof ready": "blue",
  "Recording proof": "blue",
  "Recorded on Ethereum": "green",
  "Encrypted before storage": "blue",
  "Locked until deadline": "gold",
  "Evaluator signed": "green",
  "Board vote recorded": "green",
  "Ethereum proof recorded": "green",
  "Winner declared by majority vote": "green",
  "Proposal locked until deadline": "blue",
  "Submissions closed": "gold",
  "Evaluation unlocked": "green",
  "0/4 signed": "gold",
  "1/4 signed": "gold",
  "2/4 signed": "gold",
  "3/4 signed": "gold",
  "4/4 signed": "green",
  Complete: "green",
  Voted: "green",
  "Not voted": "gold",
  "Tie requires chairperson decision": "red",
  MOCK_CHAIN_CONFIRMED: "green",
  CHAIN_CONFIRMED: "green",
  "Ready For Review": "maroon",
  Evaluated: "green",
  Awarded: "green",
  Restricted: "gray",
  SUCCESS: "green",
  BLOCKED: "red",
  PROOF_RECORDED: "green",
};

const toneClasses: Record<BadgeTone, string> = {
  gray: "border-slate-200 bg-slate-50 text-slate-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  gold: "border-amber-200 bg-amber-50 text-amber-800",
  maroon: "border-red-200 bg-red-50 text-red-800",
  red: "border-rose-200 bg-rose-50 text-rose-800",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = toneByStatus[status] ?? "gray";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
