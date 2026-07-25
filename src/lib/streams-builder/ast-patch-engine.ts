import { createHash } from "node:crypto";
import * as ts from "typescript";
import type { RepositoryGraph, RepositorySymbolNode } from "./repository-graph";

export interface AstPatchOperation {
  file: string;
  symbolId: string;
  symbolName: string;
  start: number;
  end: number;
  replacement: string;
  expectedBeforeHash: string;
}

export interface AstPatchPlan {
  id: string;
  file: string;
  operations: AstPatchOperation[];
  touchedLinesBefore: number;
  touchedLinesAfter: number;
  preservesImports: boolean;
  preservesExports: boolean;
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function scriptKind(path: string) {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
function lineSpan(value: string) { return value ? value.split(/\r?\n/).length : 0; }
function statementName(statement: ts.Statement) {
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) return statement.name && ts.isIdentifier(statement.name) ? statement.name.text : "";
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .map((declaration) => ts.isIdentifier(declaration.name) ? declaration.name.text : declaration.name.getText())
      .join(",");
  }
  return "";
}
function topLevelSignature(source: ts.SourceFile) {
  return source.statements.map((statement) => {
    if (ts.isImportDeclaration(statement)) return `import:${statement.moduleSpecifier.getText(source)}`;
    if (ts.isExportDeclaration(statement)) return `export:${statement.moduleSpecifier?.getText(source) ?? statement.exportClause?.getText(source) ?? ""}`;
    const name = statementName(statement);
    const exported = Boolean(ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
    return `${ts.SyntaxKind[statement.kind]}:${name}:${exported}`;
  });
}
function parse(file: string, sourceText: string) {
  return ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind(file));
}
function diagnostics(source: ts.SourceFile) {
  const parsed = source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] };
  return (parsed.parseDiagnostics ?? []).map((item: ts.Diagnostic) => ts.flattenDiagnosticMessageText(item.messageText, "\n"));
}
function locateSymbol(graph: RepositoryGraph, file: string, symbolName: string): RepositorySymbolNode {
  const matches = graph.symbols.filter((symbol) => symbol.file === file && symbol.name === symbolName);
  if (matches.length !== 1) throw new Error(`Expected exactly one symbol ${symbolName} in ${file}; found ${matches.length}.`);
  return matches[0]!;
}

export function createAstSymbolPatchPlan(input: {
  graph: RepositoryGraph;
  file: string;
  sourceText: string;
  symbolName: string;
  replacement: string;
  maxTouchedLines?: number;
}): AstPatchPlan {
  const symbol = locateSymbol(input.graph, input.file, input.symbolName);
  const before = input.sourceText.slice(symbol.start, symbol.end);
  const beforeSource = parse(input.file, input.sourceText);
  const beforeDiagnostics = diagnostics(beforeSource);
  if (beforeDiagnostics.length) throw new Error(`Source contains parse errors before patch: ${beforeDiagnostics.join("; ")}`);
  const result = `${input.sourceText.slice(0, symbol.start)}${input.replacement}${input.sourceText.slice(symbol.end)}`;
  const afterSource = parse(input.file, result);
  const afterDiagnostics = diagnostics(afterSource);
  if (afterDiagnostics.length) throw new Error(`Replacement introduces parse errors: ${afterDiagnostics.join("; ")}`);

  const beforeSignature = topLevelSignature(beforeSource);
  const afterSignature = topLevelSignature(afterSource);
  const preservesImports = beforeSignature.filter((item) => item.startsWith("import:")).join("\n") === afterSignature.filter((item) => item.startsWith("import:")).join("\n");
  const preservesExports = beforeSignature.filter((item) => item.startsWith("export:") || item.endsWith(":true")).join("\n") === afterSignature.filter((item) => item.startsWith("export:") || item.endsWith(":true")).join("\n");
  if (!preservesImports) throw new Error("Symbol patch changed imports outside the target symbol.");
  if (!preservesExports) throw new Error("Symbol patch changed the module export surface.");

  const touchedLinesBefore = lineSpan(before);
  const touchedLinesAfter = lineSpan(input.replacement);
  const maxTouchedLines = Math.max(1, input.maxTouchedLines ?? 200);
  if (Math.max(touchedLinesBefore, touchedLinesAfter) > maxTouchedLines) throw new Error(`Patch exceeds maximum touched-line budget (${maxTouchedLines}).`);

  const operation: AstPatchOperation = {
    file: input.file,
    symbolId: symbol.id,
    symbolName: symbol.name,
    start: symbol.start,
    end: symbol.end,
    replacement: input.replacement,
    expectedBeforeHash: hash(before),
  };
  return {
    id: hash(JSON.stringify(operation)),
    file: input.file,
    operations: [operation],
    touchedLinesBefore,
    touchedLinesAfter,
    preservesImports,
    preservesExports,
  };
}

export function applyAstPatchPlan(input: { plan: AstPatchPlan; sourceText: string }) {
  let result = input.sourceText;
  for (const operation of [...input.plan.operations].sort((a, b) => b.start - a.start)) {
    const before = result.slice(operation.start, operation.end);
    if (hash(before) !== operation.expectedBeforeHash) throw new Error(`Patch precondition failed for ${operation.symbolName}; source changed after planning.`);
    result = `${result.slice(0, operation.start)}${operation.replacement}${result.slice(operation.end)}`;
  }
  const parsed = parse(input.plan.file, result);
  const errors = diagnostics(parsed);
  if (errors.length) throw new Error(`Applied patch is not syntactically valid: ${errors.join("; ")}`);
  return result;
}
