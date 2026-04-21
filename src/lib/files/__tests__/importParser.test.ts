/**
 * src/lib/files/__tests__/importParser.test.ts
 *
 * Tests for the import path parser — pure function, no DB, no network.
 */

import { describe, it, expect } from "vitest";
import { parseImportPaths } from "../importParser";

// ── TypeScript / JavaScript ───────────────────────────────────────────────────

describe("TypeScript / JavaScript imports", () => {
  it("named import from relative path → basename returned", () => {
    const result = parseImportPaths(`import { User } from "./types"`, "auth.ts");
    expect(result).toContain("types");
  });

  it("default import from relative path", () => {
    const result = parseImportPaths(`import config from "./config"`, "server.ts");
    expect(result).toContain("config");
  });

  it("namespace import from relative path", () => {
    const result = parseImportPaths(`import * as utils from "./utils"`, "index.ts");
    expect(result).toContain("utils");
  });

  it("type import from relative path", () => {
    const result = parseImportPaths(`import type { Session } from "./session"`, "auth.ts");
    expect(result).toContain("session");
  });

  it("side-effect import", () => {
    const result = parseImportPaths(`import "./polyfills"`, "main.ts");
    expect(result).toContain("polyfills");
  });

  it("export from relative path", () => {
    const result = parseImportPaths(`export { handler } from "./handler"`, "index.ts");
    expect(result).toContain("handler");
  });

  it("export * from relative path", () => {
    const result = parseImportPaths(`export * from "../shared"`, "index.ts");
    expect(result).toContain("shared");
  });

  it("require() call", () => {
    const result = parseImportPaths(`const utils = require("./utils")`, "server.js");
    expect(result).toContain("utils");
  });

  it("parent directory import (../)", () => {
    const result = parseImportPaths(`import { db } from "../lib/database"`, "routes.ts");
    expect(result).toContain("database");
  });

  it("multi-level parent import", () => {
    const result = parseImportPaths(`import { foo } from "../../core/types"`, "deep.ts");
    expect(result).toContain("types");
  });

  it("single quotes", () => {
    const result = parseImportPaths(`import { x } from './types'`, "auth.ts");
    expect(result).toContain("types");
  });

  it("import with file extension stripped", () => {
    const result = parseImportPaths(`import { x } from "./types.js"`, "auth.ts");
    expect(result).toContain("types");
  });

  it("multiple imports → all basenames returned", () => {
    const text = `
      import { User } from "./types"
      import { db } from "./database"
      import { logger } from "../lib/logger"
    `;
    const result = parseImportPaths(text, "server.ts");
    expect(result).toContain("types");
    expect(result).toContain("database");
    expect(result).toContain("logger");
  });

  it("deduplicated — same file imported twice", () => {
    const text = `
      import { User } from "./types"
      import type { Session } from "./types"
    `;
    const result = parseImportPaths(text, "auth.ts");
    expect(result.filter((r) => r === "types")).toHaveLength(1);
  });
});

// ── External / non-relative imports — must NOT be returned ───────────────────

describe("External imports — must NOT appear in results", () => {
  const externalCases: [string, string][] = [
    [`import React from "react"`, "app.tsx"],
    [`import { NextResponse } from "next/server"`, "route.ts"],
    [`import { createClient } from "@supabase/supabase-js"`, "db.ts"],
    [`import { z } from "@/lib/zod"`, "schema.ts"],
    [`import path from "node:path"`, "server.ts"],
    [`import fs from "fs"`, "server.ts"],
  ];

  it.each(externalCases)("'%s' → no results", (text, fileName) => {
    expect(parseImportPaths(text, fileName)).toHaveLength(0);
  });
});

// ── Python imports ────────────────────────────────────────────────────────────

describe("Python relative imports", () => {
  it("from .module import name", () => {
    const result = parseImportPaths(`from .types import User`, "auth.py");
    expect(result).toContain("types");
  });

  it("from ..module import name (parent directory)", () => {
    const result = parseImportPaths(`from ..utils import helper`, "service.py");
    expect(result).toContain("utils");
  });

  it("Python absolute import → not returned", () => {
    const result = parseImportPaths(`from os import path`, "server.py");
    expect(result).toHaveLength(0);
  });
});

// ── Non-code files → empty ────────────────────────────────────────────────────

describe("Non-code files — always empty", () => {
  const cases: [string, string][] = [
    [`import stuff from "./types"`, "README.md"],
    [`import stuff from "./types"`, "data.json"],
    [`import stuff from "./types"`, "styles.css"],
    [`import stuff from "./types"`, "document.pdf"],
  ];

  it.each(cases)("'%s' in '%s' → empty", (text, fileName) => {
    expect(parseImportPaths(text, fileName)).toHaveLength(0);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("empty text → empty", () => {
    expect(parseImportPaths("", "auth.ts")).toHaveLength(0);
  });

  it("no imports in code file → empty", () => {
    expect(parseImportPaths("const x = 1;", "math.ts")).toHaveLength(0);
  });

  it("result is an array of strings", () => {
    const result = parseImportPaths(`import { x } from "./foo"`, "index.ts");
    expect(Array.isArray(result)).toBe(true);
    result.forEach((r) => expect(typeof r).toBe("string"));
  });
});
