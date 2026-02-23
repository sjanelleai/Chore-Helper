import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

const LATEST_CATALOG_VERSION = 1;

interface EnsureCatalogSeededParams {
  supabase: SupabaseClient;
  queryClient: QueryClient;
  familyId: string;
}

export async function ensureCatalogSeeded({
  supabase,
  queryClient,
  familyId,
}: EnsureCatalogSeededParams): Promise<{ seeded: boolean }> {
  const { data: settings, error: settingsErr } = await supabase
    .from("family_settings")
    .select("catalog_version")
    .eq("family_id", familyId)
    .single();

  if (settingsErr && settingsErr.code !== "PGRST116") throw settingsErr;

  const currentVersion = settings?.catalog_version ?? 0;

  if (currentVersion >= LATEST_CATALOG_VERSION) {
    return { seeded: false };
  }

  const { data: result, error: seedError } = await supabase.rpc("seed_default_catalog", {
    p_family_id: familyId,
  });
  if (seedError) throw seedError;

  const didSeed = result?.seeded === true;

  if (didSeed) {
    queryClient.invalidateQueries({ queryKey: ["chore_catalog", familyId] });
    queryClient.invalidateQueries({ queryKey: ["reward_catalog", familyId] });
  }

  return { seeded: didSeed };
}
