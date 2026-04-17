# CyberIntel MCQ

AI-powered quiz generator that parses multiple-choice questions from text or documents (TXT, DOCX, PDF) and turns them into an interactive quiz experience.

Built with React, Vite, Tailwind CSS, and Google's Gemini API. Deployed on Vercel.

## Features

- Paste raw MCQ text or upload TXT / DOCX / PDF files
- AI parses questions, options, answer keys, and generates explanations
- Interactive quiz player with instant answer verification
- Score tracking with retry and reset
- Backup API key rotation (up to 5 keys) for rate limit resilience

## Setup

### Prerequisites

- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/apikey)

### Local Development

```bash
npm install
```

Copy `.env.example` to `.env` and add your API key:

```bash
cp .env.example .env
```

```
GEMINI_API_KEY="your-key-here"
```

Run with [Vercel CLI](https://vercel.com/docs/cli) (recommended, serves both frontend and API routes):

```bash
npx vercel dev
```

Or run just the frontend (API routes won't work without Vercel dev):

```bash
npm run dev
```

### Deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com/new](https://vercel.com/new)
3. Add environment variables in the Vercel dashboard:
   - `GEMINI_API_KEY` (required)
   - `GEMINI_API_KEY_2` through `GEMINI_API_KEY_5` (optional backups)
4. Deploy

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEY_2` | No | Backup key (tried if primary fails) |
| `GEMINI_API_KEY_3` | No | Backup key |
| `GEMINI_API_KEY_4` | No | Backup key |
| `GEMINI_API_KEY_5` | No | Backup key |

## Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS 4, Lucide Icons, Motion
- **Backend:** Vercel Serverless Functions
- **AI:** Google Gemini API (`gemini-3-flash-preview`)
- **File Parsing:** Mammoth (DOCX), native FileReader (PDF)
