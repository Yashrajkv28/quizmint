import { requireUser, supabaseAdmin } from "../../server/auth.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L for legibility
const CODE_LEN = 6;

function genCode(): string {
  let out = "";
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function isValidQuizData(x: any): boolean {
  if (!x || typeof x !== "object") return false;
  if (!Array.isArray(x.questions) || x.questions.length === 0) return false;
  for (const q of x.questions) {
    if (typeof q?.question !== "string") return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    if (typeof q.correctOptionId !== "string") return false;
  }
  return true;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid body." }, { status: 400 }); }
  if (!isValidQuizData(body?.quizData)) {
    return Response.json({ error: "Invalid quizData." }, { status: 400 });
  }

  // Retry up to 5x on (extremely unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const { data, error } = await supabaseAdmin
      .from("rooms")
      .insert({
        code,
        host_id: auth.id,
        quiz_data: body.quizData,
        status: "waiting",
        current_question: 0,
      })
      .select("id, code")
      .single();
    if (!error && data) {
      return Response.json({ roomId: data.id, roomCode: data.code });
    }
    // 23505 = unique_violation — try a new code; anything else is a real failure.
    if ((error as any)?.code !== "23505") {
      console.error("create room failed", error);
      return Response.json({ error: error?.message || "Could not create room." }, { status: 500 });
    }
  }
  return Response.json({ error: "Could not allocate room code." }, { status: 500 });
}
