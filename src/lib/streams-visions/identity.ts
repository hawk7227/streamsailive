export const VISIONS_IDENTITY_CONSENT_VERSION = "2026-07-16";
export const VISIONS_LIKENESS_BUCKET = "streams-visions-likeness";

export const VISIONS_CAPTURE_TYPES = [
  "front",
  "left_three_quarter",
  "right_three_quarter",
  "upper_body",
] as const;

export type VisionsCaptureType = (typeof VISIONS_CAPTURE_TYPES)[number];
export type VisionsLivenessStatus =
  | "not_started"
  | "capturing"
  | "submitted"
  | "manual_review"
  | "verified"
  | "retake_required"
  | "rejected";
export type VisionsLikenessStatus =
  | "locked"
  | "capturing"
  | "pending_review"
  | "approved"
  | "retake_required"
  | "deleted"
  | "rejected";

export type VisionsIdentityStatus = {
  authenticated: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  phone: string;
  accountDetailsComplete: boolean;
  fullName: string;
  dateOfBirth: string;
  country: string;
  stateRegion: string;
  noticeAccepted: boolean;
  consentVersion: string | null;
  livenessStatus: VisionsLivenessStatus;
  likenessProfileStatus: VisionsLikenessStatus;
  biometricLockEnabled: boolean;
  reviewReason: string | null;
  assetCount: number;
  requiredAssetCount: number;
  canEnterVisions: boolean;
};

export type VisionsCaptureMetadata = {
  captureType: VisionsCaptureType;
  storagePath: string;
  sha256: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
};

export const VISIONS_IDENTITY_NOTICE = {
  title: "Identity and Privacy Notice",
  paragraphs: [
    "Streams is a privacy-first company.",
    "To protect the integrity of the platform, Streams does not allow blank, fake, misleading, or impersonated profile images. Every user must complete a real-person identity and likeness setup before using Streams Visions.",
    "Streams does not make your identity images public, sell them, or use them for advertising.",
    "Streams may preserve or disclose identity-related information only when required by valid law, legal process, or a legitimate safety investigation. Any disclosure must be limited to what is legally required.",
    "By continuing, you agree to provide accurate facial images of yourself and authorize Streams to use them for identity protection, account security, fraud prevention, and private Visions personalization.",
  ],
  uses: [
    "Stored privately within your account",
    "Used to confirm that you are a real person",
    "Used to help prevent fraud, impersonation, abuse, and duplicate accounts",
    "Used to portray you consistently inside your private Streams Visions experiences",
  ],
  confirmations: [
    "I confirm that the images I provide are of me.",
    "I consent to the identity, fraud-prevention, account-security, and private Visions-personalization uses described above.",
    "I have reviewed the retention and deletion policy.",
  ],
} as const;

export function canEnterVisions(status: Pick<VisionsIdentityStatus, "emailVerified" | "phoneVerified" | "accountDetailsComplete" | "noticeAccepted" | "livenessStatus" | "likenessProfileStatus" | "biometricLockEnabled">) {
  return status.emailVerified
    && status.phoneVerified
    && status.accountDetailsComplete
    && status.noticeAccepted
    && status.livenessStatus === "verified"
    && status.likenessProfileStatus === "approved"
    && status.biometricLockEnabled;
}
