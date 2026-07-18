import { resolveElementSourceMapping, type ElementSourceMappingInput } from "./element-source-mapping";

export function resolveMappedComponentNode(input: ElementSourceMappingInput) {
  const mapping = resolveElementSourceMapping(input);
  return {
    ...mapping,
    resolved: mapping.sourceStartLine > 0 && mapping.sourceEndLine >= mapping.sourceStartLine,
    fallbackRequired: mapping.strategy === "unresolved" || mapping.confidence < 0.7,
  };
}
