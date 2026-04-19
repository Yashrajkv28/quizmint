# CyberIntel MCQ — Vercel Deployment & Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure the API key behind a Vercel serverless function with backup key rotation, remove Express and Google AI Studio artifacts, fix UI/UX issues, and prepare for Vercel deployment.

**Architecture:** Frontend (Vite + React) calls `/api/generate` serverless function instead of hitting Gemini directly. The serverless function holds API keys server-side, tries backup keys on failure, and returns parsed quiz JSON. No Express needed — Vercel functions handle it natively.

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4, @google/genai SDK, Vercel Serverless Functions (Node.js), lucide-react, mammoth, motion.

---

### Task 1: Create Vercel serverless API route

**Files:**
- Create: `api/generate.ts`

- [ ] **Step 1: Create `api/generate.ts`**

This is a Vercel serverless function that accepts POST requests with quiz text and optional file data, calls Gemini using server-side API keys with backup rotation, and returns the parsed quiz JSON.

```ts
import { GoogleGenAI, Type } from "@google/genai";

interface GenerateRequest {
  rawText: string;
  filePart?: { mimeType: string; data: string };
}

function getApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);

  for (let i = 2; i <= 5; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) keys.push(key);
  }

  return keys;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "The question text" },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Option identifier, e.g., A, B, C, D" },
                text: { type: Type.STRING, description: "The text of the option" },
              },
              required: ["id", "text"],
            },
          },
          correctOptionId: { type: Type.STRING, description: "The ID of the correct option" },
          explanation: { type: Type.STRING, description: "A brief explanation of why the correct option is right" },
        },
        required: ["question", "options", "correctOptionId", "explanation"],
      },
    },
    difficulty: {
      type: Type.STRING,
      description: "Predicted overall difficulty of the quiz",
      enum: ["Easy", "Medium", "Hard"],
    },
  },
  required: ["questions", "difficulty"],
};

export async function POST(request: Request) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    return Response.json({ error: "No API keys configured." }, { status: 500 });
  }

  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { rawText, filePart } = body;
  if (!rawText?.trim() && !filePart) {
    return Response.json({ error: "No input provided." }, { status: 400 });
  }

  const textPart = {
    text: `Parse the following text and/or attached document containing multiple-choice questions and an answer key into a structured JSON format. Also, predict the overall difficulty level of these questions (Easy, Medium, or Hard) based on the content.

CRUCIAL: For each question, generate a brief (1-2 sentences) explanation of why the correct answer is right. Please generate this even if the original text does not provide an explanation.

Text:
${rawText}`,
  };

  const parts: any[] = [];
  if (filePart) {
    parts.push({ inlineData: filePart });
  }
  parts.push(textPart);

  let lastError: Error | null = null;

  for (const apiKey of keys) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const text = response.text?.trim();
      if (!text) {
        lastError = new Error("Empty response from Gemini.");
        continue;
      }

      const parsed = JSON.parse(text);
      return Response.json(parsed);
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.httpStatusCode;
      // Retry with next key on rate limit (429) or auth errors (401/403)
      if (status === 429 || status === 401 || status === 403) {
        continue;
      }
      // For other errors, don't retry — it's likely a prompt/content issue
      break;
    }
  }

  return Response.json(
    { error: lastError?.message || "Failed to generate quiz." },
    { status: 502 },
  );
}
```

- [ ] **Step 2: Verify the file exists at project root `api/generate.ts`**

Run: `ls api/generate.ts`

---

### Task 2: Rewrite geminiService.ts to call the API route

**Files:**
- Modify: `src/services/geminiService.ts` (full rewrite)

- [ ] **Step 1: Replace `src/services/geminiService.ts`**

Remove all direct Gemini SDK usage from the frontend. The service now calls our `/api/generate` endpoint.

```ts
import { QuizData } from "../types";

export async function parseMCQs(
  rawText: string,
  filePart?: { mimeType: string; data: string },
): Promise<QuizData> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText, filePart }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error (${response.status})`);
  }

  const data: QuizData = await response.json();

  if (!data.questions || data.questions.length === 0) {
    throw new Error("No questions could be extracted from the input.");
  }

  return data;
}
```

---

### Task 3: Clean up vite.config.ts

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Remove API key injection and AI Studio HMR hack**

Remove the `define` block that exposes the API key. Remove the HMR disable logic. Add a dev proxy for `/api` to enable local development with `vercel dev` or a separate server.

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

---

### Task 4: Clean up QuizGenerator.tsx

**Files:**
- Modify: `src/components/QuizGenerator.tsx`

- [ ] **Step 1: Remove the `onProgress` callback from `parseMCQs` call and fix progress reset**

The streaming callback no longer exists since the API returns a single response. Update `handleGenerate` to remove it and properly reset state.

In `handleGenerate`, replace the `parseMCQs` call:

```ts
const filePart = pdfFile ? { mimeType: 'application/pdf', data: pdfFile.data } : undefined;
const quizData = await parseMCQs(rawText, filePart);
```

And in the success path after `clearInterval`, add proper state reset for the error case:

```ts
clearInterval(simulatedProgressInterval);
setProgress(100);
setProgressText("Processing complete!");

setTimeout(() => {
  if (quizData && quizData.questions && quizData.questions.length > 0) {
    onGenerate(quizData);
  } else {
    setError("Could not extract any questions. Please check the format.");
    setIsGenerating(false);
    setProgress(0);
  }
}, 400);
```

Also in the `catch` block, reset progress:

```ts
} catch (err: any) {
  clearInterval(simulatedProgressInterval);
  console.error(err);
  setError(err.message || "An error occurred while generating the quiz.");
  setIsGenerating(false);
  setProgress(0);
}
```

---

### Task 5: Fix index.html title and remove AI Studio metadata

**Files:**
- Modify: `index.html`
- Delete: `metadata.json`

- [ ] **Step 1: Update `index.html` title**

```html
<title>CyberIntel MCQ</title>
```

- [ ] **Step 2: Delete `metadata.json`**

Run: `rm metadata.json`

---

### Task 6: Add responsive sidebar

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Make sidebar collapse on mobile**

Wrap the sidebar in responsive classes so it hides on small screens and shows on `lg` breakpoint and above.

Change `<aside>` className from:
```
w-[280px] bg-[#15161A] border-r border-[#2D2E35] p-6 flex flex-col gap-8 shrink-0
```
To:
```
hidden lg:flex w-[280px] bg-[#15161A] border-r border-[#2D2E35] p-6 flex-col gap-8 shrink-0
```

---

### Task 7: Clean up package.json and dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update `package.json`**

- Remove `express`, `@types/express`, `dotenv`, `tsx` dependencies (not needed with Vercel functions)
- Keep `@google/genai` — it's used in the API route
- Rename the project
- Update dev script (remove `--host=0.0.0.0`)

```json
{
  "name": "cyberintel-mcq",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^1.29.0",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "lucide-react": "^0.546.0",
    "mammoth": "^1.12.0",
    "motion": "^12.23.24",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^6.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.8.2"
  }
}
```

- [ ] **Step 2: Reinstall dependencies**

Run: `npm install`

---

### Task 8: Create vercel.json

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "framework": "vite",
  "buildCommand": "vite build",
  "outputDirectory": "dist"
}
```

---

### Task 9: Update .env.example and .gitignore

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Update `.env.example` with backup key slots**

```
# Primary Gemini API Key (required)
# Get your key from https://aistudio.google.com/apikey
GEMINI_API_KEY="your-primary-api-key"

# Backup API Keys (optional)
# If the primary key hits rate limits, these will be tried in order.
GEMINI_API_KEY_2=""
GEMINI_API_KEY_3=""
GEMINI_API_KEY_4=""
GEMINI_API_KEY_5=""
```

- [ ] **Step 2: Update `.gitignore`**

```
node_modules/
dist/
.vercel/
.DS_Store
*.log
.env
.env.local
.env*.local
!.env.example
```

---

### Task 10: Write new README

**Files:**
- Modify: `README.md` (full rewrite)

- [ ] **Step 1: Rewrite README.md**

Complete rewrite removing all AI Studio references.

---

### Task 11: Build verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run Vite build**

Run: `npm run build`
Expected: Build succeeds, outputs to `dist/`

- [ ] **Step 3: Verify no API key leaks in build output**

Run: `grep -r "GEMINI_API_KEY" dist/ || echo "No API key leak — safe"`
Expected: No matches found
