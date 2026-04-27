/**
 * PHASE 9: CHAT CONTROL PLANE - COMPONENT EXPORTS
 * 
 * Complete concurrent artifact rendering system with:
 * - Activity timeline with real work steps
 * - Split-panel layout (desktop & mobile)
 * - Concurrent code + async content rendering
 * - Auto-scroll with smart pause
 * - Progress indication for parallel work
 */

export { Phase9ChatControlPlane } from './Phase9ChatControlPlane';
export type { Phase9ChatControlPlaneProps } from './Phase9ChatControlPlane';

export { ActivityTimeline } from './ActivityTimeline';
export type { ActivityStep, ActivityTimelineProps } from './ActivityTimeline';

export { SplitPanelChat } from './SplitPanelChat';
export type { ChatMessage, SplitPanelChatProps } from './SplitPanelChat';

export { ConcurrentArtifactRenderer } from './ConcurrentArtifactRenderer';
export type {
  ConcurrentArtifactRendererProps,
  ArtifactData,
  AsyncContent,
} from './ConcurrentArtifactRenderer';

/**
 * QUICK START USAGE:
 * 
 * In your chat component:
 * 
 * import { Phase9ChatControlPlane } from '@/components/streams/artifacts';
 * 
 * export function MyChat() {
 *   return (
 *     <Phase9ChatControlPlane
 *       projectId="proj_123"
 *       userId="user_456"
 *       onArtifactGenerated={(id) => console.log('Generated:', id)}
 *     />
 *   );
 * }
 */
