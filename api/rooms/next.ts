import { requireUser, supabaseAdmin } from "../../server/auth.js";

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid body." }, { status: 400 }); }
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  if (!roomId) return Response.json({ error: "Missing roomId." }, { status: 400 });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, host_id, status, current_question, quiz_data")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: "Room not found." }, { status: 404 });
  if (room.host_id !== auth.id) return Response.json({ error: "Host only." }, { status: 403 });
  if (room.status !== "active") return Response.json({ error: "Battle not active." }, { status: 409 });

  const total = Array.isArray(room.quiz_data?.questions) ? room.quiz_data.questions.length : 0;
  const nextIndex = room.current_question + 1;

  if (nextIndex >= total) {
    const { error: upErr } = await supabaseAdmin
      .from("rooms")
      .update({ status: "finished", question_start_time: null })
      .eq("id", roomId);
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 });
    return Response.json({ status: "finished", currentQuestion: room.current_question });
  }

  const { error: upErr } = await supabaseAdmin
    .from("rooms")
    .update({ current_question: nextIndex, question_start_time: new Date().toISOString() })
    .eq("id", roomId);
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });
  return Response.json({ status: "active", currentQuestion: nextIndex });
}
