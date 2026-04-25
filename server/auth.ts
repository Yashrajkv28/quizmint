import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy init — if we create the client at module load and the env vars are missing,
// every function invocation crashes with FUNCTION_INVOCATION_FAILED (opaque 500, no body).
// Building on first use lets the handler return a normal JSON error instead.
let _client: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error(
      `Missing Supabase env vars (url=${!!url}, secret=${!!secret}). Check VITE_SUPABASE_URL and SUPABASE_SECRET_KEY.`,
    );
  }
  _client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Proxy so `supabaseAdmin.storage.from(...)` still works at call sites.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const client = getAdmin() as any;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export interface AuthedUser {
  id: string;
  email: string | null;
}

export async function requireUser(request: Request): Promise<AuthedUser | Response> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return Response.json({ error: "Invalid session." }, { status: 401 });
  }
  return { id: data.user.id, email: data.user.email ?? null };
}
