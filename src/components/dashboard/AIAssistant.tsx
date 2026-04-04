export type ProactiveMessage = {
  id: string
  text: string
  type:
    | "generation_complete"
    | "generation_started"
    | "generation_failed"
    | "info"
    | "warning"
    | "error"
  imageUrl?: string
  videoUrl?: string
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5"
}

type AssistantContext = {
  type: string
  prompt?: string
  settings?: Record<string, unknown>
}

type AIAssistantProps = {
  context?: AssistantContext
  onApplyPrompt?: (newPrompt: string) => void
  onUpdateSettings?: (key: string, value: string) => void
}

export default function AIAssistant({
  context,
  onApplyPrompt,
  onUpdateSettings,
}: AIAssistantProps) {
  return null
}


