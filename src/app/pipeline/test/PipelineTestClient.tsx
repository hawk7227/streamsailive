type QueueItem = {
  id: string
  type: "image" | "video"
  status: QueueStatus
  model?: string | null
  prompt: string
  conceptId: string
  completedAt: string | null
  outputUrl?: string
  startedAt?: string
}
