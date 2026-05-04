export function buildPromptCacheParts(stable:string, variablePart:string){
  return {prompt_cache_key: `streams:v1:${stable.slice(0,48)}`, stablePrefix: stable, variableSuffix: variablePart};
}
