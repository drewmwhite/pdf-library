import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { addDocument, listDocuments } from "@/lib/db";
import { sanitizePdfTitle, toPublicDocument, type DocumentRecord } from "@/lib/documents";
import { getDocumentDir, getDocumentStoragePath, resolveStoragePath } from "@/lib/paths";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await listDocuments();
  return NextResponse.json({ documents: documents.map(toPublicDocument) });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const uploadedFile = formData.get("file");
  const requestedTitle = formData.get("title");

  if (!(uploadedFile instanceof File)) {
    return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
  }

  if (!uploadedFile.name.toLowerCase().endsWith(".pdf") || uploadedFile.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are allowed" }, { status: 400 });
  }

  const documentId = randomUUID();
  const documentDir = getDocumentDir(documentId);
  const storagePath = getDocumentStoragePath(documentId);
  const absoluteStoragePath = resolveStoragePath(storagePath);
  const title =
    typeof requestedTitle === "string" && requestedTitle.trim()
      ? requestedTitle.trim()
      : sanitizePdfTitle(uploadedFile.name);

  await mkdir(documentDir, { recursive: true });
  await writeFile(absoluteStoragePath, Buffer.from(await uploadedFile.arrayBuffer()));

  const now = new Date().toISOString();
  const document: DocumentRecord = {
    id: documentId,
    title,
    sourceFilename: path.basename(uploadedFile.name),
    mimeType: "application/pdf",
    fileSizeBytes: uploadedFile.size,
    storagePath,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    bookmarkPageNumber: null,
    bookmarkedAt: null,
  };

  await addDocument(document);

  return NextResponse.json({ document: toPublicDocument(document) }, { status: 201 });
}
