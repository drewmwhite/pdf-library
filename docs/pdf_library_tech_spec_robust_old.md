
# PDF Library Web Application — Robust Technical Specification

## 1. Executive Summary

This document defines a production-oriented technical specification for a web application that acts as a private cloud library for a user's PDF documents. The system allows users to sign in from any machine, access their PDF collection, organize their documents, read PDFs in the browser, and create synced highlights, notes, bookmarks, and reading progress markers.

The product is designed for a **single-user library model first**, with architecture that can later support:
- multi-user tenancy
- shared libraries
- team collaboration
- OCR and full-text search
- offline reading
- AI-assisted search or note summarization
- annotated PDF export

The most important implementation decision in this spec is:

**Store annotations, bookmarks, and notes separately from the original PDF binary.**

This keeps source PDFs immutable, simplifies synchronization, reduces the risk of file corruption, and makes cross-device state management much easier.

---

## 2. Product Goals

### Primary Goal
Provide secure, anywhere access to a personal PDF library across multiple machines through a browser-based application.

### Secondary Goals
- Preserve reading state across devices
- Enable highlights, bookmarks, and page-specific notes
- Organize documents with metadata and collections
- Build on an architecture that can scale from personal use to a real product

### Non-Goals for MVP
- Real-time collaboration between multiple simultaneous readers
- Native desktop or mobile apps
- Editing the text content of PDFs
- Full offline sync
- Full OCR pipeline for image-only PDFs
- Annotation burn-in as the default persistence mechanism

---

## 3. Core User Stories

### Authentication / Access
- As a user, I want to sign in securely from any machine.
- As a user, I want my documents to be private by default.
- As a user, I want to reset my password or use a magic link if needed.

### Library
- As a user, I want to upload one or many PDFs.
- As a user, I want to browse my PDFs by title, author, tags, or collection.
- As a user, I want to search my notes and document metadata.

### Reading
- As a user, I want to read a PDF in-browser without downloading it manually.
- As a user, I want the app to remember my last page and scroll position.
- As a user, I want to quickly jump to bookmarks or notes.

### Annotation
- As a user, I want to highlight selected text.
- As a user, I want to add a note to a page or a highlight.
- As a user, I want to bookmark a specific page or location.
- As a user, I want annotations to sync across devices.

### Reliability
- As a user, I want my uploaded PDFs and notes to be backed up and recoverable.
- As a user, I want the app to remain fast even with large PDFs.

---

## 4. Recommended Architecture

## 4.1 High-Level Stack

### Frontend
- **Next.js** for the web app shell and authenticated application UI
- React-based PDF reading experience
- PDF renderer using **PDF.js**
- Tailwind CSS or equivalent UI layer
- Optional local cache for recent reader state

### Backend
Two good paths:

#### Path A — Fastest practical build
- Next.js frontend
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Optional custom backend for advanced logic

#### Path B — More control
- Next.js frontend
- ASP.NET Core Web API
- PostgreSQL
- S3-compatible storage (AWS S3, Cloudflare R2, or MinIO)
- External auth provider or custom JWT/session auth

### Database
- **PostgreSQL** for all relational metadata
- Use `jsonb` for flexible viewer state and annotation geometry payloads

### Object Storage
- Private bucket/container
- PDFs stored as immutable objects
- Access via short-lived signed URLs or backend streaming

### Search
- PostgreSQL full-text search for metadata and note bodies in MVP
- Optional later:
  - OCR ingestion
  - extracted PDF text indexing
  - vector/semantic search

---

## 4.2 Architecture Diagram (Logical)

```text
[ Browser / Next.js Client ]
        |
        | HTTPS
        v
[ Web App / API Layer ]
        |
        +---- Auth Provider
        |
        +---- PostgreSQL
        |
        +---- Object Storage (private PDFs)
        |
        +---- Background Workers (optional)
```

---

## 5. Recommended Build Choice

## 5.1 Best Recommendation for MVP

For a practical MVP with room to grow:

- **Frontend:** Next.js
- **Viewer:** PDF.js
- **Backend:** ASP.NET Core Web API or Next.js route handlers
- **Database:** PostgreSQL
- **Storage:** S3-compatible object storage
- **Auth:** Supabase Auth, Clerk, Auth0, or custom JWT auth

### Why this is the right balance
- Browser-based PDF reading is mature and widely understood
- PDF.js gives full control over reading UX
- Postgres is ideal for metadata and sync state
- Object storage is the correct place for raw PDF binaries
- Separation of immutable file storage and mutable annotation data is clean and scalable

---

## 6. Viewer Technology Decision

## 6.1 PDF.js Approach

Use PDF.js if:
- you want lower recurring cost
- you are willing to build your own annotation persistence layer
- you want direct control over the reading experience

### Pros
- Open source
- Mature and widely used
- Good for rendering and reading
- Easy to integrate into a React/Next.js application

### Cons
- You must build a lot of annotation UX yourself
- Advanced comment workflows take more engineering
- You own the persistence model and coordinate mapping logic

## 6.2 Commercial Viewer Alternative

Use a commercial SDK such as Apryse or PSPDFKit/Nutrient if:
- you want richer annotation support sooner
- you want built-in comments, sticky notes, import/export, XFDF support, or annotation permissions
- you prefer paying money to save engineering time

### Pros
- Much faster to ship advanced annotation features
- Better support for PDF-native annotation/export workflows
- More polished annotation tooling out of the box

### Cons
- License cost
- Vendor lock-in risk
- Less control in some areas than a custom layer over PDF.js

## 6.3 Recommendation
For a personal or indie product MVP:
- Start with **PDF.js + custom persistence**
- Add annotated export later
- Revisit commercial viewers only if annotation UX becomes the main selling point

---

## 7. Annotation Strategy

## 7.1 Core Recommendation
**Do not modify the PDF file on every annotation change.**

Store annotations separately in the application database.

### Why
- keeps original PDF immutable
- easier sync across devices
- easier backup and recovery
- simpler undo/edit/delete behavior
- easier to audit changes
- allows future collaboration model
- avoids expensive file rewrite operations

## 7.2 Annotation Types
MVP should support:

- `highlight`
- `note`
- `bookmark`

Phase 2:
- underline
- strikeout
- free-text note box
- drawing/ink
- tags on notes
- threaded comments

## 7.3 Annotation Anchoring Model
Each annotation should be anchored by both:

1. **page-relative geometry**
2. **textual context**

This hybrid strategy helps reduce breakage if rendering changes or if different viewer scaling affects coordinates.

### Stored fields for highlights
- document id
- page number
- selected text
- normalized rectangles
- text quote
- prefix/suffix text context
- color
- optional note/comment
- created/updated timestamps

### Why both matter
- Rectangles let you render the highlight accurately
- Text quote/context gives you recovery options if geometry changes or you later support re-anchoring

---

## 8. Functional Requirements

## 8.1 Authentication
Required:
- sign up
- sign in
- sign out
- password reset
- email verification
- session expiration handling

Optional:
- magic link
- MFA
- social login

## 8.2 Library Management
Required:
- upload PDF
- replace metadata
- delete document
- soft archive document
- add tags
- create collections
- move documents into collections
- favorite/star documents

Optional:
- duplicate detection
- import by external URL
- batch tag operations

## 8.3 Reader
Required:
- open PDF in browser
- jump to page
- zoom in/out
- fit width / fit page
- previous/next page
- thumbnail rail
- text search inside viewer
- save last viewed position

Optional:
- continuous scroll mode
- single page mode
- keyboard navigation
- reading theme options around the viewer

## 8.4 Annotations
Required:
- create highlight
- create note tied to page
- create bookmark
- edit note content
- delete annotation
- list annotations for document
- click annotation in sidebar and jump to location

Optional:
- color coding
- tags/categories for notes
- annotation filter panel
- export notes

## 8.5 Search
MVP:
- title search
- filename search
- author search
- tag search
- collection search
- note-body search

Phase 2:
- extracted PDF text search
- OCR text search
- semantic search over notes and extracted text

## 8.6 Sync
Required:
- save last page
- save last known scroll position
- save per-document reading progress
- sync notes/highlights/bookmarks across devices

Optional:
- conflict resolution UI for concurrent edits
- offline write queue

---

## 9. Non-Functional Requirements

### Security
- private documents by default
- encrypted in transit
- access-controlled storage
- signed URLs or authenticated streaming only

### Performance
- open document quickly
- support large PDFs
- lazy-load pages/thumbnails where possible
- paginate and index library lists

### Reliability
- no data loss for annotation writes
- backups for metadata database
- object storage durability
- retryable upload workflow

### Scalability
Initial target:
- 1 user, hundreds to thousands of PDFs

Growth target:
- many users, millions of annotations, tens of thousands of docs

### Maintainability
- clean API boundaries
- separate viewer state from document metadata
- versioned annotation schema
- migration-friendly database design

---

## 10. Data Model

## 10.1 Core Entities
The system should include these primary entities:

- users
- documents
- document_files
- collections
- collection_documents
- annotations
- reading_progress
- document_tags
- tags
- upload_jobs
- audit_log (optional but recommended)

---

## 10.2 Suggested PostgreSQL Schema

## users
```sql
create table users (
  id uuid primary key,
  email text not null unique,
  password_hash text,
  auth_provider text not null default 'local',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## documents
```sql
create table documents (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  author text,
  description text,
  source_filename text not null,
  mime_type text not null default 'application/pdf',
  page_count integer,
  file_size_bytes bigint,
  sha256 text,
  storage_key text not null,
  cover_image_key text,
  upload_status text not null default 'ready',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz
);

create index idx_documents_user_id on documents(user_id);
create index idx_documents_user_title on documents(user_id, title);
create index idx_documents_user_archived on documents(user_id, is_archived);
```

## collections
```sql
create table collections (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
```

## collection_documents
```sql
create table collection_documents (
  collection_id uuid not null references collections(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, document_id)
);
```

## tags
```sql
create table tags (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);
```

## document_tags
```sql
create table document_tags (
  document_id uuid not null references documents(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id)
);
```

## annotations
```sql
create table annotations (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  annotation_type text not null, -- highlight, note, bookmark
  page_number integer not null,
  body text,
  color text,
  quote text,
  quote_prefix text,
  quote_suffix text,
  rects jsonb,             -- normalized rectangles for highlight rendering
  anchor jsonb,            -- richer positioning / selection metadata
  viewer_state jsonb,      -- optional transient rendering state
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_annotations_document_id on annotations(document_id);
create index idx_annotations_user_document on annotations(user_id, document_id);
create index idx_annotations_type on annotations(annotation_type);
create index idx_annotations_rects_gin on annotations using gin (rects);
create index idx_annotations_anchor_gin on annotations using gin (anchor);
```

## reading_progress
```sql
create table reading_progress (
  user_id uuid not null references users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  last_page integer,
  scroll_top numeric,
  zoom_level numeric,
  viewport jsonb,
  percent_complete numeric,
  last_read_at timestamptz not null default now(),
  primary key (user_id, document_id)
);
```

## upload_jobs
```sql
create table upload_jobs (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  source_filename text not null,
  storage_key text,
  status text not null, -- initiated, uploaded, processing, ready, failed
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## audit_log
```sql
create table audit_log (
  id uuid primary key,
  user_id uuid references users(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
```

---

## 10.3 Annotation Payload Shape

Recommended `rects` format:

```json
[
  {
    "x": 0.1821,
    "y": 0.3044,
    "width": 0.4122,
    "height": 0.0189
  }
]
```

These should be **normalized** to page dimensions:
- `x`, `y`, `width`, `height` range from 0 to 1

This prevents storage from being tied to one particular zoom level or viewport size.

Recommended `anchor` payload:

```json
{
  "pageNumber": 42,
  "selection": {
    "text": "Store annotations separately from the original file.",
    "prefix": "The best approach is to",
    "suffix": "to simplify synchronization."
  },
  "startOffset": 120,
  "endOffset": 176,
  "pdfTextItemsVersion": 1
}
```

Bookmark payload example:
```json
{
  "pageNumber": 42,
  "scrollTopRatio": 0.61,
  "label": "Architecture decision"
}
```

Page note payload example:
```json
{
  "pageNumber": 42,
  "position": {
    "x": 0.82,
    "y": 0.17
  }
}
```

---

## 11. Object Storage Design

## 11.1 Storage Layout

Store files using deterministic keys:

```text
users/{user_id}/documents/{document_id}/original.pdf
users/{user_id}/documents/{document_id}/cover.jpg
users/{user_id}/documents/{document_id}/derived/{asset_name}
```

### Why this layout works
- easy to reason about
- easy to move/copy/delete per user
- future support for thumbnails, OCR text, or annotated exports

## 11.2 Bucket Policy
- storage bucket must be private
- users should never directly browse storage
- access is granted only through:
  - short-lived signed URLs, or
  - authenticated backend proxy endpoints

## 11.3 Upload Flow
1. Client requests upload initialization
2. Backend validates auth and file type
3. Backend creates upload job
4. Backend returns presigned upload URL or direct upload token
5. Client uploads PDF to storage
6. Client completes upload
7. Backend verifies object exists and records metadata
8. Background worker extracts page count and optional thumbnail

## 11.4 Download/Read Flow
1. Client requests document open
2. Backend verifies ownership
3. Backend returns short-lived signed URL or streams document
4. PDF viewer loads the file

---

## 12. API Design

This section assumes REST-style endpoints. GraphQL is possible, but REST is enough and simpler here.

## 12.1 Authentication Endpoints
```text
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/reset-password
POST   /api/auth/refresh
GET    /api/auth/me
```

## 12.2 Library Endpoints
```text
GET    /api/documents
POST   /api/documents/init-upload
POST   /api/documents/complete-upload
GET    /api/documents/{documentId}
PATCH  /api/documents/{documentId}
DELETE /api/documents/{documentId}
POST   /api/documents/{documentId}/archive
POST   /api/documents/{documentId}/favorite
GET    /api/documents/{documentId}/open
```

## 12.3 Collection Endpoints
```text
GET    /api/collections
POST   /api/collections
PATCH  /api/collections/{collectionId}
DELETE /api/collections/{collectionId}
POST   /api/collections/{collectionId}/documents
DELETE /api/collections/{collectionId}/documents/{documentId}
```

## 12.4 Tag Endpoints
```text
GET    /api/tags
POST   /api/tags
PATCH  /api/tags/{tagId}
DELETE /api/tags/{tagId}
POST   /api/documents/{documentId}/tags
DELETE /api/documents/{documentId}/tags/{tagId}
```

## 12.5 Annotation Endpoints
```text
GET    /api/documents/{documentId}/annotations
POST   /api/documents/{documentId}/annotations
GET    /api/annotations/{annotationId}
PATCH  /api/annotations/{annotationId}
DELETE /api/annotations/{annotationId}
```

## 12.6 Reading Progress Endpoints
```text
GET    /api/documents/{documentId}/progress
PUT    /api/documents/{documentId}/progress
```

## 12.7 Search Endpoints
```text
GET    /api/search?q=...
GET    /api/search/notes?q=...
GET    /api/search/documents?q=...
```

---

## 12.8 Example API Payloads

### Create annotation request
```json
{
  "annotationType": "highlight",
  "pageNumber": 42,
  "body": "Key design decision",
  "color": "#F7E27A",
  "quote": "Store annotations separately from the original file.",
  "quotePrefix": "The best approach is to",
  "quoteSuffix": "to simplify synchronization.",
  "rects": [
    {
      "x": 0.1821,
      "y": 0.3044,
      "width": 0.4122,
      "height": 0.0189
    }
  ],
  "anchor": {
    "pageNumber": 42,
    "selection": {
      "text": "Store annotations separately from the original file.",
      "prefix": "The best approach is to",
      "suffix": "to simplify synchronization."
    }
  }
}
```

### Update reading progress request
```json
{
  "lastPage": 42,
  "scrollTop": 813.5,
  "zoomLevel": 1.25,
  "viewport": {
    "x": 0,
    "y": 813.5,
    "width": 1280,
    "height": 900
  },
  "percentComplete": 61.2
}
```

### Document list response
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Distributed Systems Notes",
      "author": "Unknown",
      "pageCount": 312,
      "fileSizeBytes": 18817223,
      "createdAt": "2026-04-21T18:00:00Z",
      "updatedAt": "2026-04-21T18:00:00Z",
      "lastOpenedAt": "2026-04-21T19:11:00Z",
      "tags": ["systems", "notes"],
      "collections": ["Engineering"],
      "hasAnnotations": true
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

---

## 13. Frontend Application Design

## 13.1 App Areas

### 1. Auth Screens
- login
- signup
- password reset

### 2. Library Dashboard
- recent documents
- collections
- tags
- favorites
- upload button
- search bar

### 3. Document Detail / Metadata
- title
- author
- tags
- collections
- stats
- action buttons

### 4. Reader Page
Suggested layout:
- left rail: thumbnails / outline / bookmarks
- center: PDF canvas
- right rail: notes / highlights / annotation details
- top toolbar: zoom, page nav, search, mode toggles

## 13.2 Reader UX Requirements
- preserve current page while notes load asynchronously
- render annotations after page render event
- annotation create/edit should feel immediate
- use debounced saving for reading progress
- use optimistic updates for notes/highlights where safe

## 13.3 Frontend State
Recommended categories:

### Server state
- documents
- collections
- tags
- annotations
- reading progress

### Local UI state
- selected document
- active page
- zoom level
- open side panel
- selected annotation
- search text inside viewer

Use:
- React Query / TanStack Query for server state
- local component or store state for viewer state
- avoid over-centralizing everything in one global store

---

## 14. PDF Rendering and Annotation Implementation Details

## 14.1 Rendering Approach
Use PDF.js to:
- fetch document
- render pages to canvas
- extract text layer
- overlay annotation layer

## 14.2 Layers per page
Each rendered page should conceptually have:
1. canvas layer (PDF render)
2. text layer (selectable/searchable text)
3. annotation overlay layer
4. UI interaction layer

## 14.3 Highlight Creation Flow
1. User selects text in text layer
2. Client computes selected text and page-relative rectangles
3. Client builds annotation payload
4. Client sends POST request
5. Server stores annotation
6. Client re-renders overlay

## 14.4 Bookmark Flow
1. User clicks bookmark action
2. Client records page number and optional scroll ratio
3. Server stores bookmark annotation
4. Bookmark appears in sidebar and document metadata

## 14.5 Note Flow
Two note modes are recommended:
- standalone page note
- note attached to highlight

## 14.6 Coordinate System Requirements
Store annotation geometry normalized to page size:
- robust across browser sizes
- robust across zoom levels
- easy to transform into absolute display coordinates during render

### Conversion rule
If rendered page width = `W` and height = `H`

```text
absoluteX = normalizedX * W
absoluteY = normalizedY * H
absoluteWidth = normalizedWidth * W
absoluteHeight = normalizedHeight * H
```

---

## 15. Search Strategy

## 15.1 MVP Search
Use PostgreSQL for:
- title search
- author search
- filename search
- tag search
- note content search

Recommended implementation:
- `ILIKE` for simple early build
- later migrate to `tsvector` for better full-text performance

## 15.2 Phase 2 Search
Add:
- extracted text per PDF
- OCR for scanned/image-only PDFs
- page-level searchable extracted text table

Suggested future table:
```sql
create table document_text_chunks (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer not null,
  chunk_index integer not null,
  content text not null,
  tsv tsvector
);
```

## 15.3 Search Result UX
Results should show:
- document title
- type of match
- page number if relevant
- snippet around note or extracted text match
- click action that opens document at page

---

## 16. Security Requirements

## 16.1 Authentication
- use secure cookie or token session management
- protect all API endpoints
- enforce server-side ownership checks for every resource

## 16.2 Authorization
Every document, annotation, collection, tag, and progress record must be scoped to the authenticated user.

Never trust client-provided IDs without ownership validation.

## 16.3 Storage Security
- private bucket/container only
- short-lived signed URLs
- no permanent public links
- server validates access before generating signed URL

## 16.4 Input Validation
Validate:
- file MIME type
- file extension
- file size
- note length
- annotation shape payloads
- page number bounds

## 16.5 Malware / File Safety
At minimum:
- accept only PDFs in MVP
- inspect content type
- optionally scan uploaded files with an antivirus service or background scanner

## 16.6 Rate Limiting
Apply rate limits to:
- auth endpoints
- upload initialization
- annotation write endpoints
- search endpoints

## 16.7 Auditability
Track:
- upload
- delete
- archive
- annotation create/edit/delete
- metadata changes

---

## 17. Performance Requirements

## 17.1 Frontend
- lazy render visible pages only for large PDFs
- defer loading of annotation sidebar content if necessary
- cache recent document metadata
- debounce progress writes

## 17.2 Backend
- paginate document lists
- index user/document foreign keys
- avoid fetching giant annotation sets unnecessarily
- fetch annotations by document and page range when documents are large

## 17.3 Storage
- stream or signed-fetch PDFs rather than proxying entire binaries through app memory unless needed
- create thumbnails asynchronously

## 17.4 Suggested Targets
- first library page load: < 2 seconds on warm path
- document metadata fetch: < 300 ms typical
- annotation save: < 250 ms median excluding network
- open medium PDF in viewer: perceived readiness in 1–3 seconds depending on file size/network

---

## 18. Background Jobs

These are optional for MVP but recommended if the app grows.

### Recommended worker jobs
- extract page count
- create thumbnail/cover image
- validate uploaded file integrity
- duplicate detection via SHA-256
- OCR processing
- extracted text indexing
- annotated export generation

### Worker queue examples
- Hangfire if using .NET
- Celery / RQ if using Python
- BullMQ if using Node

---

## 19. Deployment and Infrastructure

## 19.1 Environments
Use at least:
- local
- staging
- production

## 19.2 Production Components
- frontend hosting
- API hosting
- managed Postgres
- object storage
- secrets manager
- logging/monitoring
- backup system

## 19.3 Good Hosting Options
### Simplest path
- Vercel for Next.js
- Supabase for auth/db/storage

### More control
- frontend on Vercel
- API on Render / Fly.io / ECS / Azure App Service
- Postgres on managed provider
- S3 or R2 for storage

### Self-host or low-cost path
- VPS + Docker Compose
- managed Postgres or self-hosted Postgres
- MinIO for object storage

## 19.4 Secrets
Store:
- DB connection strings
- storage credentials
- signing secrets
- auth secrets
- SMTP credentials
- error monitoring tokens

Never expose them in frontend bundles.

---

## 20. Backup and Recovery

### Database
- daily backups minimum
- point-in-time recovery if possible

### Object Storage
- versioning if available
- lifecycle rules if needed
- replication optional for higher durability

### Recovery Plan
- recover DB snapshot
- reconcile document storage keys
- verify object existence
- rebuild derived assets asynchronously

---

## 21. Observability

Track:
- upload success/failure rate
- annotation creation rate
- search latency
- document open latency
- API error rate
- storage request failures

Recommended tooling:
- structured application logs
- centralized log search
- error tracking (Sentry or equivalent)
- uptime monitoring
- database query monitoring

---

## 22. Testing Strategy

## 22.1 Unit Tests
- annotation payload validation
- ownership checks
- metadata update logic
- signed URL generation wrapper
- reading progress merge logic

## 22.2 Integration Tests
- document upload flow
- annotation create/update/delete
- auth-protected document access
- search endpoints
- collection and tag assignment

## 22.3 End-to-End Tests
- sign up / log in
- upload PDF
- open PDF
- highlight text
- add note
- bookmark page
- reopen on another session and confirm sync

## 22.4 PDF-Specific Test Cases
- large PDFs
- small PDFs
- very long page counts
- scanned PDFs with no text layer
- rotated pages
- weird page sizes
- PDFs with malformed metadata

---

## 23. Phased Delivery Plan

## Phase 1 — Foundation
- auth
- PDF upload
- document listing
- open PDF in viewer
- save reading progress

## Phase 2 — Annotation MVP
- highlights
- notes
- bookmarks
- annotation sidebar
- sync across devices

## Phase 3 — Organization
- collections
- tags
- favorites
- metadata editing
- basic search

## Phase 4 — Scale and polish
- thumbnails
- duplicate detection
- archive flow
- background jobs
- performance tuning

## Phase 5 — Advanced features
- OCR
- full-text PDF search
- export annotated PDFs
- sharing/collaboration
- offline support
- AI-assisted note search

---

## 24. Risks and Tradeoffs

## 24.1 PDF.js Tradeoff
PDF.js is flexible and cost-effective, but annotation UX is more custom work.

## 24.2 Coordinate Fragility
Pure coordinate-only annotations can be brittle. This is why the spec recommends storing text anchors too.

## 24.3 Scanned PDFs
Image-only PDFs need OCR before meaningful text selection/highlights/search can work.

## 24.4 Signed URL Lifecycle
Signed URLs are secure and scalable, but the frontend must handle expiration gracefully.

## 24.5 Multi-Device Sync
Concurrent editing is mostly manageable for a personal library, but later collaboration needs stronger conflict rules.

---

## 25. Suggested MVP Acceptance Criteria

A release can be called MVP-ready when all of the following are true:

- user can sign up and sign in
- user can upload a PDF
- uploaded PDF appears in library
- user can open PDF in browser
- app remembers last page
- user can create highlight
- user can create note
- user can create bookmark
- annotations sync across sessions/devices
- user can search document metadata and notes
- document access is private and authorization-checked
- deleted or archived documents no longer appear in normal library views

---

## 26. Concrete Recommendation Summary

If building this today as an MVP:

### Use
- **Next.js** for frontend
- **PDF.js** for reading/rendering
- **PostgreSQL** for metadata, notes, bookmarks, and progress
- **S3-compatible private object storage** for PDFs
- **short-lived signed URLs** for access
- **external annotation persistence** instead of rewriting the PDF

### Store separately
- raw PDF binary
- document metadata
- annotation geometry
- note content
- reading progress
- collections and tags

### Build first
1. auth
2. upload/open
3. reading progress
4. highlights
5. notes
6. bookmarks
7. search
8. organization
9. export / OCR later

---

## 27. Nice-to-Have Future Additions

- drag-and-drop reordering within collections
- import from cloud drives
- AI-generated summaries per PDF
- note backlinks across documents
- spaced repetition from highlights
- shared read-only links
- annotation export as Markdown
- “continue reading” dashboard
- email-to-library ingestion

---

## 28. Final Engineering Guidance

The right shape for this system is:

- **object storage for immutable files**
- **Postgres for mutable state**
- **PDF.js for reader control**
- **annotations stored as app data, not baked into the file**
- **signed access and strict ownership validation everywhere**

That gives you an MVP you can realistically build, ship, and evolve without painting yourself into a corner.

---

## 29. Implementation Checklist

### Backend
- [ ] auth flow
- [ ] users table
- [ ] documents table
- [ ] annotation CRUD
- [ ] reading progress API
- [ ] signed URL generation
- [ ] ownership middleware/policies
- [ ] upload completion flow
- [ ] search endpoints

### Frontend
- [ ] auth pages
- [ ] library dashboard
- [ ] upload modal
- [ ] PDF viewer shell
- [ ] annotation overlay
- [ ] notes sidebar
- [ ] bookmarks panel
- [ ] progress sync
- [ ] search UI

### Infrastructure
- [ ] Postgres provisioned
- [ ] private storage provisioned
- [ ] secrets configured
- [ ] error tracking configured
- [ ] backup policy configured

---

## 30. References

This spec aligns with:
- PDF.js as a general-purpose, web standards-based PDF parsing/rendering platform
- modern auth providers that support password and magic-link flows
- private object storage delivery through signed URLs
- annotation-capable commercial viewers if you later choose to buy instead of build

