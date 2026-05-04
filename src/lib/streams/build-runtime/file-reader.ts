import { promises as fs } from "node:fs";
export async function readWorkspaceFile(path: string) { return fs.readFile(path, "utf8"); }
