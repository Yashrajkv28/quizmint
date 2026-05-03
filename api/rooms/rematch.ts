import { requireUser, supabaseAdmin } from "../../server/auth.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid body." }, { status: 400 }); }
  const oldRoomId = typeof body?.roomId === "string" ? body.roomId : "";
  if (!oldRoomId) return Response.json({ error: "Missing roomId." }, { status: 400 });

  // Load the old room — host-only, must be finished. We require 'finished' so
  // a rematch can only be triggered from the results screen, never mid-battle.
  const { data: oldRoom, error: oldErr } = await supabaseAdmin
    .from("rooms")
    .select("id, host_id, quiz_data, status")
    .eq("id", oldRoomId)
    .maybeSingle();
  if (oldErr) return Response.json({ error: oldErr.message }, { status: 500 });
  if (!oldRoom) return Response.json({ error: "Room not found." }, { status: 404 });
  if (oldRoom.host_id !== auth.id) return Response.json({ error: "Only the host can rematch." }, { status: 403 });
  if (oldRoom.status !== "finished") return Response.json({ error: "Battle is not finished." }, { status: 409 });

  // Find host's display name from old room so we keep it on the new room.
  const { data: hostPlayer, error: hpErr } = await supabaseAdmin
    .from("room_players")
    .select("display_name")
    .eq("room_id", oldRoomId)
    .eq("user_id", auth.id)
    .maybeSingle();
  if (hpErr) return Response.json({ error: hpErr.message }, { status: 500 });
  if (!hostPlayer) return Response.json({ error: "Host player row missing." }, { status: 500 });

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .insert({
        code,
        host_id: auth.id,
        quiz_data: oldRoom.quiz_data,
        status: "waiting",
        current_question: 0,
      })
      .select("id, code")
      .single();
    if (roomErr || !room) {
      if ((roomErr as any)?.code === "23505") continue;
      console.error("rematch room insert failed", roomErr);
      return Response.json({ error: roomErr?.message || "Could not create room." }, { status: 500 });
    }

    const { data: player, error: playerErr } = await supabaseAdmin
      .from("room_players")
      .insert({
        room_id: room.id,
        user_id: auth.id,
        guest_id: null,
        display_name: hostPlayer.display_name,
      })
      .select("id")
      .single();
    if (playerErr || !player) {
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      console.error("rematch host player insert failed", playerErr);
      return Response.json({ error: playerErr?.message || "Could not create host player." }, { status: 500 });
    }

    return Response.json({ roomId: room.id, roomCode: room.code, playerId: player.id });
  }
  return Response.json({ error: "Could not allocate room code." }, { status: 500 });
}
