import { requireUser, supabaseAdmin } from "../../server/auth.js";

// Hard-deletes a room (and via ON DELETE CASCADE, its players + answers).
// Host-only. Used by the rematch flow to reap the old room a couple of seconds
// after everyone has migrated to the new one. Idempotent: deleting a missing
// room returns 200 — matches the "fire and forget" call site.
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
  if (room.host_id !== auth.id) return Response.json({ error: "Only the host can destroy this room." }, { status: 403 });

  const { error: delErr } = await supabaseAdmin.from("rooms").delete().eq("id", roomId);
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 });
  return Response.json({ ok: true });
}
