import { requireUser, supabaseAdmin } from "../../server/auth.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L for legibility
const CODE_LEN = 6;
const NAME_MIN = 1;
const NAME_MAX = 32;

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

  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  if (displayName.length < NAME_MIN || displayName.length > NAME_MAX) {
    return Response.json({ error: `Display name must be ${NAME_MIN}-${NAME_MAX} characters.` }, { status: 400 });
  }

  // Retry up to 5x on (extremely unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const { data: room, error: roomErr } = await supabaseAdmin
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
    if (roomErr || !room) {
      // 23505 = unique_violation on code; retry. Anything else is a real failure.
      if ((roomErr as any)?.code === "23505") continue;
      console.error("create room failed", roomErr);
      return Response.json({ error: roomErr?.message || "Could not create room." }, { status: 500 });
    }

    // Host auto-joins as a player so they can compete and appear on the
    // leaderboard. Host-only "spectator" mode would be a separate feature.
    const { data: player, error: playerErr } = await supabaseAdmin
      .from("room_players")
      .insert({
        room_id: room.id,
        user_id: auth.id,
        guest_id: null,
        display_name: displayName,
      })
      .select("id")
      .single();
    if (playerErr || !player) {
      // Roll back the room so we don't leave an orphan if the player insert failed.
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      console.error("create host player failed", playerErr);
      return Response.json({ error: playerErr?.message || "Could not create host player." }, { status: 500 });
    }

    return Response.json({ roomId: room.id, roomCode: room.code, playerId: player.id });
  }
  return Response.json({ error: "Could not allocate room code." }, { status: 500 });
}
