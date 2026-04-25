import { requireActor, supabaseAdmin } from "../../server/auth.js";

const MAX_PLAYERS = 20;
const NAME_MIN = 1;
const NAME_MAX = 32;

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (actor instanceof Response) return actor;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid body." }, { status: 400 }); }

  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!/^[A-Z0-9]{6}$/.test(code)) return Response.json({ error: "Invalid room code." }, { status: 400 });
  if (displayName.length < NAME_MIN || displayName.length > NAME_MAX) {
    return Response.json({ error: `Display name must be ${NAME_MIN}-${NAME_MAX} characters.` }, { status: 400 });
  }

  const { data: room, error: roomErr } = await supabaseAdmin
    .from("rooms")
    .select("id, status")
    .eq("code", code)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: "Room not found." }, { status: 404 });
  if (room.status === "finished") return Response.json({ error: "This battle has already ended." }, { status: 409 });

  // Reject late joiners once the battle has started — easier UX than letting players into the middle of a question.
  if (room.status === "active") return Response.json({ error: "Battle already in progress." }, { status: 409 });

  // If the same actor is already in the room, return the existing player row (idempotent rejoin).
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq(actor.kind === "user" ? "user_id" : "guest_id", actor.kind === "user" ? actor.userId : actor.guestId)
    .maybeSingle();
  if (exErr) return Response.json({ error: exErr.message }, { status: 500 });
  if (existing) {
    return Response.json({ roomId: room.id, playerId: existing.id });
  }

  // Enforce player cap (only checked for new joiners, not rejoins).
  const { count, error: countErr } = await supabaseAdmin
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if (countErr) return Response.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= MAX_PLAYERS) return Response.json({ error: "Room is full." }, { status: 409 });

  const { data: player, error: insErr } = await supabaseAdmin
    .from("room_players")
    .insert({
      room_id: room.id,
      user_id: actor.kind === "user" ? actor.userId : null,
      guest_id: actor.kind === "guest" ? actor.guestId : null,
      display_name: displayName,
    })
    .select("id")
    .single();
  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

  return Response.json({ roomId: room.id, playerId: player.id });
}
