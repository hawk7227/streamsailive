import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

/**
 * GET /api/visual-editor/files
 * Query params:
 *   - action: 'tree' (default) | 'read'
 *   - path: file/folder path (required for 'read')
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'tree';
  const filePath = searchParams.get('path');

  try {
    if (action === 'read' && filePath) {
      // Read single file
      const fullPath = path.join(SRC_DIR, filePath);

      // Security: prevent directory traversal
      if (!fullPath.startsWith(SRC_DIR)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const stat = await fs.stat(fullPath);

      return NextResponse.json({
        path: filePath,
        name: path.basename(filePath),
        content,
        language: getLanguage(filePath),
        lastModified: stat.mtime.toISOString(),
        size: stat.size,
      });
    } else if (action === 'tree') {
      // Get file tree
      const tree = await buildFileTree(SRC_DIR, 'src', 0, 3); // Max 3 levels deep
      return NextResponse.json({ tree });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('File read error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'File read failed' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/visual-editor/files
 * Update file content
 * Body: { path: string, content: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: filePath, content } = body;

    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: 'Missing path or content' },
        { status: 400 }
      );
    }

    const fullPath = path.join(SRC_DIR, filePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(SRC_DIR)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');

    const stat = await fs.stat(fullPath);

    return NextResponse.json({
      path: filePath,
      name: path.basename(filePath),
      lastModified: stat.mtime.toISOString(),
      size: stat.size,
    });
  } catch (error) {
    console.error('File write error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'File write failed' },
      { status: 500 }
    );
  }
}

/**
 * Recursively build file tree
 */
async function buildFileTree(
  dir: string,
  displayName: string,
  level: number,
  maxLevels: number
): Promise<any[]> {
  // Skip if max depth reached
  if (level >= maxLevels) {
    return [];
  }

  // Skip certain folders
  const skipFolders = [
    'node_modules',
    '.next',
    '.git',
    '__tests__',
    '.vercel',
    'dist',
    'build',
  ];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipFolders.includes(entry.name)) continue;

      const children = await buildFileTree(
        path.join(dir, entry.name),
        entry.name,
        level + 1,
        maxLevels
      );

      nodes.push({
        name: entry.name,
        type: 'folder',
        path: path.relative(SRC_DIR, path.join(dir, entry.name)),
        children: children.sort((a, b) => {
          // Folders first, then files
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
        isOpen: level < 1, // Open first level by default
      });
    } else {
      // Skip certain file types
      if (!['.tsx', '.ts', '.css', '.json', '.md'].some(ext => entry.name.endsWith(ext))) {
        continue;
      }

      nodes.push({
        name: entry.name,
        type: 'file',
        path: path.relative(SRC_DIR, path.join(dir, entry.name)),
      });
    }
  }

  return nodes.sort((a, b) => {
    // Folders first, then files
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function getLanguage(filePath: string): string {
  if (filePath.endsWith('.tsx')) return 'typescript';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.jsx')) return 'javascript';
  if (filePath.endsWith('.js')) return 'javascript';
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.md')) return 'markdown';
  return 'plaintext';
}
