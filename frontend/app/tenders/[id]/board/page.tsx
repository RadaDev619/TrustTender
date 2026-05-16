import { TenderBoardClient } from "@/components/routes/TenderBoardClient";

export function generateStaticParams() {
  return [];
}

export default async function BoardVotingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TenderBoardClient tenderId={id} />;
}
