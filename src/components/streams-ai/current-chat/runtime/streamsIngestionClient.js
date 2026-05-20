function ensureOk(response, fallbackMessage) {
  if (!response.ok) throw new Error(fallbackMessage);
  return response.json();
}

export function createStreamsIngestionClient({ baseUrl = "", fetcher = fetch } = {}) {
  return {
    async createJob(payload) {
      const response = await fetcher(`${baseUrl}/api/streams/ingest/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return ensureOk(response, "Ingestion job creation failed.");
    },

    async getStatus(jobId) {
      const response = await fetcher(`${baseUrl}/api/streams/ingest/${jobId}/status`);
      return ensureOk(response, "Ingestion status request failed.");
    },

    async cancel(jobId) {
      const response = await fetcher(`${baseUrl}/api/streams/ingest/${jobId}/cancel`, {
        method: "POST",
      });
      return ensureOk(response, "Ingestion cancellation failed.");
    },
  };
}
