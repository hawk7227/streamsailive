import type { ProductIntent } from './contracts';
export type RuntimeTool = 'conversation.read'|'operation.read'|'project.create'|'files.write'|'build.run'|'preview.create'|'preview.open'|'web.search'|'operation.cancel'|'checkpoint.restore';
const allow: Record<ProductIntent, readonly RuntimeTool[]> = {
 GENERAL_CHAT: ['conversation.read'], CREATE_WEBSITE: ['conversation.read','project.create','files.write','build.run','preview.create','preview.open'],
 EDIT_WEBSITE: ['conversation.read','operation.read','files.write','build.run','preview.create','preview.open','checkpoint.restore'],
 OPEN_PREVIEW: ['operation.read','preview.open'], OPEN_WORKSPACE: ['operation.read'], EXPLAIN_FAILURE: ['operation.read'],
 RETRY_LAST_OPERATION: ['operation.read','checkpoint.restore','files.write','build.run','preview.create','preview.open'], CANCEL_OPERATION: ['operation.read','operation.cancel'],
};
export function allowedTools(intent: ProductIntent) { return [...allow[intent]]; }
export function assertToolAllowed(intent: ProductIntent, tool: RuntimeTool) { if (!allow[intent].includes(tool)) throw new Error(`TOOL_NOT_ALLOWED:${intent}:${tool}`); }
