"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import { DEFAULT_HIGHLIGHT_COLOR, HIGHLIGHT_COLORS } from "@/lib/annotations";
import type { AnnotationRecord, HighlightRect, PublicDocument } from "@/lib/documents";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url,
).toString();

type PdfViewerClientProps = {
  document: PublicDocument;
};

type PendingHighlight = {
  pageNumber: number;
  rects: HighlightRect[];
  selectedText: string;
  note: string;
  color: string;
};

type PageSize = {
  pageNumber: number;
  width: number;
  height: number;
};

type PdfOutlineItem = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number];
type PdfPageRef = Parameters<PDFDocumentProxy["getPageIndex"]>[0];

type ChapterLink = {
  id: string;
  title: string;
  pageNumber: number | null;
  children: ChapterLink[];
};

function getAnnotationLabel(annotation: AnnotationRecord) {
  return annotation.note || annotation.selectedText || "Untitled highlight";
}

function clampScale(value: number) {
  return Math.min(2.5, Math.max(0.6, value));
}

function normalizeSelectionRects(pageElement: HTMLElement, range: Range) {
  const pageBounds = pageElement.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .map((rect) => {
      const left = Math.max(rect.left, pageBounds.left);
      const top = Math.max(rect.top, pageBounds.top);
      const right = Math.min(rect.right, pageBounds.right);
      const bottom = Math.min(rect.bottom, pageBounds.bottom);
      const width = right - left;
      const height = bottom - top;

      if (width <= 1 || height <= 1) {
        return null;
      }

      return {
        left: (left - pageBounds.left) / pageBounds.width,
        top: (top - pageBounds.top) / pageBounds.height,
        width: width / pageBounds.width,
        height: height / pageBounds.height,
      };
    })
    .filter((rect): rect is HighlightRect => rect !== null);

  return rects;
}

function isPdfPageRef(value: unknown): value is PdfPageRef {
  return typeof value === "object" && value !== null && "num" in value && "gen" in value;
}

async function resolveDestinationPageNumber(
  pdf: PDFDocumentProxy,
  dest: PdfOutlineItem["dest"],
) {
  const explicitDestination = typeof dest === "string" ? await pdf.getDestination(dest) : dest;

  if (!Array.isArray(explicitDestination) || explicitDestination.length === 0) {
    return null;
  }

  const pageReference = explicitDestination[0] as unknown;

  if (typeof pageReference === "number") {
    return pageReference + 1;
  }

  if (isPdfPageRef(pageReference)) {
    return (await pdf.getPageIndex(pageReference)) + 1;
  }

  return null;
}

async function buildChapterTree(
  pdf: PDFDocumentProxy,
  items: PdfOutlineItem[],
  parentId = "chapter",
): Promise<ChapterLink[]> {
  const chapters: ChapterLink[] = [];

  for (const [index, item] of items.entries()) {
    const id = `${parentId}-${index}`;
    const pageNumber = await resolveDestinationPageNumber(pdf, item.dest).catch(() => null);

    chapters.push({
      id,
      title: item.title || "Untitled chapter",
      pageNumber,
      children: Array.isArray(item.items)
        ? await buildChapterTree(pdf, item.items as PdfOutlineItem[], id)
        : [],
    });
  }

  return chapters;
}

export function PdfViewerClient({ document }: PdfViewerClientProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const hasJumpedToBookmark = useRef(false);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [chapters, setChapters] = useState<ChapterLink[]>([]);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(() => new Set());
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [pendingHighlight, setPendingHighlight] = useState<PendingHighlight | null>(null);
  const [scale, setScale] = useState(1.15);
  const [currentPage, setCurrentPage] = useState(document.bookmarkPageNumber ?? 1);
  const [pageInput, setPageInput] = useState(String(document.bookmarkPageNumber ?? 1));
  const [bookmarkPageNumber, setBookmarkPageNumber] = useState(document.bookmarkPageNumber);
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);

  const activeAnnotation = annotations.find((annotation) => annotation.id === activeAnnotationId) ?? null;

  const annotationsByPage = useMemo(() => {
    const grouped = new Map<number, AnnotationRecord[]>();

    for (const annotation of annotations) {
      grouped.set(annotation.pageNumber, [...(grouped.get(annotation.pageNumber) ?? []), annotation]);
    }

    return grouped;
  }, [annotations]);

  const loadAnnotations = useCallback(async () => {
    const response = await fetch(`/api/documents/${document.id}/annotations`);

    if (!response.ok) {
      throw new Error("Could not load annotations");
    }

    const body = (await response.json()) as { annotations: AnnotationRecord[] };
    setAnnotations(body.annotations);
  }, [document.id]);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument(`/api/documents/${document.id}/file`);

    async function loadPdf() {
      try {
        const loadedPdf = await loadingTask.promise;

        if (cancelled) {
          return;
        }

        const sizes = await Promise.all(
          Array.from({ length: loadedPdf.numPages }, async (_, index) => {
            const pageNumber = index + 1;
            const page = await loadedPdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1 });
            return { pageNumber, width: viewport.width, height: viewport.height };
          }),
        );

        if (!cancelled) {
          const outlineItems = await loadedPdf.getOutline().catch(() => null);
          const chapterLinks = outlineItems
            ? await buildChapterTree(loadedPdf, outlineItems as PdfOutlineItem[])
            : [];

          setPdf(loadedPdf);
          setPageSizes(sizes);
          setChapters(chapterLinks);
          await loadAnnotations();
        }
      } catch {
        if (!cancelled) {
          setError("The PDF could not be loaded.");
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [document.id, loadAnnotations]);

  function registerPage(pageNumber: number, element: HTMLDivElement | null) {
    if (element) {
      pageRefs.current.set(pageNumber, element);
    } else {
      pageRefs.current.delete(pageNumber);
    }
  }

  function handleMouseUp() {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const selectedText = selection.toString().trim();

    if (!selectedText) {
      return;
    }

    const range = selection.getRangeAt(0);

    for (const [pageNumber, element] of pageRefs.current.entries()) {
      const rects = normalizeSelectionRects(element, range);

      if (rects.length > 0) {
        setPendingHighlight({
          pageNumber,
          rects,
          selectedText,
          note: "",
          color: DEFAULT_HIGHLIGHT_COLOR,
        });
        setActiveAnnotationId(null);
        return;
      }
    }
  }

  async function createHighlight() {
    if (!pendingHighlight) {
      return;
    }

    setIsSaving(true);
    const response = await fetch(`/api/documents/${document.id}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingHighlight),
    });
    setIsSaving(false);

    if (!response.ok) {
      setError("The highlight could not be saved.");
      return;
    }

    const body = (await response.json()) as { annotation: AnnotationRecord };
    setAnnotations((items) => [body.annotation, ...items]);
    setActiveAnnotationId(body.annotation.id);
    setPendingHighlight(null);
    window.getSelection()?.removeAllRanges();
  }

  async function updateAnnotation(annotation: AnnotationRecord) {
    setIsSaving(true);
    const response = await fetch(`/api/documents/${document.id}/annotations/${annotation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: annotation.color, note: annotation.note }),
    });
    setIsSaving(false);

    if (!response.ok) {
      setError("The annotation could not be updated.");
      return;
    }

    const body = (await response.json()) as { annotation: AnnotationRecord };
    setAnnotations((items) => items.map((item) => (item.id === body.annotation.id ? body.annotation : item)));
  }

  async function deleteActiveAnnotation() {
    if (!activeAnnotation) {
      return;
    }

    setIsSaving(true);
    const response = await fetch(`/api/documents/${document.id}/annotations/${activeAnnotation.id}`, {
      method: "DELETE",
    });
    setIsSaving(false);

    if (!response.ok) {
      setError("The annotation could not be deleted.");
      return;
    }

    setAnnotations((items) => items.filter((item) => item.id !== activeAnnotation.id));
    setActiveAnnotationId(null);
  }

  const jumpToPage = useCallback((pageNumber: number) => {
    const nextPage = Math.min(Math.max(pageNumber, 1), pdf?.numPages ?? 1);
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
    pageRefs.current.get(nextPage)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pdf]);

  function handleVisiblePageChange(pageNumber: number) {
    setCurrentPage(pageNumber);
    setPageInput(String(pageNumber));
  }

  function submitPageJump() {
    const requestedPage = Number(pageInput);

    if (!Number.isInteger(requestedPage)) {
      setPageInput(String(currentPage));
      return;
    }

    jumpToPage(requestedPage);
  }

  useEffect(() => {
    if (!pdf || !bookmarkPageNumber || hasJumpedToBookmark.current) {
      return;
    }

    hasJumpedToBookmark.current = true;
    const targetPage = Math.min(bookmarkPageNumber, pdf.numPages);
    const timeout = window.setTimeout(() => jumpToPage(targetPage), 100);

    return () => window.clearTimeout(timeout);
  }, [bookmarkPageNumber, jumpToPage, pdf]);

  async function saveBookmark() {
    if (!pdf) {
      return;
    }

    const pageNumber = Math.min(Math.max(currentPage, 1), pdf.numPages);
    setIsBookmarkSaving(true);
    setBookmarkMessage(null);
    const response = await fetch(`/api/documents/${document.id}/bookmark`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageNumber }),
    });
    setIsBookmarkSaving(false);

    if (!response.ok) {
      setBookmarkMessage("Bookmark could not be saved.");
      return;
    }

    setBookmarkPageNumber(pageNumber);
    setBookmarkMessage(`Bookmarked page ${pageNumber}.`);
  }

  async function clearBookmark() {
    setIsBookmarkSaving(true);
    setBookmarkMessage(null);
    const response = await fetch(`/api/documents/${document.id}/bookmark`, {
      method: "DELETE",
    });
    setIsBookmarkSaving(false);

    if (!response.ok) {
      setBookmarkMessage("Bookmark could not be cleared.");
      return;
    }

    setBookmarkPageNumber(null);
    setBookmarkMessage("Bookmark cleared.");
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapterIds((current) => {
      const next = new Set(current);

      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }

      return next;
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8d0c2] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3ded4] px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              className="h-9 rounded-md border border-[#aab7b4] px-3 text-sm font-medium transition hover:bg-[#edf4f2] disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => jumpToPage(currentPage - 1)}
              type="button"
            >
              Prev
            </button>
            <span className="text-sm text-[#5d6f73]">
              Page {currentPage} of {pdf?.numPages ?? "-"}
            </span>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitPageJump();
              }}
            >
              <input
                aria-label="Page number"
                className="h-9 w-20 rounded-md border border-[#aab7b4] px-2 text-sm outline-none transition focus:border-[#275e68] focus:ring-2 focus:ring-[#c6e0dc]"
                disabled={!pdf}
                inputMode="numeric"
                max={pdf?.numPages}
                min={1}
                onBlur={submitPageJump}
                onChange={(event) => setPageInput(event.target.value)}
                type="number"
                value={pageInput}
              />
              <button
                className="h-9 rounded-md border border-[#aab7b4] px-3 text-sm font-medium transition hover:bg-[#edf4f2] disabled:opacity-50"
                disabled={!pdf}
                type="submit"
              >
                Go
              </button>
            </form>
            <button
              className="h-9 rounded-md border border-[#aab7b4] px-3 text-sm font-medium transition hover:bg-[#edf4f2] disabled:opacity-50"
              disabled={!pdf || currentPage >= pdf.numPages}
              onClick={() => jumpToPage(currentPage + 1)}
              type="button"
            >
              Next
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="h-9 rounded-md border border-[#aab7b4] px-3 text-sm font-medium transition hover:bg-[#edf4f2] disabled:opacity-50"
              disabled={!pdf || isBookmarkSaving}
              onClick={saveBookmark}
              type="button"
            >
              Bookmark page
            </button>
            <button
              className="h-9 w-9 rounded-md border border-[#aab7b4] text-lg font-medium transition hover:bg-[#edf4f2]"
              onClick={() => setScale((value) => clampScale(value - 0.15))}
              type="button"
            >
              -
            </button>
            <span className="min-w-14 text-center text-sm text-[#5d6f73]">{Math.round(scale * 100)}%</span>
            <button
              className="h-9 w-9 rounded-md border border-[#aab7b4] text-lg font-medium transition hover:bg-[#edf4f2]"
              onClick={() => setScale((value) => clampScale(value + 0.15))}
              type="button"
            >
              +
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-5 py-10 text-center font-medium text-[#a83232]">{error}</div>
        ) : null}

        {!pdf && !error ? (
          <div className="px-5 py-16 text-center text-[#5d6f73]">Loading PDF...</div>
        ) : null}

        <div
          ref={viewerRef}
          className="max-h-[calc(100vh-190px)] overflow-auto bg-[#e9e2d6] px-3 py-6"
          onMouseUp={handleMouseUp}
        >
          <div className="mx-auto flex w-fit flex-col gap-6">
            {pdf
              ? pageSizes.map((pageSize) => (
                  <PdfPage
                    annotations={annotationsByPage.get(pageSize.pageNumber) ?? []}
                    isActive={(annotationId) => annotationId === activeAnnotationId}
                    key={pageSize.pageNumber}
                    onAnnotationClick={setActiveAnnotationId}
                    onPageVisible={handleVisiblePageChange}
                    pageNumber={pageSize.pageNumber}
                    pdf={pdf}
                    registerPage={registerPage}
                    scale={scale}
                  />
                ))
              : null}
          </div>
        </div>
      </section>

      <aside className="h-fit rounded-lg border border-[#d8d0c2] bg-white shadow-sm">
        <div className="border-b border-[#e3ded4] px-5 py-4">
          <h2 className="text-xl font-semibold">Chapters</h2>
          {chapters.length === 0 ? (
            <p className="mt-1 text-sm text-[#5d6f73]">No PDF outline found.</p>
          ) : (
            <ChapterList
              chapters={chapters}
              currentPage={currentPage}
              expandedChapterIds={expandedChapterIds}
              jumpToPage={jumpToPage}
              level={0}
              toggleChapter={toggleChapter}
            />
          )}
        </div>

        <div className="border-b border-[#e3ded4] px-5 py-4">
          <h2 className="text-xl font-semibold">Highlights</h2>
          <p className="mt-1 text-sm text-[#5d6f73]">
            {annotations.length === 1 ? "1 saved highlight" : `${annotations.length} saved highlights`}
          </p>
        </div>

        <div className="border-b border-[#e3ded4] px-5 py-4">
          <h3 className="font-semibold">Bookmark</h3>
          {bookmarkPageNumber ? (
            <p className="mt-1 text-sm text-[#5d6f73]">Saved on page {bookmarkPageNumber}.</p>
          ) : (
            <p className="mt-1 text-sm text-[#5d6f73]">No saved page yet.</p>
          )}
          {bookmarkMessage ? <p className="mt-2 text-sm font-medium text-[#275e68]">{bookmarkMessage}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              className="h-9 flex-1 rounded-md border border-[#aab7b4] px-3 text-sm font-medium transition hover:bg-[#edf4f2] disabled:opacity-50"
              disabled={!bookmarkPageNumber}
              onClick={() => bookmarkPageNumber && jumpToPage(bookmarkPageNumber)}
              type="button"
            >
              Go to bookmark
            </button>
            <button
              className="h-9 rounded-md border border-[#aab7b4] px-3 text-sm font-medium transition hover:bg-[#edf4f2] disabled:opacity-50"
              disabled={!bookmarkPageNumber || isBookmarkSaving}
              onClick={clearBookmark}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        {pendingHighlight ? (
          <div className="border-b border-[#e3ded4] px-5 py-4">
            <h3 className="font-semibold">New highlight</h3>
            <p className="mt-2 line-clamp-4 text-sm text-[#5d6f73]">{pendingHighlight.selectedText}</p>
            <textarea
              className="mt-3 min-h-28 w-full rounded-md border border-[#b9c3c0] p-3 text-sm outline-none transition focus:border-[#275e68] focus:ring-2 focus:ring-[#c6e0dc]"
              onChange={(event) =>
                setPendingHighlight((highlight) =>
                  highlight ? { ...highlight, note: event.target.value } : highlight,
                )
              }
              placeholder="Add a note"
              value={pendingHighlight.note}
            />
            <ColorPicker
              color={pendingHighlight.color}
              onChange={(color) =>
                setPendingHighlight((highlight) => (highlight ? { ...highlight, color } : highlight))
              }
            />
            <div className="mt-3 flex gap-2">
              <button
                className="h-10 flex-1 rounded-md bg-[#275e68] px-4 text-sm font-medium text-white transition hover:bg-[#1e4b52] disabled:opacity-60"
                disabled={isSaving}
                onClick={createHighlight}
                type="button"
              >
                Save
              </button>
              <button
                className="h-10 rounded-md border border-[#aab7b4] px-4 text-sm font-medium transition hover:bg-[#edf4f2]"
                onClick={() => {
                  setPendingHighlight(null);
                  window.getSelection()?.removeAllRanges();
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {activeAnnotation ? (
          <AnnotationEditor
            annotation={activeAnnotation}
            isSaving={isSaving}
            onChange={(annotation) =>
              setAnnotations((items) => items.map((item) => (item.id === annotation.id ? annotation : item)))
            }
            onDelete={deleteActiveAnnotation}
            onSave={updateAnnotation}
          />
        ) : null}

        <div className="max-h-[calc(100vh-330px)] overflow-auto px-5 py-4">
          {annotations.length === 0 ? (
            <p className="text-sm text-[#5d6f73]">Select text in the PDF to create your first highlight.</p>
          ) : (
            <ul className="space-y-3">
              {annotations.map((annotation) => (
                <li key={annotation.id}>
                  <button
                    className={`w-full rounded-md border p-3 text-left transition ${
                      annotation.id === activeAnnotationId
                        ? "border-[#275e68] bg-[#edf4f2]"
                        : "border-[#e3ded4] hover:bg-[#faf8f4]"
                    }`}
                    onClick={() => {
                      setActiveAnnotationId(annotation.id);
                      jumpToPage(annotation.pageNumber);
                    }}
                    type="button"
                  >
                    <span className="text-xs font-semibold uppercase text-[#5d6f73]">
                      Page {annotation.pageNumber}
                    </span>
                    <span className="mt-1 block text-sm font-medium">{getAnnotationLabel(annotation)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      {HIGHLIGHT_COLORS.map((option) => (
        <button
          aria-label={`Use ${option} highlight color`}
          className={`h-7 w-7 rounded-full border-2 ${color === option ? "border-[#1e2528]" : "border-white"}`}
          key={option}
          onClick={() => onChange(option)}
          style={{ background: option }}
          type="button"
        />
      ))}
    </div>
  );
}

function ChapterList({
  chapters,
  currentPage,
  expandedChapterIds,
  jumpToPage,
  level,
  toggleChapter,
}: {
  chapters: ChapterLink[];
  currentPage: number;
  expandedChapterIds: Set<string>;
  jumpToPage: (pageNumber: number) => void;
  level: number;
  toggleChapter: (chapterId: string) => void;
}) {
  return (
    <ul className={`${level === 0 ? "mt-3 max-h-72 overflow-auto pr-1" : "mt-1"} space-y-1`}>
      {chapters.map((chapter) => {
        const hasChildren = chapter.children.length > 0;
        const isExpanded = expandedChapterIds.has(chapter.id);

        return (
          <li key={chapter.id}>
            <div
              className={`flex items-start gap-1 rounded-md transition ${
                chapter.pageNumber === currentPage
                  ? "bg-[#edf4f2] font-semibold text-[#1e2528]"
                  : "text-[#1e2528] hover:bg-[#faf8f4]"
              }`}
              style={{ paddingLeft: `${level * 14}px` }}
            >
              <button
                aria-label={isExpanded ? "Collapse chapter" : "Expand chapter"}
                className="mt-2 h-6 w-6 shrink-0 rounded text-sm font-semibold text-[#5d6f73] transition hover:bg-[#e3ded4] disabled:opacity-0"
                disabled={!hasChildren}
                onClick={() => toggleChapter(chapter.id)}
                type="button"
              >
                {isExpanded ? "-" : "+"}
              </button>
              <button
                className="min-w-0 flex-1 px-1 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!chapter.pageNumber}
                onClick={() => chapter.pageNumber && jumpToPage(chapter.pageNumber)}
                title={chapter.pageNumber ? `Page ${chapter.pageNumber}` : "This chapter has no page target"}
                type="button"
              >
                <span className="block truncate">{chapter.title}</span>
                {chapter.pageNumber ? (
                  <span className="mt-0.5 block text-xs font-normal text-[#5d6f73]">
                    Page {chapter.pageNumber}
                  </span>
                ) : null}
              </button>
            </div>

            {hasChildren && isExpanded ? (
              <ChapterList
                chapters={chapter.children}
                currentPage={currentPage}
                expandedChapterIds={expandedChapterIds}
                jumpToPage={jumpToPage}
                level={level + 1}
                toggleChapter={toggleChapter}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AnnotationEditor({
  annotation,
  isSaving,
  onChange,
  onDelete,
  onSave,
}: {
  annotation: AnnotationRecord;
  isSaving: boolean;
  onChange: (annotation: AnnotationRecord) => void;
  onDelete: () => void;
  onSave: (annotation: AnnotationRecord) => void;
}) {
  return (
    <div className="border-b border-[#e3ded4] px-5 py-4">
      <h3 className="font-semibold">Edit highlight</h3>
      <p className="mt-2 line-clamp-4 text-sm text-[#5d6f73]">{annotation.selectedText}</p>
      <textarea
        className="mt-3 min-h-28 w-full rounded-md border border-[#b9c3c0] p-3 text-sm outline-none transition focus:border-[#275e68] focus:ring-2 focus:ring-[#c6e0dc]"
        onChange={(event) => onChange({ ...annotation, note: event.target.value })}
        placeholder="Add a note"
        value={annotation.note}
      />
      <ColorPicker color={annotation.color} onChange={(color) => onChange({ ...annotation, color })} />
      <div className="mt-3 flex gap-2">
        <button
          className="h-10 flex-1 rounded-md bg-[#275e68] px-4 text-sm font-medium text-white transition hover:bg-[#1e4b52] disabled:opacity-60"
          disabled={isSaving}
          onClick={() => onSave(annotation)}
          type="button"
        >
          Save
        </button>
        <button
          className="h-10 rounded-md border border-[#aab7b4] px-4 text-sm font-medium transition hover:bg-[#edf4f2]"
          disabled={isSaving}
          onClick={onDelete}
          type="button"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function PdfPage({
  annotations,
  isActive,
  onAnnotationClick,
  onPageVisible,
  pageNumber,
  pdf,
  registerPage,
  scale,
}: {
  annotations: AnnotationRecord[];
  isActive: (annotationId: string) => boolean;
  onAnnotationClick: (annotationId: string) => void;
  onPageVisible: (pageNumber: number) => void;
  pageNumber: number;
  pdf: PDFDocumentProxy;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  scale: number;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;

    pdf.getPage(pageNumber).then((loadedPage) => {
      if (!cancelled) {
        setPage(loadedPage);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, pdf]);

  useEffect(() => {
    const element = pageRef.current;

    if (!element) {
      return;
    }

    registerPage(pageNumber, element);

    return () => registerPage(pageNumber, null);
  }, [pageNumber, registerPage]);

  useEffect(() => {
    const element = pageRef.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onPageVisible(pageNumber);
        }
      },
      { root: null, threshold: 0.35 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [onPageVisible, pageNumber]);

  useEffect(() => {
    if (!page || !canvasRef.current || !textLayerRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const textLayerElement = textLayerRef.current;
    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    setDimensions({ width: viewport.width, height: viewport.height });
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    textLayerElement.replaceChildren();

    const renderTask = page.render({ canvas, canvasContext: context, viewport });
    const textLayer = new pdfjsLib.TextLayer({
      container: textLayerElement,
      textContentSource: page.streamTextContent(),
      viewport,
    });

    textLayer.render();

    return () => {
      renderTask.cancel();
      textLayer.cancel();
    };
  }, [page, scale]);

  return (
    <div
      className="pdf-page relative bg-white shadow-md"
      data-page-number={pageNumber}
      ref={pageRef}
      style={
        {
          "--scale-factor": scale,
          "--total-scale-factor": scale,
          width: dimensions.width || 1,
          height: dimensions.height || 1,
        } as CSSProperties
      }
    >
      <canvas ref={canvasRef} />
      <div className="textLayer" ref={textLayerRef} />
      <div className="pointer-events-none absolute inset-0 z-[3]">
        {annotations.flatMap((annotation) =>
          annotation.rects.map((rect, index) => (
            <button
              aria-label={`Highlight on page ${annotation.pageNumber}`}
              className={`pointer-events-auto absolute border transition ${
                isActive(annotation.id) ? "border-[#1e2528]" : "border-transparent"
              }`}
              key={`${annotation.id}-${index}`}
              onClick={(event) => {
                event.stopPropagation();
                onAnnotationClick(annotation.id);
              }}
              style={{
                backgroundColor: annotation.color,
                height: `${rect.height * 100}%`,
                left: `${rect.left * 100}%`,
                opacity: 0.42,
                top: `${rect.top * 100}%`,
                width: `${rect.width * 100}%`,
              }}
              type="button"
            />
          )),
        )}
      </div>
    </div>
  );
}
