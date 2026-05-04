export function decideBatchRouting(intent:string, domain:string){
 const live = ['normal_chat','build','debug','patch','editor','media'].includes(intent);
 if (live) return {batchEligible:false,reason:'interactive_request',providerSupport:'openai|anthropic',expectedDelay:'n/a',costBenefit:'none',fallbackLiveMode:true};
 const eligibleDomains=['repo_indexing','repo_summaries','lint_error_clustering','artifact_metadata_summaries','async_prompt_compilation'];
 const batchEligible=eligibleDomains.includes(domain);
 return {batchEligible,reason:batchEligible?'async_non_interactive':'not_batch_candidate',providerSupport:'openai|anthropic',expectedDelay:batchEligible?'minutes':'n/a',costBenefit:batchEligible?'potential':'none',fallbackLiveMode:true,blockedCapability:batchEligible?'No async batch queue/dispatch worker is configured.':undefined};
}
