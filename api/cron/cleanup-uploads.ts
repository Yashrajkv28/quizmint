import { supabaseAdmin } from "../../server/auth.js";

const BUCKET = "user-uploads";
// Anything older than this is fair game — generations complete in seconds; this leaves a
// generous margin for slow requests while still meaning no user doc survives for long.
const MAX_AGE_MS = 15 * 60 * 1000;

// Vercel Cron jobs hit this endpoint on a schedule (configured in vercel.json). Vercel
// injects an Authorization: Bearer <CRON_SECRET> header — we verify it so nobody else
// can trigger a bucket wipe.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization") || request.headers.get("Authorization");
    if (header !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cutoff = Date.now() - MAX_AGE_MS;
  const toDelete: string[] = [];

  // Bucket layout is {userId}/{timestamp}-{filename}. List top-level "folders" (users),
  // then walk each one. We cap depth/count defensively.
  const { data: userFolders, error: listErr } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .list("", { limit: 1000 });

  if (listErr) {
    return Response.json({ error: listErr.message }, { status: 500 });
  }

  for (const folder of userFolders ?? []) {
    if (!folder.name) continue;
    const { data: files, error: innerErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .list(folder.name, { limit: 1000 });
    if (innerErr) continue;
    for (const f of files ?? []) {
      if (!f.name) continue;
      const created = f.created_at ? new Date(f.created_at).getTime() : 0;
      if (created && created < cutoff) {
        toDelete.push(`${folder.name}/${f.name}`);
      }
    }
  }

  if (toDelete.length === 0) {
    return Response.json({ deleted: 0 });
  }

  const { error: removeErr } = await supabaseAdmin.storage.from(BUCKET).remove(toDelete);
  if (removeErr) {
    return Response.json({ error: removeErr.message, attempted: toDelete.length }, { status: 500 });
  }

  return Response.json({ deleted: toDelete.length });
}
