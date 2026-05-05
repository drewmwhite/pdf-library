import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { findDocument, markDocumentOpened } from "@/lib/db";
import { resolveStoragePath } from "@/lib/paths";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;
  const document = await findDocument(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const filePath = resolveStoragePath(document.storagePath);
    await stat(filePath);
    await markDocumentOpened(documentId);

    const webStream = Readable.toWeb(createReadStream(filePath));

    return new Response(webStream as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.sourceFilename.replaceAll('"', "")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored PDF file was not found" }, { status: 404 });
  }
}
