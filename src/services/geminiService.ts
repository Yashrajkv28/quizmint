import { QuizData } from "../types";

export async function parseMCQs(
  rawText: string,
  filePart?: { mimeType: string; data: string },
  userApiKey?: string
): Promise<QuizData> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText, filePart, userApiKey: userApiKey || undefined }),
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
