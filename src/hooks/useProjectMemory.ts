/**
 * useProjectMemory.ts — Phase 10
 * 
 * Load project context (memory, tasks, artifacts) for chat
 * Provides project-aware generation
 * 
 * Usage:
 * const { projectMemory, isLoading } = useProjectMemory(projectId, userId)
 * 
 * Returns:
 * - Recent artifacts (last 10)
 * - Active tasks (not completed)
 * - Memory facts (relevant to project)
 * - Generation history (what was created)
 */

import { useEffect, useState, useCallback } from 'react';

export interface ProjectMemory {
  projectId: string;
  recentArtifacts: Array<{
    id: string;
    title: string;
    type: 'react' | 'html' | 'svg' | 'code';
    createdAt: string;
    description?: string;
  }>;
  activeTasks: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in-progress' | 'blocked' | 'review';
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
  }>;
  memoryFacts: Array<{
    id: string;
    key: string;
    value: string;
    category: 'architecture' | 'style' | 'constraint' | 'requirement';
  }>;
  generationHistory: Array<{
    id: string;
    prompt: string;
    mode: string;
    createdAt: string;
    artifactId?: string;
  }>;
}

export interface UseProjectMemoryReturn {
  projectMemory: ProjectMemory | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProjectMemory(
  projectId: string,
  userId: string
): UseProjectMemoryReturn {
  const [projectMemory, setProjectMemory] = useState<ProjectMemory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
    if (!projectId || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Parallel requests to load all project context
      const [artifactsRes, tasksRes, memoryRes, historyRes] = await Promise.all([
        fetch(`/api/streams/artifacts?projectId=${projectId}&limit=10`),
        fetch(`/api/streams/tasks?projectId=${projectId}&status=active`),
        fetch(`/api/streams/memory/facts?projectId=${projectId}`),
        fetch(`/api/streams/generation-history?projectId=${projectId}&limit=20`),
      ]);

      const artifacts = artifactsRes.ok
        ? await artifactsRes.json()
        : { artifacts: [] };

      const tasks = tasksRes.ok
        ? await tasksRes.json()
        : { tasks: [] };

      const memory = memoryRes.ok
        ? await memoryRes.json()
        : { facts: [] };

      const history = historyRes.ok
        ? await historyRes.json()
        : { generations: [] };

      setProjectMemory({
        projectId,
        recentArtifacts: artifacts.artifacts || [],
        activeTasks: tasks.tasks || [],
        memoryFacts: memory.facts || [],
        generationHistory: history.generations || [],
      });
    } catch (err) {
      console.error('Error loading project memory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project memory');
      
      // Fallback to empty memory on error
      setProjectMemory({
        projectId,
        recentArtifacts: [],
        activeTasks: [],
        memoryFacts: [],
        generationHistory: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, userId]);

  // Load memory on mount and when projectId changes
  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  return {
    projectMemory,
    isLoading,
    error,
    refresh: loadMemory,
  };
}

/**
 * Format project memory for Claude API context
 * Creates a rich context string to pass to the generation endpoint
 */
export function formatProjectContextForAPI(memory: ProjectMemory | null): string {
  if (!memory) return '';

  const sections: string[] = [];

  // Recent artifacts
  if (memory.recentArtifacts.length > 0) {
    sections.push(
      `## Recent Artifacts\n${memory.recentArtifacts
        .map(
          (a) =>
            `- ${a.title} (${a.type}) - ${new Date(a.createdAt).toLocaleDateString()}${
              a.description ? `\n  ${a.description}` : ''
            }`
        )
        .join('\n')}`
    );
  }

  // Active tasks
  if (memory.activeTasks.length > 0) {
    sections.push(
      `## Active Tasks\n${memory.activeTasks
        .map((t) => `- [${t.status}] ${t.title} (${t.priority})`)
        .join('\n')}`
    );
  }

  // Memory facts
  if (memory.memoryFacts.length > 0) {
    const categorized = memory.memoryFacts.reduce(
      (acc, fact) => {
        if (!acc[fact.category]) acc[fact.category] = [];
        acc[fact.category].push(fact);
        return acc;
      },
      {} as Record<string, typeof memory.memoryFacts>
    );

    sections.push(
      `## Project Knowledge\n${Object.entries(categorized)
        .map(
          ([category, facts]) =>
            `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n${facts
              .map((f) => `- ${f.key}: ${f.value}`)
              .join('\n')}`
        )
        .join('\n\n')}`
    );
  }

  // Recent generation history
  if (memory.generationHistory.length > 0) {
    const recent = memory.generationHistory.slice(0, 5);
    sections.push(
      `## Recent Generations\n${recent
        .map((g) => `- ${g.prompt} (${g.mode})`)
        .join('\n')}`
    );
  }

  return sections.join('\n\n');
}

/**
 * Get summary for activity phase
 * Shows what context is being loaded
 */
export function getMemorySummary(memory: ProjectMemory | null): {
  artifactCount: number;
  taskCount: number;
  factCount: number;
  historyCount: number;
} {
  return {
    artifactCount: memory?.recentArtifacts.length ?? 0,
    taskCount: memory?.activeTasks.length ?? 0,
    factCount: memory?.memoryFacts.length ?? 0,
    historyCount: memory?.generationHistory.length ?? 0,
  };
}
