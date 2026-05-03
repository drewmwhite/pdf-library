import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { parseAnnotationInput } from "@/lib/annotations";
import { isAuthenticated } from "@/lib/auth";
import type { AnnotationRecord } from "@/lib/documents";
import { addAnnotation, findDocument, listAnnotations } from "@/lib/db";

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

  return NextResponse.json({ annotations: await listAnnotations(documentId) });
}

export async function POST(
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

  const input = parseAnnotationInput(await request.json().catch(() => null));

  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const now = new Date().toISOString();
  const annotation: AnnotationRecord = {
    id: randomUUID(),
    documentId,
    kind: "highlight",
    pageNumber: input.pageNumber,
    color: input.color,
    note: input.note,
    selectedText: input.selectedText,
    rects: input.rects,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ annotation: await addAnnotation(annotation) }, { status: 201 });
}
