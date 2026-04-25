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
    .select("id, host_id, status")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: "Room not found." }, { status: 404 });
  if (room.host_id !== auth.id) return Response.json({ error: "Only the host can start the battle." }, { status: 403 });
  if (room.status !== "waiting") return Response.json({ error: "Battle already started." }, { status: 409 });

  const { count } = await supabaseAdmin
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if ((count ?? 0) < 2) return Response.json({ error: "Need at least 2 players." }, { status: 400 });

  const { error: upErr } = await supabaseAdmin
    .from("rooms")
    .update({ status: "active", current_question: 0, question_start_time: new Date().toISOString() })
    .eq("id", roomId);
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  return Response.json({ ok: true });
}
