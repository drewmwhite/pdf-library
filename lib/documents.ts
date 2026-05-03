export type DocumentRecord = {
  id: string;
  title: string;
  sourceFilename: string;
  mimeType: "application/pdf";
  fileSizeBytes: number;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  bookmarkPageNumber: number | null;
  bookmarkedAt: string | null;
};

export type PublicDocument = Omit<DocumentRecord, "storagePath">;

export type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type AnnotationRecord = {
  id: string;
  documentId: string;
  pageNumber: number;
  kind: "highlight";
  color: string;
  note: string;
  selectedText: string;
  rects: HighlightRect[];
  createdAt: string;
  updatedAt: string;
};

export function toPublicDocument(document: DocumentRecord): PublicDocument {
  return {
    id: document.id,
    title: document.title,
    sourceFilename: document.sourceFilename,
    mimeType: document.mimeType,
    fileSizeBytes: document.fileSizeBytes,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    lastOpenedAt: document.lastOpenedAt,
    bookmarkPageNumber: document.bookmarkPageNumber,
    bookmarkedAt: document.bookmarkedAt,
  };
}

export function sanitizePdfTitle(filename: string) {
  return filename.replace(/\.pdf$/i, "").trim() || "Untitled PDF";
}
