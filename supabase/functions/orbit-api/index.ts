import { createOrbitHandler } from "./handler.mjs";

const url = Deno.env.get("SUPABASE_URL");
// Use the legacy anon key INSIDE the function; NEVER the service-role key.
const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
if (!url || !publicKey) throw new Error("Orbit API is not configured");
Deno.serve(createOrbitHandler({ url, publicKey }));
