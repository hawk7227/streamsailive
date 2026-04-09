  id: string;
  label: string;
  prompt: string;
  count: number;
  width?: number;
  height?: number;
};

export type BulkAssetType = "image" | "video" | "audio";

export type BulkAsset = {
  id: string;
  jobId: string;
  type: BulkAssetType;
  title: string;
  url: string;
  status: "ready" | "failed" | "processing";
  prompt: string;
  width?: number;
  height?: number;
};
