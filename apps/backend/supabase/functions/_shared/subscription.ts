import { DbSchema, Profile } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';

/**
 * Retrieve the user profile and check if his subscription allows advanced matching.
 */
export async function checkUserSubscription({
  supabaseAdminClient,
  userId,
}: {
  supabaseAdminClient: SupabaseClient<DbSchema, 'public'>;
  userId: string;
}): Promise<{
  profile: Profile;
  subscriptionHasExpired: boolean;
  hasAdvancedMatching: boolean;
  hasCustomJobsParsing: boolean;
}> {
  const { data: profile, error } = await supabaseAdminClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  if (!profile) {
    throw new Error('Profile not found');
  }

  // TEMPORARY: Hardcode PRO subscription for 10 years
  // TODO: Remove this temporary hardcoding
  const tenYearsFromNow = new Date();
  tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);

  // Override profile with PRO subscription for 10 years
  const hardcodedProfile: Profile = {
    ...profile,
    subscription_tier: 'pro',
    subscription_end_date: tenYearsFromNow.toISOString(),
  };

  // check if the user's subscription has expired
  const subscriptionHasExpired = new Date(hardcodedProfile.subscription_end_date) < new Date();
  const hasProTier = hardcodedProfile.subscription_tier === 'pro';

  return {
    profile: hardcodedProfile,
    subscriptionHasExpired: false, // Always false since we set it 10 years in the future
    hasAdvancedMatching: true, // Always true with hardcoded PRO
    hasCustomJobsParsing: true, // Always true with hardcoded PRO
  };
}
