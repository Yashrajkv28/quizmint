import { GoogleGenAI, Type } from "@google/genai";
import { requireUser, supabaseAdmin } from "../server/auth.js";

type GenerationMode = "parse" | "generate";
type Difficulty = "Easy" | "Medium" | "Hard";

interface GenerateRequest {
  rawText: string;
  filePart?: { mimeType: string; data: string };
  storagePath?: string;
  userApiKey?: string;
  mode?: GenerationMode;
  count?: number;
  difficulty?: Difficulty;
}

const BUCKET = "user-uploads";

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
          question: {
            type: Type.STRING,
            description: "The question text",
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Option identifier, e.g., A, B, C, D",
                },
                text: {
                  type: Type.STRING,
                  description: "The text of the option",
                },
              },
              required: ["id", "text"],
            },
          },
          correctOptionId: {
            type: Type.STRING,
            description: "The ID of the correct option",
          },
          explanation: {
            type: Type.STRING,
            description:
              "A brief explanation of why the correct option is right",
          },
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
  try {
    return await handleGenerate(request);
  } catch (err: any) {
    console.error("generate: unexpected error", { message: err?.message, stack: err?.stack });
    return Response.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

async function handleGenerate(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { rawText, filePart, storagePath, userApiKey } = body;
  const mode: GenerationMode = body.mode === "generate" ? "generate" : "parse";
  const rawCount = Number(body.count);
  const count = mode === "generate"
    ? Math.min(50, Math.max(10, Number.isFinite(rawCount) ? Math.round(rawCount) : 10))
    : undefined;
  const difficulty: Difficulty = body.difficulty === "Easy" || body.difficulty === "Hard"
    ? body.difficulty
    : "Medium";

  if (!rawText?.trim() && !filePart && !storagePath) {
    return Response.json({ error: "No input provided." }, { status: 400 });
  }

  // Storage-path validation: must belong to the authed user, no traversal.
  if (storagePath) {
    if (
      typeof storagePath !== "string" ||
      !storagePath.startsWith(`${auth.id}/`) ||
      storagePath.includes("..")
    ) {
      return Response.json({ error: "Invalid storage path." }, { status: 400 });
    }
  }

  // Server-side file validation
  if (filePart) {
    const allowedMimeTypes = [
      "application/pdf",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!filePart.mimeType || !allowedMimeTypes.includes(filePart.mimeType)) {
      return Response.json(
        { error: "Invalid file type. Only PDF, TXT, and DOCX are allowed." },
        { status: 400 }
      );
    }

    if (!filePart.data || typeof filePart.data !== "string") {
      return Response.json(
        { error: "Invalid file data." },
        { status: 400 }
      );
    }

    // Legacy inline path (text-only flow). Base64 must stay under Vercel's 4.5MB body cap.
    const maxBase64Size = 4 * 1024 * 1024;
    if (filePart.data.length > maxBase64Size) {
      return Response.json(
        { error: "File too large for inline upload. Maximum size is 3MB — use the image/vision mode for larger files." },
        { status: 400 }
      );
    }

    // Validate base64 encoding
    if (!/^[A-Za-z0-9+/=]+$/.test(filePart.data)) {
      return Response.json(
        { error: "Invalid file encoding." },
        { status: 400 }
      );
    }
  }

  // Build key list: user-provided key first, then server keys as fallback
  const keys: string[] = [];
  if (userApiKey?.trim()) {
    keys.push(userApiKey.trim());
  }
  keys.push(...getApiKeys());

  if (keys.length === 0) {
    return Response.json(
      { error: "No API key available. Please provide your own Gemini API key." },
      { status: 400 }
    );
  }

  const parsePrompt = `Parse the following text and/or attached document containing multiple-choice questions and an answer key into a structured JSON format. Also, predict the overall difficulty level of these questions (Easy, Medium, or Hard) based on the content.

CRUCIAL: For each question, generate a brief (1-2 sentences) explanation of why the correct answer is right. Please generate this even if the original text does not provide an explanation.

Text:
${rawText}`;

  const difficultyGuidance: Record<Difficulty, string> = {
    Easy: "Recall and recognition. Questions target definitions, named concepts, and stated facts. Distractors should be clearly wrong to anyone who has read the material.",
    Medium: "Understanding and application. Questions require connecting two related ideas, applying a concept to a short scenario, or distinguishing between similar concepts. Distractors should be plausible — they often represent common misconceptions.",
    Hard: "Analysis, synthesis, and edge cases. Questions demand multi-step reasoning, comparison across sections, or application to unfamiliar scenarios. Distractors should be highly plausible — each should look correct unless the reader truly understands the nuance.",
  };

  const generatePrompt = `You are a subject-matter expert building a ${count}-question multiple-choice quiz from the attached course material (lecture slides, notes, or a textbook excerpt). The source contains teaching content — NOT pre-written questions. Your job is to construct brand-new questions grounded entirely in what the material actually teaches.

REQUIREMENTS
- Produce EXACTLY ${count} questions. No more, no fewer.
- Target difficulty: ${difficulty}. ${difficultyGuidance[difficulty]}
- Every question must be answerable from the provided material alone. Do not rely on outside knowledge the material does not establish.
- Cover the breadth of the material — spread questions across different sections/topics. Do not cluster multiple questions on the same narrow point unless the material itself heavily emphasizes it.
- Each question must have EXACTLY 4 options labeled "A", "B", "C", "D". Exactly one is correct.
- Distractors must be relevant to the topic and internally consistent in style/length with the correct answer. No throwaway options, no "all of the above" / "none of the above", no joke answers.
- Vary correct-answer position across A/B/C/D — avoid obvious patterns.
- Write clear, self-contained question stems. Do not reference "the slide" or "the document" — the quiz will be taken without the source visible.
- For every question, include a 1–2 sentence explanation that cites the specific concept from the material that makes the correct answer right (and, where useful, why a tempting distractor is wrong).

OUTPUT
Return the "difficulty" field set to "${difficulty}" (the level you targeted). Return the questions array with the full ${count} items.

Source material follows${rawText?.trim() ? " (pasted text below)" : " (attached file)"}:
${rawText}`;

  const textPart = { text: mode === "generate" ? generatePrompt : parsePrompt };

  const parts: any[] = [];
  if (filePart) {
    parts.push({ inlineData: filePart });
  }
  parts.push(textPart);

  let lastError: Error | null = null;

  // Always delete any storage-backed upload after processing — we don't retain user docs.
  const cleanupStorage = async () => {
    if (!storagePath) return;
    if (!storagePath.startsWith(`${auth.id}/`)) return; // ownership guard
    try {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    } catch (e) {
      console.warn("Failed to delete upload after generation:", e);
    }
  };

  try {
    // Vision path: fetch the uploaded file from Supabase Storage. Cleanup still runs in
    // the finally block if this fails.
    if (storagePath && !filePart) {
      const { data: blob, error: dlErr } = await supabaseAdmin
        .storage
        .from(BUCKET)
        .download(storagePath);
      if (dlErr || !blob) {
        return Response.json(
          { error: dlErr?.message || "Failed to fetch uploaded file." },
          { status: 500 }
        );
      }
      if (blob.size > 20 * 1024 * 1024) {
        return Response.json(
          { error: "File too large for processing." },
          { status: 400 }
        );
      }
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      // Vision mode is PDF-only in the UI; any other kind would have been extracted client-side.
      parts.unshift({ inlineData: { mimeType: "application/pdf", data: base64 } });
    }

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
        // The @google/genai SDK surfaces HTTP status inconsistently — sometimes at the top
        // level, sometimes nested under .error.code, sometimes only in the message string.
        // Check every place it might live so the next-key fallback actually triggers.
        const nestedCode = err?.error?.code ?? err?.response?.data?.error?.code;
        const status = err?.status ?? err?.httpStatusCode ?? nestedCode;
        const msg = typeof err?.message === "string" ? err.message : "";
        const looksRateLimited =
          status === 429 ||
          /\b429\b/.test(msg) ||
          /RESOURCE_EXHAUSTED/i.test(msg) ||
          /quota/i.test(msg);
        const looksAuthFailure =
          status === 401 || status === 403 ||
          /\b401\b|\b403\b/.test(msg) ||
          /UNAUTHENTICATED|PERMISSION_DENIED/i.test(msg);
        console.error("generate: Gemini call failed", {
          status,
          message: msg,
          name: err?.name,
          details: err?.error ?? err?.response?.data,
        });
        if (looksRateLimited || looksAuthFailure) {
          continue;
        }
        // For other errors (bad prompt, content issues), don't retry
        break;
      }
    }

    return Response.json(
      { error: lastError?.message || "Failed to generate quiz." },
      { status: 502 }
    );
  } finally {
    await cleanupStorage();
  }
}
