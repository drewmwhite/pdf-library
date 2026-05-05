"use client";

import dynamic from "next/dynamic";

import type { PublicDocument } from "@/lib/documents";

const PdfViewerClient = dynamic(
  () => import("./pdf-viewer-client").then((mod) => mod.PdfViewerClient),
  { ssr: false },
);

export function PdfViewerWrapper({ document }: { document: PublicDocument }) {
  return <PdfViewerClient document={document} />;
}
