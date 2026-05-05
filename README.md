# PDF Library

A personal, self-hosted PDF library. Upload PDFs, read them in the browser, bookmark pages, and annotate with highlights and notes.

## Features

- Upload and manage PDF documents
- In-browser PDF viewer with text selection
- Page bookmarks
- Highlight annotations with color and notes
- Password-protected single-user auth

## Local Development

Install dependencies:

```bash
npm install
```

Create a `.env.local` file with the required environment variables:

```bash
PDF_LIBRARY_SESSION_SECRET=your-secret-here
PDF_LIBRARY_PASSWORD=your-password-here
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Data is stored under `local-files/` in the project root:

- `local-files/data/library.json` — document database
- `local-files/documents/` — uploaded PDF files

## Deployment (Fly.io)

Set secrets:

```bash
fly secrets set PDF_LIBRARY_SESSION_SECRET=your-secret-here PDF_LIBRARY_PASSWORD=your-password-here
```

Create the persistent volume (one time only):

```bash
fly volume create pdf_library_data --region dfw --size 10
```

Deploy:

```bash
fly deploy
```

The volume is mounted at `/app/local-files` inside the container, so both the database and uploaded PDFs survive redeploys.
