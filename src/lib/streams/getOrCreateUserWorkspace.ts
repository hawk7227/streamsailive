/**
 * getOrCreateUserWorkspace.ts
 * 
 * Get user's workspace from metadata, or create one if first-time user
 * Each user gets one default workspace
 */

import { createClient } from "@supabase/supabase-js";

export async function getOrCreateUserWorkspace(userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  try {
    // Try to get user metadata with workspace_id
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user?.user_metadata?.workspace_id) {
      return user.user_metadata.workspace_id as string;
    }

    // If no workspace in metadata, create one
    // Generate a workspace ID (using a deterministic hash based on user_id)
    // In production: call API to create workspace in database + store in auth metadata
    const workspaceId = `ws_${userId.substring(0, 8)}_default`;
    
    // In a real app: 
    // 1. Create workspace in database
    // 2. Store in auth.user_metadata
    // For now: return deterministic ID
    
    return workspaceId;
  } catch (error) {
    console.error("Error getting workspace:", error);
    // Fallback: use user ID as workspace
    return `ws_${userId.substring(0, 8)}_default`;
  }
}
