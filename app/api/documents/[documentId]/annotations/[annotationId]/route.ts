import { NextResponse } from "next/server";

import { parseAnnotationUpdateInput } from "@/lib/annotations";
import { isAuthenticated } from "@/lib/auth";
import { deleteAnnotation, findDocument, listAnnotations, updateAnnotation } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string; annotationId: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, annotationId } = await context.params;
  const document = await findDocument(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const existing = (await listAnnotations(documentId)).find((annotation) => annotation.id === annotationId);

  if (!existing) {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }

  const input = parseAnnotationUpdateInput(await request.json().catch(() => null), existing);

  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const annotation = await updateAnnotation(documentId, annotationId, input);

  return NextResponse.json({ annotation });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ documentId: string; annotationId: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, annotationId } = await context.params;
  const document = await findDocument(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (!(await deleteAnnotation(documentId, annotationId))) {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
