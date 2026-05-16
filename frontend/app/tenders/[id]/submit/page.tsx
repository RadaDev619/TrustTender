import { TenderSubmitClient } from "@/components/routes/TenderSubmitClient";

export function generateStaticParams() {
  return [];
}

export default async function SubmitProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TenderSubmitClient tenderId={id} />;
}
