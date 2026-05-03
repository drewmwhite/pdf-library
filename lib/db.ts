import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { DATA_DIR, DB_PATH, DOCUMENTS_DIR } from "@/lib/paths";
import type { AnnotationRecord, DocumentRecord } from "@/lib/documents";

export type LibraryDatabase = {
  schemaVersion: 3;
  documents: DocumentRecord[];
  annotations: AnnotationRecord[];
};

type LegacyV1LibraryDatabase = {
  schemaVersion: 1;
  documents: LegacyDocumentRecord[];
};

type LegacyV2LibraryDatabase = {
  schemaVersion: 2;
  documents: LegacyDocumentRecord[];
  annotations: AnnotationRecord[];
};

type LegacyDocumentRecord = Omit<DocumentRecord, "bookmarkedAt" | "bookmarkPageNumber"> & {
  bookmarkedAt?: string | null;
  bookmarkPageNumber?: number | null;
};

const INITIAL_DATABASE: LibraryDatabase = {
  schemaVersion: 3,
  documents: [],
  annotations: [],
};

async function ensureRuntimeStorage() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(DOCUMENTS_DIR, { recursive: true });
}

function withBookmarkFields(document: LegacyDocumentRecord): DocumentRecord {
  return {
    ...document,
    bookmarkPageNumber:
      typeof document.bookmarkPageNumber === "number" && Number.isInteger(document.bookmarkPageNumber)
        ? document.bookmarkPageNumber
        : null,
    bookmarkedAt: typeof document.bookmarkedAt === "string" ? document.bookmarkedAt : null,
  };
}

function isLegacyV1LibraryDatabase(value: unknown): value is LegacyV1LibraryDatabase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LegacyV1LibraryDatabase>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.documents);
}

function isLegacyV2LibraryDatabase(value: unknown): value is LegacyV2LibraryDatabase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LegacyV2LibraryDatabase>;
  return (
    candidate.schemaVersion === 2 &&
    Array.isArray(candidate.documents) &&
    Array.isArray(candidate.annotations)
  );
}

function isLibraryDatabase(value: unknown): value is LibraryDatabase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LibraryDatabase>;
  return (
    candidate.schemaVersion === 3 &&
    Array.isArray(candidate.documents) &&
    Array.isArray(candidate.annotations)
  );
}

export async function readDatabase(): Promise<LibraryDatabase> {
  await ensureRuntimeStorage();

  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (isLegacyV1LibraryDatabase(parsed)) {
      const migrated: LibraryDatabase = {
        schemaVersion: 3,
        documents: parsed.documents.map(withBookmarkFields),
        annotations: [],
      };
      await writeDatabase(migrated);
      return migrated;
    }

    if (isLegacyV2LibraryDatabase(parsed)) {
      const migrated: LibraryDatabase = {
        schemaVersion: 3,
        documents: parsed.documents.map(withBookmarkFields),
        annotations: parsed.annotations,
      };
      await writeDatabase(migrated);
      return migrated;
    }

    if (!isLibraryDatabase(parsed)) {
      throw new Error("Invalid library database shape");
    }

    return parsed;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      await writeDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }

    throw error;
  }
}

export async function writeDatabase(database: LibraryDatabase) {
  await ensureRuntimeStorage();

  const temporaryPath = `${DB_PATH}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await rename(temporaryPath, DB_PATH);
}

export async function addDocument(document: DocumentRecord) {
  const database = await readDatabase();
  database.documents.unshift(document);
  await writeDatabase(database);
  return document;
}

export async function listDocuments() {
  const database = await readDatabase();
  return database.documents;
}

export async function findDocument(documentId: string) {
  const database = await readDatabase();
  return database.documents.find((document) => document.id === documentId) ?? null;
}

export async function markDocumentOpened(documentId: string) {
  const database = await readDatabase();
  const document = database.documents.find((item) => item.id === documentId);

  if (!document) {
    return null;
  }

  const now = new Date().toISOString();
  document.lastOpenedAt = now;
  document.updatedAt = now;
  await writeDatabase(database);

  return document;
}

export async function updateDocumentBookmark(documentId: string, pageNumber: number | null) {
  const database = await readDatabase();
  const document = database.documents.find((item) => item.id === documentId);

  if (!document) {
    return null;
  }

  const now = new Date().toISOString();
  document.bookmarkPageNumber = pageNumber;
  document.bookmarkedAt = pageNumber === null ? null : now;
  document.updatedAt = now;
  await writeDatabase(database);

  return document;
}

export async function listAnnotations(documentId: string) {
  const database = await readDatabase();
  return database.annotations
    .filter((annotation) => annotation.documentId === documentId)
    .sort((left, right) => {
      if (left.pageNumber !== right.pageNumber) {
        return left.pageNumber - right.pageNumber;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
}

export async function addAnnotation(annotation: AnnotationRecord) {
  const database = await readDatabase();
  database.annotations.unshift(annotation);
  await writeDatabase(database);
  return annotation;
}

export async function updateAnnotation(
  documentId: string,
  annotationId: string,
  updates: Pick<AnnotationRecord, "color" | "note">,
) {
  const database = await readDatabase();
  const annotation = database.annotations.find(
    (item) => item.documentId === documentId && item.id === annotationId,
  );

  if (!annotation) {
    return null;
  }

  annotation.color = updates.color;
  annotation.note = updates.note;
  annotation.updatedAt = new Date().toISOString();
  await writeDatabase(database);

  return annotation;
}

export async function deleteAnnotation(documentId: string, annotationId: string) {
  const database = await readDatabase();
  const nextAnnotations = database.annotations.filter(
    (item) => !(item.documentId === documentId && item.id === annotationId),
  );

  if (nextAnnotations.length === database.annotations.length) {
    return false;
  }

  database.annotations = nextAnnotations;
  await writeDatabase(database);
  return true;
}
