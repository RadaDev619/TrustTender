import { redirect } from "next/navigation";

export default function LegacyCreateTenderRoute() {
  redirect("/tenders/new");
}
