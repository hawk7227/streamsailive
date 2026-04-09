const FAL_BASE = "https://queue.fal.run";

type FalStatus = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  response_url?: string;
  error?: string;
  logs?: { message: string; timestamp?: string }[];
};

function getFalKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error("FAL_KEY is not configured");
  }
  return key;
}

export async function falSubmit(modelPath: string, input: Record<string, unknown>) {
  const response = await fetch(`${FAL_BASE}/${modelPath}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${getFalKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`fal submit failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{
    request_id: string;
    response_url: string;
    status_url: string;
  }>;
}

export async function falPollUntilComplete(statusUrl: string, timeoutMs = 10 * 60 * 1000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(statusUrl + (statusUrl.includes("?") ? "&" : "?") + "logs=1", {
      headers: {
        "Authorization": `Key ${getFalKey()}`,
      },
    });

    if (!res.ok) {
      throw new Error(`fal status failed: ${res.status} ${await res.text()}`);
    }

    const status = (await res.json()) as FalStatus;
    if (status.status === "COMPLETED") {
      if (status.error) {
        throw new Error(status.error);
      }
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("fal request timed out");
}

export async function falGetResult<T>(responseUrl: string): Promise<T> {
  const res = await fetch(responseUrl, {
    headers: {
      "Authorization": `Key ${getFalKey()}`,
    },
  });

  if (!res.ok) {
    throw new Error(`fal result failed: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

export async function falRun<T>(
  modelPath: string,
  input: Record<string, unknown>,
  timeoutMs?: number,
): Promise<T> {
  const queued = await falSubmit(modelPath, input);
  await falPollUntilComplete(queued.status_url, timeoutMs);
  return falGetResult<T>(queued.response_url);
}
