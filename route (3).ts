export async function runFlux(plan: any) {
  return [{ type: "image", url: "https://placehold.co/512x512" }];
}

export async function runRunway(plan: any) {
  return { type: "video", url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4" };
}
