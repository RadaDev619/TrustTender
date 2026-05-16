import { TenderAuditClient } from "@/components/routes/TenderAuditClient";

export function generateStaticParams() {
  return [];
}

export default async function TenderAuditPage({
  params,
}: {
  params: Promise<{ tenderId: string }>;
}) {
  const { tenderId } = await params;
  return <TenderAuditClient tenderId={tenderId} />;
}
