import { requireActor, supabaseAdmin } from "../../server/auth.js";

const WINDOW_MS = 10_000;
const BASE_POINTS = 1000;

function calcPoints(elapsedMs: number): number {
  const clamped = Math.max(0, Math.min(WINDOW_MS, elapsedMs));
  // 1000 → 500 linearly over the 10s window. Wrong = 0 (handled below).
  return Math.round(BASE_POINTS * (1 - (clamped / WINDOW_MS) * 0.5));
}

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (actor instanceof Response) return actor;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid body." }, { status: 400 }); }
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const playerId = typeof body?.playerId === "string" ? body.playerId : "";
  const questionIndex = Number(body?.questionIndex);
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!roomId || !playerId || !optionId || !Number.isInteger(questionIndex) || questionIndex < 0) {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  // Player must belong to the room AND to this actor.
  const { data: player, error: playerErr } = await supabaseAdmin
    .from("room_players")
    .select("id, room_id, user_id, guest_id, score")
    .eq("id", playerId)
    .maybeSingle();
  if (playerErr) return Response.json({ error: playerErr.message }, { status: 500 });
  if (!player || player.room_id !== roomId) return Response.json({ error: "Player not in room." }, { status: 403 });
  if (actor.kind === "user" && player.user_id !== actor.userId) return Response.json({ error: "Not your player." }, { status: 403 });
  if (actor.kind === "guest" && player.guest_id !== actor.guestId) return Response.json({ error: "Not your player." }, { status: 403 });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("status, current_question, question_start_time, quiz_data")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "active") return Response.json({ error: "Battle not active." }, { status: 409 });
  if (room.current_question !== questionIndex) return Response.json({ error: "Wrong question." }, { status: 409 });

  const q = room.quiz_data?.questions?.[questionIndex];
  if (!q) return Response.json({ error: "Question missing." }, { status: 500 });

  const startedAt = room.question_start_time ? new Date(room.question_start_time).getTime() : Date.now();
  const elapsed = Date.now() - startedAt;
  const isCorrect = q.correctOptionId === optionId;
  // Beyond the window, answer is accepted but scores 0 (if correct) — matches "unanswered = 0".
  const pointsEarned = isCorrect && elapsed <= WINDOW_MS ? calcPoints(elapsed) : 0;

  const { error: insErr } = await supabaseAdmin
    .from("room_answers")
    .insert({
      room_id: roomId,
      player_id: playerId,
      question_index: questionIndex,
      option_id: optionId,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    });
  // 23505 = already answered this question — reject idempotently.
  if (insErr) {
    if ((insErr as any).code === "23505") return Response.json({ error: "Already answered." }, { status: 409 });
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  if (pointsEarned > 0) {
    const { error: scoreErr } = await supabaseAdmin
      .from("room_players")
      .update({ score: player.score + pointsEarned })
      .eq("id", playerId);
    if (scoreErr) console.error("score update failed", scoreErr);
  }

  return Response.json({ isCorrect, pointsEarned });
}
