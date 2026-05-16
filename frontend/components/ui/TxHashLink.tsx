import { ExternalLink } from "lucide-react";
import { shortHash } from "@/lib/format";

interface TxHashLinkProps {
  txHash: string;
}

export function TxHashLink({ txHash }: TxHashLinkProps) {
  return (
    <a
      href={`https://sepolia.etherscan.io/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-gov-blue hover:underline"
    >
      {shortHash(txHash)}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}
