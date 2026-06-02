export type ObjectMaskTarget = {
  id: string;
  label: string;
  objectId: string | null;
  maskAssetId: string | null;
  depthAssetId: string | null;
  frameStart: number | null;
  frameEnd: number | null;
  editReady: boolean;
  missing: string[];
};

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function buildObjectMaskData(input: { intelligence?: any }) {
  const root = input.intelligence?.intelligence || input.intelligence || {};
  const objects = asArray(root.objects || root.object_profiles || root.objectProfiles);
  const masks = asArray(root.masks || root.mask_assets || root.maskAssets);
  const depths = asArray(root.depth_maps || root.depthMaps || root.depth_assets);

  const targets: ObjectMaskTarget[] = objects.map((object, index) => {
    const objectId = String(object.id || object.objectId || `object-${index + 1}`);
    const mask = masks.find((item) => String(item.objectId || item.object_id || "") === objectId);
    const depth = depths.find((item) => String(item.objectId || item.object_id || "") === objectId);

    const missing = [
      mask ? null : "mask",
      depth ? null : "depth_map",
    ].filter(Boolean) as string[];

    return {
      id: `object-mask-${objectId}`,
      label: asString(object.label || object.name, `Object ${index + 1}`),
      objectId,
      maskAssetId: mask?.assetId || mask?.asset_id || mask?.id || null,
      depthAssetId: depth?.assetId || depth?.asset_id || depth?.id || null,
      frameStart: object.frameStart || object.frame_start || null,
      frameEnd: object.frameEnd || object.frame_end || null,
      editReady: missing.length === 0,
      missing,
    };
  });

  return {
    ok: true,
    status: targets.length ? "loaded" : "missing_object_data",
    targets,
  };
}
