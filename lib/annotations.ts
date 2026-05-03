import type { AnnotationRecord, HighlightRect } from "@/lib/documents";

export const DEFAULT_HIGHLIGHT_COLOR = "#f8d94a";
export const HIGHLIGHT_COLORS = ["#f8d94a", "#80d4ff", "#8ee6a8", "#f7a6b8"] as const;

const MAX_NOTE_LENGTH = 5000;
const MAX_SELECTED_TEXT_LENGTH = 10000;
const MAX_RECTS = 100;
const MIN_RECT_SIZE = 0.0001;

type AnnotationInput = {
  pageNumber: number;
  color: string;
  note: string;
  selectedText: string;
  rects: HighlightRect[];
};

type AnnotationUpdateInput = Pick<AnnotationInput, "color" | "note">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeColor(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_HIGHLIGHT_COLOR;
  }

  return HIGHLIGHT_COLORS.includes(value as (typeof HIGHLIGHT_COLORS)[number])
    ? value
    : DEFAULT_HIGHLIGHT_COLOR;
}

function isNormalizedCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseRect(value: unknown): HighlightRect | null {
  if (!isRecord(value)) {
    return null;
  }

  const left = value.left;
  const top = value.top;
  const width = value.width;
  const height = value.height;

  if (
    !isNormalizedCoordinate(left) ||
    !isNormalizedCoordinate(top) ||
    !isNormalizedCoordinate(width) ||
    !isNormalizedCoordinate(height)
  ) {
    return null;
  }

  const rect = { left, top, width, height };

  if (
    rect.width < MIN_RECT_SIZE ||
    rect.height < MIN_RECT_SIZE ||
    rect.left + rect.width > 1 ||
    rect.top + rect.height > 1
  ) {
    return null;
  }

  return rect;
}

export function parseAnnotationInput(value: unknown): AnnotationInput | { error: string } {
  if (!isRecord(value)) {
    return { error: "Invalid annotation payload" };
  }

  const pageNumber = value.pageNumber;

  if (typeof pageNumber !== "number" || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return { error: "Page number must be a positive integer" };
  }

  if (!Array.isArray(value.rects) || value.rects.length === 0 || value.rects.length > MAX_RECTS) {
    return { error: "At least one highlight rectangle is required" };
  }

  const rects = value.rects.map(parseRect);

  if (rects.some((rect) => rect === null)) {
    return { error: "Highlight rectangles must use normalized page coordinates" };
  }

  return {
    pageNumber,
    color: normalizeColor(value.color),
    note: normalizeText(value.note, MAX_NOTE_LENGTH),
    selectedText: normalizeText(value.selectedText, MAX_SELECTED_TEXT_LENGTH),
    rects: rects as HighlightRect[],
  };
}

export function parseAnnotationUpdateInput(
  value: unknown,
  existing: AnnotationRecord,
): AnnotationUpdateInput | { error: string } {
  if (!isRecord(value)) {
    return { error: "Invalid annotation payload" };
  }

  return {
    color: value.color === undefined ? existing.color : normalizeColor(value.color),
    note: value.note === undefined ? existing.note : normalizeText(value.note, MAX_NOTE_LENGTH),
  };
}
