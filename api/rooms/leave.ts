import { requireUser, supabaseAdmin } from "../../server/auth.js";

// Removes the caller's player row from a room. Used when a non-host
// participant wants to bail mid-battle (lobby, question, or leaderboard
// phases). The room_answers FK has ON DELETE CASCADE, so their submitted
// answers are cleaned up too — total scores recompute trivially because
// score lives on the player row that just got deleted.
//
// Host is rejected. Hosts can't leave their own room mid-battle without
// ending it for everyone — they should call /abandon (graceful "battle over"
// for all participants) or /destroy (hard delete, used by the rematch flow).
//
// Idempotent: if the player row is already gone, returns 200.
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid body." }, { status: 400 }); }
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  if (!roomId) return Response.json({ error: "Missing roomId." }, { status: 400 });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ ok: true }); // already gone — treat as success
  if (room.host_id === auth.id) {
    return Response.json({ error: "Host can't leave — abandon or cancel the room instead." }, { status: 403 });
  }

  const { error: delErr } = await supabaseAdmin
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", auth.id);
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

  return Response.json({ ok: true });
}
