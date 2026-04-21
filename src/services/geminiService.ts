import { QuizData } from "../types";
import { supabase } from "../lib/supabase";

export type GenerationMode = "parse" | "generate";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type ExtractionMode = "text" | "vision";

export interface GenerateOptions {
  mode: GenerationMode;
  count?: number;
  difficulty?: Difficulty;
}

interface ParseMCQsArgs {
  rawText: string;
  filePart?: { mimeType: string; data: string };
  storagePath?: string;
  userApiKey?: string;
  options?: GenerateOptions;
}

export async function parseMCQs({
  rawText,
  filePart,
  storagePath,
  userApiKey,
  options = { mode: "parse" },
}: ParseMCQsArgs): Promise<QuizData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("You must be signed in to generate a quiz.");
  }

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      rawText,
      filePart,
      storagePath,
      userApiKey: userApiKey || undefined,
      mode: options.mode,
      count: options.count,
      difficulty: options.difficulty,
    }),
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

// Upload a PDF to Supabase Storage under the signed-in user's folder. Returns the storage
// path (e.g. "{uid}/169...-slides.pdf") for the server to fetch + delete.
export async function uploadPdfForVision(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("user-uploads")
    .upload(path, file, {
      contentType: file.type || "application/pdf",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return path;
}

// Extract text from a PDF in the browser using pdf.js. Used when sending the raw PDF
// would exceed Vercel's 4.5MB request body limit.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n\n");
}
