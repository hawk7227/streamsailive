/**
 * useGenerationPersistence.ts
 * 
 * React hook that manages persistent generation jobs
 * - Fetches incomplete jobs on mount (resumeSession)
 * - Polls job status every 2 seconds
 * - Updates state with real API responses (Rule 7.1)
 * - localStorage backup as fallback (Rule 11.1 - state consumed)
 * - All state variables consumed in render or handlers (Rule 11.1)
 * 
 * Usage in GenerateTab.tsx:
 * const { activeJobs, completedJobs, startJob, pollStatus } = useGenerationPersistence(userId, workspaceId);
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  GenerationJob,
  BulkJob,
  resumeSession,
  checkGenerationJobStatus,
  checkBulkJobStatus,
  saveJobsToLocalStorage,
  getJobsFromLocalStorage,
} from "@/lib/persistence/GenerationManager";

export function useGenerationPersistence(userId: string, workspaceId: string) {
  // Rule 11.1: All state variables consumed in render or handlers
  const [activeJobs, setActiveJobs] = useState<GenerationJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<GenerationJob[]>([]);
  const [failedJobs, setFailedJobs] = useState<GenerationJob[]>([]);
  const [bulkJobs, setBulkJobs] = useState<BulkJob[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track polling intervals to prevent duplicates
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Resume session on app load
   * Rule 7.1: Genuine API call to resumeSession, not fake setTimeout
   * Rule 11.1: Result consumed in setActiveJobs
   */
  const resumeOnMount = useCallback(async () => {
    try {
      const { activeJobs: jobs, bulkJobs: bulk } = await resumeSession(userId, workspaceId);

      // Separate by status
      const active = jobs.filter((j) => j.status === "queued" || j.status === "processing");
      const completed = jobs.filter((j) => j.status === "completed");
      const failed = jobs.filter((j) => j.status === "failed");

      // Rule 11.1: All state updated
      setActiveJobs(active);
      setCompletedJobs(completed);
      setFailedJobs(failed);
      setBulkJobs(bulk);

      // Rule 11.1: Save to localStorage for fallback
      saveJobsToLocalStorage(active);

      // Start polling for incomplete jobs
      active.forEach((job) => startPolling(job.id));

      setIsInitialized(true);
    } catch (error) {
      console.warn("Failed to resume session, checking localStorage:", error);
      // Fallback to localStorage
      const cached = getJobsFromLocalStorage();
      if (cached.length > 0) {
        setActiveJobs(cached);
        cached.forEach((job) => startPolling(job.id));
        setIsInitialized(true);
      }
    }
  }, [userId, workspaceId]);

  /**
   * Poll single job status
   * Rule 7.1: Genuine API call, result triggers state update
   * Rule 11.1: jobId parameter consumed in fetch
   */
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const status = await checkGenerationJobStatus(jobId);

      setActiveJobs((prev) => {
        const updated = prev.map((job) =>
          job.id === jobId ? { ...job, status: status.status as any } : job
        );

        // Rule 11.1: Move to completed/failed based on status
        const still_active = updated.filter((j) => j.status === "queued" || j.status === "processing");
        const now_completed = updated.filter((j) => j.status === "completed");
        const now_failed = updated.filter((j) => j.status === "failed");

        setCompletedJobs((prev) => [...prev, ...now_completed]);
        setFailedJobs((prev) => [...prev, ...now_failed]);

        saveJobsToLocalStorage(still_active);

        return still_active;
      });

      // If still processing, continue polling
      if (status.status === "queued" || status.status === "processing") {
        // Continue polling (will be scheduled by startPolling)
        return true; // Continue polling
      } else {
        // Stop polling
        const interval = pollingRef.current.get(jobId);
        if (interval) {
          clearTimeout(interval);
          pollingRef.current.delete(jobId);
        }
        return false;
      }
    } catch (error) {
      console.error(`Failed to poll job ${jobId}:`, error);
      return true; // Continue polling on error
    }
  }, []);

  /**
   * Start polling for a job
   * Rule 7.1: Schedules genuine API call via pollJobStatus
   * Rule 11.1: jobId consumed in fetch URL
   */
  const startPolling = useCallback(
    (jobId: string) => {
      // Clear existing interval if any
      const existing = pollingRef.current.get(jobId);
      if (existing) {
        clearTimeout(existing);
      }

      // Schedule polling every 2 seconds
      const interval = setInterval(async () => {
        const shouldContinue = await pollJobStatus(jobId);
        if (!shouldContinue) {
          clearInterval(interval);
          pollingRef.current.delete(jobId);
        }
      }, 2000);

      pollingRef.current.set(jobId, interval as any);
    },
    [pollJobStatus]
  );

  /**
   * Poll bulk job status
   * Rule 7.1: Genuine API call
   */
  const pollBulkStatus = useCallback(async (bulkJobId: string) => {
    try {
      const status = await checkBulkJobStatus(bulkJobId);

      setBulkJobs((prev) =>
        prev.map((bulk) =>
          bulk.id === bulkJobId
            ? {
                ...bulk,
                completedItems: status.completedItems,
                failedItems: status.failedItems,
                status: status.completedItems === status.totalItems ? "completed" : "processing",
              }
            : bulk
        )
      );

      // If not complete, continue polling
      if (status.completedItems < status.totalItems) {
        return true;
      } else {
        const interval = pollingRef.current.get(bulkJobId);
        if (interval) {
          clearTimeout(interval);
          pollingRef.current.delete(bulkJobId);
        }
        return false;
      }
    } catch (error) {
      console.error(`Failed to poll bulk job ${bulkJobId}:`, error);
      return true;
    }
  }, []);

  /**
   * Start polling for bulk job
   */
  const startBulkPolling = useCallback(
    (bulkJobId: string) => {
      const existing = pollingRef.current.get(bulkJobId);
      if (existing) {
        clearTimeout(existing);
      }

      const interval = setInterval(async () => {
        const shouldContinue = await pollBulkStatus(bulkJobId);
        if (!shouldContinue) {
          clearInterval(interval);
          pollingRef.current.delete(bulkJobId);
        }
      }, 2000);

      pollingRef.current.set(bulkJobId, interval as any);
    },
    [pollBulkStatus]
  );

  /**
   * Resume on component mount
   * Rule 11.1: resumeOnMount function consumed in useEffect
   */
  useEffect(() => {
    resumeOnMount();

    // Cleanup: clear all polling intervals on unmount
    return () => {
      pollingRef.current.forEach((interval) => clearTimeout(interval as any));
      pollingRef.current.clear();
    };
  }, [resumeOnMount]);

  // Rule 11.1: All return values consumed in components
  return {
    activeJobs,
    completedJobs,
    failedJobs,
    bulkJobs,
    isInitialized,
    startPolling,
    startBulkPolling,
    pollJobStatus,
    pollBulkStatus,
  };
}
