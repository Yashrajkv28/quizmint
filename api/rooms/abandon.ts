import { requireUser, supabaseAdmin } from "../../server/auth.js";

// Called when a non-host participant detects via Supabase Realtime presence
// that the host has been disconnected for ~20s. Marks the room as finished so
// everyone transitions to the BattleResults screen instead of staring at a
// frozen leaderboard.
//
// Trust model: any signed-in user who has a row in this room's room_players
// (or is the host themselves) can call this. Worst-case abuse is a player
// ending their own battle early, which is no worse than them closing their
// tab — accepted.
//
// Idempotent: if the room is already finished, this is a no-op.

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

  if (room.status === "finished") {
    return Response.json({ status: "finished" });
  }

  // Caller must be a participant (host or a player in this room).
  if (room.host_id !== auth.id) {
    const { data: player, error: playerErr } = await supabaseAdmin
      .from("room_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", auth.id)
      .maybeSingle();
    if (playerErr) return Response.json({ error: playerErr.message }, { status: 500 });
    if (!player) return Response.json({ error: "Not a participant." }, { status: 403 });
  }

  const { error: upErr } = await supabaseAdmin
    .from("rooms")
    .update({ status: "finished", question_start_time: null })
    .eq("id", roomId)
    .eq("status", room.status); // Optimistic: only update if still in the status we read.
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  return Response.json({ status: "finished" });
}
