export function createUploadItem(file, index = 0) {
  return {
    id: `upload_${Date.now()}_${index}`,
    file,
    name: file?.name || "file",
    sizeBytes: Number(file?.size || 0),
    status: "queued",
    progress: 0,
    storagePath: "",
    storageUrl: "",
    error: "",
  };
}

export function createUploadQueue(files = []) {
  return Array.from(files || []).map((file, index) => createUploadItem(file, index));
}

export function updateUploadItem(queue, id, patch) {
  return queue.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export async function runUploadItem(item, uploader, onUpdate) {
  if (typeof uploader !== "function") {
    throw new Error("A storage uploader function is required.");
  }

  onUpdate?.({ ...item, status: "uploading", progress: 0 });

  const result = await uploader(item.file, {
    onProgress(progress) {
      onUpdate?.({ ...item, status: "uploading", progress });
    },
  });

  const completed = {
    ...item,
    status: "uploaded",
    progress: 100,
    storagePath: result?.storagePath || "",
    storageUrl: result?.storageUrl || "",
  };

  onUpdate?.(completed);
  return completed;
}
