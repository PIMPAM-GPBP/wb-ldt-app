import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The brief's tables. While Phase 3b runs they live on a Supabase branch named by
 * BRIEF_SUPABASE_*; once Son approves the migration for production, those variables go and the
 * main project's are used.
 */

function config() {
  const onBranch = Boolean(process.env.BRIEF_SUPABASE_URL);
  return {
    url: process.env.BRIEF_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    // Never the main project's key against the branch's URL, or the reverse.
    serviceRoleKey: process.env.BRIEF_SUPABASE_SERVICE_ROLE_KEY ?? (onBranch ? null : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? null)),
  };
}

let storeClient: SupabaseClient | null = null;

/** Service-role client for the brief tables, or null when they are not configured. */
export function getBriefStore() {
  const { url, serviceRoleKey } = config();
  if (!url || !serviceRoleKey) return null;
  storeClient ??= createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return storeClient;
}

/**
 * The review console runs only under `next dev` on the admin's machine. A deployed build has no
 * sign-in and answers 404 for it, so every visitor to the site is a public reader.
 */
export function reviewConsoleEnabled() {
  return process.env.NODE_ENV === "development";
}
