export type ProactiveMessage = {
  id: string
  title: string
  message: string
  kind?: "info" | "success" | "warning" | "error"
  ctaLabel?: string
  ctaAction?: string
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


