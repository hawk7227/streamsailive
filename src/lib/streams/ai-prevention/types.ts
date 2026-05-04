export type ProviderName = "openai" | "anthropic" | "future";
export type RequestIntent = "normal_chat"|"build"|"debug"|"patch"|"media"|"editor"|"file_analysis"|"repo_status"|"proof_status"|"tool_action"|"unknown";
export type Classification = "Proven"|"Implemented but unproven"|"Blocked"|"Rejected";
export type PreCallDecision = {shouldCallModel:boolean;providerCandidate:ProviderName;reason:string;cacheEligible:boolean;responseCacheEligible:boolean;toolFirstEligible:boolean;batchEligible:boolean;requiresFreshContext:boolean;requiresBuildMode:boolean;maxInputContextTokens:number;maxOutputTokens:number};
export type ContextPacket = {activeSlice:string;mergePolicy:string;allowedFiles:string[];forbiddenFiles:string[];proofRequirements:string[];sourceExcerpts:Array<{path:string;excerpt:string}>};
