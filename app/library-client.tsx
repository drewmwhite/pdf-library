"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { PublicDocument } from "@/lib/documents";

type LibraryClientProps = {
  documents: PublicDocument[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LibraryClient({ documents }: LibraryClientProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrors([]);
    setIsUploading(true);

    const form = event.currentTarget;
    const files = (form.elements.namedItem("file") as HTMLInputElement).files;
    const title = (form.elements.namedItem("title") as HTMLInputElement | null)?.value.trim();

    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const uploadErrors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadProgress(fileList.length > 1 ? `Uploading ${i + 1} of ${fileList.length}...` : "Uploading...");

      const formData = new FormData();
      formData.append("file", file);
      if (fileList.length === 1 && title) {
        formData.append("title", title);
      }

      const response = await fetch("/api/documents", { method: "POST", body: formData });

      if (response.ok) {
        successCount++;
      } else {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        uploadErrors.push(`${file.name}: ${body?.error ?? "Upload failed"}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
    setErrors(uploadErrors);

    if (successCount > 0) {
      formRef.current?.reset();
      setFileCount(0);
      setMessage(successCount === 1 ? "PDF uploaded." : `${successCount} PDFs uploaded.`);
      router.refresh();
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1e2528]">
      <header className="border-b border-[#d8d0c2] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.08em] text-[#5d6f73]">
              Local PDF Library
            </p>
            <h1 className="text-3xl font-semibold">Documents</h1>
          </div>
          <button
            className="rounded-md border border-[#aab7b4] px-4 py-2 text-sm font-medium transition hover:bg-[#edf4f2]"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[320px_1fr]">
        <section className="h-fit rounded-lg border border-[#d8d0c2] bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Upload PDF</h2>
          <form ref={formRef} className="mt-5 space-y-4" onSubmit={handleUpload}>
            {fileCount <= 1 ? (
              <div>
                <label className="block text-sm font-medium" htmlFor="title">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  className="mt-2 h-10 w-full rounded-md border border-[#b9c3c0] px-3 outline-none transition focus:border-[#275e68] focus:ring-2 focus:ring-[#c6e0dc]"
                  placeholder="Optional"
                />
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium" htmlFor="file">
                PDF file{fileCount > 1 ? `s (${fileCount} selected)` : ""}
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#275e68] file:px-3 file:py-2 file:font-medium file:text-white hover:file:bg-[#1e4b52]"
                required
                onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
              />
            </div>
            {errors.length > 0 ? (
              <ul className="space-y-1">
                {errors.map((err) => (
                  <li key={err} className="text-sm font-medium text-[#a83232]">{err}</li>
                ))}
              </ul>
            ) : null}
            {message ? <p className="text-sm font-medium text-[#275e68]">{message}</p> : null}
            <button
              className="h-10 w-full rounded-md bg-[#275e68] px-4 font-medium text-white transition hover:bg-[#1e4b52] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUploading}
              type="submit"
            >
              {uploadProgress ?? (fileCount > 1 ? `Upload ${fileCount} PDFs` : "Upload")}
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-[#d8d0c2] bg-white shadow-sm">
          <div className="border-b border-[#e3ded4] px-5 py-4">
            <h2 className="text-xl font-semibold">Library</h2>
            <p className="mt-1 text-sm text-[#5d6f73]">
              {documents.length === 1 ? "1 document" : `${documents.length} documents`}
            </p>
          </div>

          {documents.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-lg font-medium">No PDFs uploaded yet.</p>
              <p className="mt-2 text-sm text-[#5d6f73]">
                Add one with the upload form and it will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#e3ded4]">
              {documents.map((document) => (
                <li
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  key={document.id}
                >
                  <div>
                    <h3 className="font-semibold">{document.title}</h3>
                    <p className="mt-1 text-sm text-[#5d6f73]">
                      {document.sourceFilename} · {formatBytes(document.fileSizeBytes)} · Uploaded{" "}
                      {formatDate(document.createdAt)}
                      {document.bookmarkPageNumber ? ` - Bookmark page ${document.bookmarkPageNumber}` : ""}
                    </p>
                  </div>
                  <a
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[#1e2528] px-4 text-sm font-medium text-white transition hover:bg-[#374145]"
                    href={`/documents/${document.id}`}
                  >
                    Open PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
