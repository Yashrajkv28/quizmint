import { GoogleGenAI, Type } from "@google/genai";

interface GenerateRequest {
  rawText: string;
  filePart?: { mimeType: string; data: string };
  userApiKey?: string;
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
  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { rawText, filePart, userApiKey } = body;
  if (!rawText?.trim() && !filePart) {
    return Response.json({ error: "No input provided." }, { status: 400 });
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

    // Check base64 size (~10MB limit, base64 is ~4/3 of original)
    const maxBase64Size = 14 * 1024 * 1024;
    if (filePart.data.length > maxBase64Size) {
      return Response.json(
        { error: "File too large. Maximum size is 10MB." },
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
      // For other errors (bad prompt, content issues), don't retry
      break;
    }
  }

  return Response.json(
    { error: lastError?.message || "Failed to generate quiz." },
    { status: 502 }
  );
}
