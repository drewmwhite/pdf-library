import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { findDocument, updateDocumentBookmark } from "@/lib/db";
import { toPublicDocument } from "@/lib/documents";

function parsePageNumber(value: unknown) {
  if (typeof value !== "object" || value === null || !("pageNumber" in value)) {
    return null;
  }

  const pageNumber = value.pageNumber;

  if (typeof pageNumber !== "number" || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return null;
  }

  return pageNumber;
}

export async function PATCH(
  request: Request,
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

  const pageNumber = parsePageNumber(await request.json().catch(() => null));

  if (pageNumber === null) {
    return NextResponse.json({ error: "Page number must be a positive integer" }, { status: 400 });
  }

  const updatedDocument = await updateDocumentBookmark(documentId, pageNumber);

  if (!updatedDocument) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document: toPublicDocument(updatedDocument) });
}

export async function DELETE(
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

  const updatedDocument = await updateDocumentBookmark(documentId, null);

  if (!updatedDocument) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document: toPublicDocument(updatedDocument) });
}
