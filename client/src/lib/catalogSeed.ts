import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

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
  const choresCount = await supabase
    .from("chore_catalog")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);

  if (choresCount.error) throw choresCount.error;

  const rewardsCount = await supabase
    .from("reward_catalog")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);

  if (rewardsCount.error) throw rewardsCount.error;

  const needsSeed =
    (choresCount.count ?? 0) === 0 || (rewardsCount.count ?? 0) === 0;

  if (needsSeed) {
    const { error: seedError } = await supabase.rpc("seed_default_catalog", {
      p_family_id: familyId,
    });
    if (seedError) throw seedError;

    queryClient.invalidateQueries({ queryKey: ["chore_catalog", familyId] });
    queryClient.invalidateQueries({ queryKey: ["reward_catalog", familyId] });
  }

  return { seeded: needsSeed };
}
