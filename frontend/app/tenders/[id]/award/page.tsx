import { TenderAwardClient } from "@/components/routes/TenderAwardClient";

export function generateStaticParams() {
  return [];
}

export default async function AwardSectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TenderAwardClient tenderId={id} />;
}
