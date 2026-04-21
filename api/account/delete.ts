import { requireUser, supabaseAdmin } from "../../server/auth.js";

const BUCKET = "user-uploads";

// Delete the signed-in user's auth row and any residual storage objects. The admin client
// bypasses RLS; we scope strictly to the authed user's id.
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth instanceof Response) return auth;

    // Wipe any uploads the user still has in storage.
    const { data: files } = await supabaseAdmin.storage.from(BUCKET).list(auth.id, { limit: 1000 });
    if (files && files.length > 0) {
      const paths = files.map((f) => `${auth.id}/${f.name}`);
      await supabaseAdmin.storage.from(BUCKET).remove(paths);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(auth.id);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("account/delete: unexpected error", { message: err?.message });
    return Response.json({ error: err?.message || "Failed to delete account." }, { status: 500 });
  }
}
