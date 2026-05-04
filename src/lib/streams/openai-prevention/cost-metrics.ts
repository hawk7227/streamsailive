export type CostMetrics = {totalRequests:number;callsSkipped:number;callsMade:number;cachedTokens:number;promptTokens:number;completionTokens:number};
export function updateCostMetrics(base:CostMetrics, next:{skipped?:boolean;prompt?:number;completion?:number;cached?:number}){
 return {...base,totalRequests:base.totalRequests+1,callsSkipped:base.callsSkipped+(next.skipped?1:0),callsMade:base.callsMade+(next.skipped?0:1),promptTokens:base.promptTokens+(next.prompt??0),completionTokens:base.completionTokens+(next.completion??0),cachedTokens:base.cachedTokens+(next.cached??0)};
}
