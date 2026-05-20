function ensureOk(response, fallbackMessage) {
  if (!response.ok) throw new Error(fallbackMessage);
  return response.json();
}

export function createStreamsProviderRouterClient({ baseUrl = "", fetcher = fetch } = {}) {
  return {
    async createMediaJob(payload) {
      const response = await fetcher(`${baseUrl}/api/streams/media/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return ensureOk(response, "Media job creation failed.");
    },

    async getMediaStatus(jobId) {
      const response = await fetcher(`${baseUrl}/api/streams/media/${jobId}/status`);
      return ensureOk(response, "Media status request failed.");
    },

    async cancelMediaJob(jobId) {
      const response = await fetcher(`${baseUrl}/api/streams/media/${jobId}/cancel`, {
        method: "POST",
      });
      return ensureOk(response, "Media cancellation failed.");
    },
  };
}
