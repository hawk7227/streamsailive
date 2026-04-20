import { ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET, ADOBE_EXPRESS_CLIENT_ID, ADOBE_FIREFLY_API_KEY, ADOBE_ORG_ID } from "@/lib/env";
export interface AdobeEnvStatus {
  photoshopEnabled: boolean;
  fireflyEnabled: boolean;
  expressEnabled: boolean;
  missing: string[];
}

export function getAdobeEnvStatus(): AdobeEnvStatus {
  const missing: string[] = [];
  const photoshopEnabled = Boolean(ADOBE_CLIENT_ID && ADOBE_CLIENT_SECRET && ADOBE_ORG_ID);
  const fireflyEnabled = Boolean(ADOBE_FIREFLY_API_KEY);
  const expressEnabled = Boolean(ADOBE_EXPRESS_CLIENT_ID);
  if (!photoshopEnabled) missing.push("ADOBE_CLIENT_ID/ADOBE_CLIENT_SECRET/ADOBE_ORG_ID");
  if (!fireflyEnabled) missing.push("ADOBE_FIREFLY_API_KEY");
  if (!expressEnabled) missing.push("ADOBE_EXPRESS_CLIENT_ID");
  return { photoshopEnabled, fireflyEnabled, expressEnabled, missing };
}

export async function requireAdobePhotoshop(): Promise<void> {
  const status = getAdobeEnvStatus();
  if (!status.photoshopEnabled) {
    throw new Error(`Adobe Photoshop API is not configured. Missing: ${status.missing.join(", ")}`);
  }
}

export async function requireAdobeFirefly(): Promise<void> {
  const status = getAdobeEnvStatus();
  if (!status.fireflyEnabled) {
    throw new Error(`Adobe Firefly API is not configured. Missing: ${status.missing.join(", ")}`);
  }
}
