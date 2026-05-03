import { redirect } from "next/navigation";

import { LibraryClient } from "@/app/library-client";
import { isAuthenticated } from "@/lib/auth";
import { listDocuments } from "@/lib/db";
import { toPublicDocument } from "@/lib/documents";

export default async function Home() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const documents = await listDocuments();

  return <LibraryClient documents={documents.map(toPublicDocument)} />;
}
