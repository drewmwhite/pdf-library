import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "local-files", "data");
export const DB_PATH = path.join(DATA_DIR, "library.json");
export const LOCAL_FILES_DIR = path.join(process.cwd(), "local-files");
export const DOCUMENTS_DIR = path.join(LOCAL_FILES_DIR, "documents");

export function getDocumentDir(documentId: string) {
  return path.join(DOCUMENTS_DIR, documentId);
}

export function getDocumentStoragePath(documentId: string) {
  return path.join("local-files", "documents", documentId, "original.pdf");
}

export function resolveStoragePath(storagePath: string) {
  const normalized = path.normalize(storagePath);

  if (path.isAbsolute(normalized) || normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error("Invalid storage path");
  }

  const relativeToStorageRoot = path.relative("local-files", normalized);
  const resolved = path.resolve(LOCAL_FILES_DIR, relativeToStorageRoot);
  const storageRoot = path.resolve(LOCAL_FILES_DIR);

  if (!resolved.startsWith(storageRoot + path.sep)) {
    throw new Error("Invalid storage path");
  }

  return resolved;
}
