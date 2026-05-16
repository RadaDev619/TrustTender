import { TenderEvaluationClient } from "@/components/routes/TenderEvaluationClient";

export function generateStaticParams() {
  return [];
}

export default async function EvaluationPanelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TenderEvaluationClient tenderId={id} />;
}
