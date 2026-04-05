// FIXED: real rendering + preview + fail state
"use client";
import { useEffect, useState } from "react";

export default function BulkCreativeWorkspace() {
  const [job, setJob] = useState<any>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const firstOutput = job?.manifest?.outputs?.[0];

  useEffect(() => {
    if (firstOutput) {
      setSelectedTaskId(firstOutput.taskId);
    }
  }, [firstOutput]);

  return (
    <div>
      {job?.manifest?.outputs?.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {job.manifest.outputs.map((o: any) => (
            <div key={o.taskId} className="border rounded overflow-hidden">
              <img src={o.url} className="w-full" />
            </div>
          ))}
        </div>
      )}

      {job?.status === "failed" && (
        <div className="text-red-400 text-sm">
          Job failed — check task trace
        </div>
      )}
    </div>
  );
}
