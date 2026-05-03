# PDF Library Web Application - Local MVP Technical Specification

## 1. Executive Summary

This project is a private, single-user PDF library written entirely in Next.js. The first implementation is intentionally local and small: one password-protected web app, a JSON file used as the database, and uploaded PDFs stored on disk in a development-only `local-files` directory.

The long-term product goal is still a browser-based PDF library with reading progress, highlights, notes, bookmarks, search, and organization. The key architectural decision remains:

**Store mutable app data separately from the original PDF binary.**

For the local MVP, that means:

- PDF files live under `local-files/`.
- Metadata and future annotations live in `data/library.json`.
- The original uploaded PDF is treated as immutable.

## 2. Current MVP Stack

### Application

- **Framework:** Next.js App Router
- **UI:** React Server Components and small Client Components where interactivity is needed
- **Backend:** Next.js route handlers and server functions
- **Runtime storage:** Node.js filesystem APIs

### Authentication

- Single-user password gate for the local MVP
- Password configured with `PDF_LIBRARY_PASSWORD`
- Session signing configured with `PDF_LIBRARY_SESSION_SECRET`
- Session stored in an HTTP-only, same-site cookie

This is not intended to be the final production authentication model.

### Database

Use a JSON file as the development database:

```text
data/library.json
```

Initial shape:

```json
{
  "schemaVersion": 1,
  "documents": []
}
```

Document records include:

- `id`
- `title`
- `sourceFilename`
- `mimeType`
- `fileSizeBytes`
- `storagePath`
- `createdAt`
- `updatedAt`
- `lastOpenedAt`

### File Storage

In development, uploaded PDFs are stored at:

```text
local-files/documents/{documentId}/original.pdf
```

Both `data/` and `local-files/` are ignored by git.

## 3. First Implementation Slice

The first slice must support:

- Login with the configured app password
- Logout
- Protected library page
- Upload a single PDF
- Store uploaded file in `local-files`
- Store document metadata in `data/library.json`
- List uploaded documents
- Open/stream an uploaded PDF through an authenticated route

This slice does **not** include:

- PDF.js rendering
- Highlights
- Notes
- Bookmarks
- Tags
- Collections
- Search
- Multi-user accounts
- External object storage
- PostgreSQL

## 4. Routes and APIs

### Pages

```text
GET /login
GET /
```

`/` is protected. Unauthenticated users are sent to `/login`.

### API Endpoints

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/documents
POST /api/documents
GET  /api/documents/{documentId}/file
```

All document endpoints require a valid session.

### Upload Rules

- Only `.pdf` filenames are accepted.
- MIME type must be `application/pdf`.
- The uploaded file is written to `local-files/documents/{documentId}/original.pdf`.
- The document title defaults to the filename without `.pdf` unless a title is supplied.

## 5. Future Architecture Direction

The local MVP should be written so the storage layer can later be replaced without rewriting the app UI.

Likely future production stack:

- Next.js for web app and API layer
- Real authentication provider or robust custom auth
- PostgreSQL for metadata, annotations, progress, tags, collections, and search
- S3-compatible private object storage for PDFs
- PDF.js for in-browser reading
- Optional background workers for thumbnails, text extraction, OCR, duplicate detection, and annotated exports

PostgreSQL and object storage are explicitly future-phase choices, not first-slice dependencies.

## 6. Annotation Strategy

Annotations should remain separate from the PDF binary.

Future MVP annotation types:

- `highlight`
- `note`
- `bookmark`

Future annotation records should store both:

- Page-relative normalized geometry
- Textual quote/context for recovery and re-anchoring

Example normalized rect:

```json
{
  "x": 0.1821,
  "y": 0.3044,
  "width": 0.4122,
  "height": 0.0189
}
```

## 7. Phased Delivery Plan

### Phase 1 - Local Foundation

- Single-password auth
- JSON database
- Local PDF uploads
- Document listing
- Authenticated PDF streaming

### Phase 2 - Reader

- PDF.js viewer shell
- Open uploaded PDF in browser reader
- Page navigation and zoom
- Save reading progress

### Phase 3 - Annotation MVP

- Highlights
- Page notes
- Bookmarks
- Annotation sidebar

### Phase 4 - Organization

- Tags
- Collections
- Favorites
- Metadata editing
- Basic metadata and note search

### Phase 5 - Production Hardening

- Real auth
- PostgreSQL migration
- Private object storage
- Backups
- Observability
- Deployment configuration

## 8. First Slice Acceptance Criteria

- Unauthenticated users cannot access the library or document APIs.
- A correct `PDF_LIBRARY_PASSWORD` logs the user in.
- Logout clears access.
- Uploading a PDF creates `data/library.json` if needed.
- Uploading a PDF stores the file under `local-files/documents/{documentId}/original.pdf`.
- Uploaded PDFs appear in the library list.
- Opening a document streams the stored PDF only when authenticated.
- Non-PDF uploads are rejected.

