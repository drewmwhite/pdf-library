import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PdfViewerClient } from "@/app/documents/[documentId]/pdf-viewer-client";
import { isAuthenticated } from "@/lib/auth";
import { findDocument } from "@/lib/db";
import { toPublicDocument } from "@/lib/documents";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const { documentId } = await params;
  const document = await findDocument(documentId);

  if (!document) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#1e2528]">
      <header className="border-b border-[#d8d0c2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-[#275e68] hover:underline" href="/">
              Back to library
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">{document.title}</h1>
            <p className="mt-1 text-sm text-[#5d6f73]">{document.sourceFilename}</p>
          </div>
          <a
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#aab7b4] px-4 text-sm font-medium transition hover:bg-[#edf4f2]"
            href={`/api/documents/${document.id}/file`}
            rel="noreferrer"
            target="_blank"
          >
            Open original
          </a>
        </div>
      </header>

      <PdfViewerClient document={toPublicDocument(document)} />
    </main>
  );
}
