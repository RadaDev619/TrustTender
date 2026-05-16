import { TenderDetailClient } from "@/components/routes/TenderDetailClient";

export function generateStaticParams() {
  return [];
}

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TenderDetailClient tenderId={id} />;
}
