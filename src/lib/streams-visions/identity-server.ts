import { createAdminClient } from "@/lib/supabase/admin";
import { canEnterVisions, type VisionsIdentityStatus } from "@/lib/streams-visions/identity";

export async function getVisionsIdentityAccess(user: { id: string; email_confirmed_at?: string | null; phone_confirmed_at?: string | null }) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("streams_visions_identity_profiles")
    .select("full_name,date_of_birth,country,state_region,notice_accepted_at,consent_version,liveness_status,likeness_profile_status,biometric_lock_enabled,last_biometric_verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const accountDetailsComplete = Boolean(profile?.full_name && profile?.date_of_birth && profile?.country && profile?.state_region);
  const status = {
    emailVerified: Boolean(user.email_confirmed_at),
    phoneVerified: Boolean(user.phone_confirmed_at),
    accountDetailsComplete,
    noticeAccepted: Boolean(profile?.notice_accepted_at),
    livenessStatus: (profile?.liveness_status || "not_started") as VisionsIdentityStatus["livenessStatus"],
    likenessProfileStatus: (profile?.likeness_profile_status || "locked") as VisionsIdentityStatus["likenessProfileStatus"],
    biometricLockEnabled: Boolean(profile?.biometric_lock_enabled),
  };
  const biometricFresh = typeof profile?.last_biometric_verified_at === "string"
    && Date.now() - new Date(profile.last_biometric_verified_at).getTime() <= 15 * 60 * 1000;

  return {
    allowed: canEnterVisions(status) && biometricFresh,
    enrolled: canEnterVisions(status),
    biometricFresh,
  };
}
