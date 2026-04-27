'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  isOpen?: boolean;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export default function VisualEditorPage() {
  // File management
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  
  // Panel visibility - LEFT and CENTER closed by default, RIGHT always visible
  const [showFileTree, setShowFileTree] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load file tree on mount
  useEffect(() => {
    const loadTree = async () => {
      try {
        const res = await fetch('/api/visual-editor/files?action=tree');
        const data = await res.json();
        setFileTree(data.tree || []);
      } catch (error) {
        console.error('Failed to load file tree:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTree();
  }, []);

  // Load file when clicked
  const loadFile = useCallback(async (filePath: string) => {
    const existing = openFiles.find(f => f.path === filePath);
    if (existing) {
      setActiveFile(filePath);
      return;
    }

    try {
      const res = await fetch(`/api/visual-editor/files?action=read&path=${encodeURIComponent(filePath)}`);
      const data = await res.json();

      setOpenFiles(prev => [...prev, {
        path: filePath,
        name: data.name,
        content: data.content,
        isDirty: false,
        language: data.language,
      }]);

      setActiveFile(filePath);
    } catch (error) {
      console.error('Failed to load file:', error);
      alert('Failed to load file');
    }
  }, [openFiles]);

  // Save current file
  const saveFile = useCallback(async () => {
    const file = openFiles.find(f => f.path === activeFile);
    if (!file) return;

    setSaveStatus('saving');

    try {
      const res = await fetch('/api/visual-editor/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          content: file.content,
        }),
      });

      if (res.ok) {
        setSaveStatus('saved');
        setOpenFiles(prev =>
          prev.map(f =>
            f.path === activeFile ? { ...f, isDirty: false } : f
          )
        );
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveStatus('error');
    }
  }, [activeFile, openFiles]);

  // Auto-save on change
  useEffect(() => {
    const timer = setTimeout(() => {
      const file = openFiles.find(f => f.path === activeFile);
      if (file?.isDirty) {
        saveFile();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [activeFile, openFiles, saveFile]);

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;

    setOpenFiles(prev =>
      prev.map(f =>
        f.path === activeFile ? { ...f, content: newContent, isDirty: true } : f
      )
    );

    setSaveStatus('idle');
  };

  // Close file tab
  const closeFile = (filePath: string) => {
    const newFiles = openFiles.filter(f => f.path !== filePath);
    setOpenFiles(newFiles);

    if (activeFile === filePath) {
      setActiveFile(newFiles.length > 0 ? newFiles[0].path : null);
    }
  };

  // Toggle folder
  const toggleFolder = (path: string) => {
    const updateTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.path === path && node.type === 'folder') {
          return { ...node, isOpen: !node.isOpen };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    setFileTree(updateTree(fileTree));
  };

  // Render file tree
  const renderTree = (nodes: FileNode[], level = 0) => {
    return (
      <div>
        {nodes.map(node => (
          <div key={node.path}>
            <div
              className="file-tree-item"
              style={{
                paddingLeft: `${level * 12 + 8}px`,
                backgroundColor: activeFile === node.path && node.type === 'file' ? 'var(--color-background-tertiary)' : 'transparent',
              }}
            >
              {node.type === 'folder' ? (
                <button
                  className="tree-button folder-button"
                  onClick={() => toggleFolder(node.path)}
                >
                  {node.isOpen ? '📂' : '📁'} {node.name}
                </button>
              ) : (
                <button
                  className="tree-button file-button"
                  onClick={() => loadFile(node.path)}
                >
                  {getIcon(node.name)} {node.name}
                </button>
              )}
            </div>
            {node.isOpen && node.children && renderTree(node.children, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  const activeFileData = openFiles.find(f => f.path === activeFile);

  return (
    <div className="visual-editor">
      <style jsx>{`
        .visual-editor {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--color-background-primary);
          color: var(--color-text-primary);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-border-tertiary);
          background: var(--color-background-secondary);
          gap: 12px;
        }

        .editor-title {
          font-weight: 500;
          font-size: 14px;
          flex: 1;
        }

        .editor-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn {
          padding: 6px 12px;
          border: 0.5px solid var(--color-border-secondary);
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          transition: all 150ms ease;
        }

        .btn:hover {
          background: var(--color-background-tertiary);
        }

        .btn.primary {
          background: var(--color-text-info);
          color: white;
          border-color: var(--color-text-info);
        }

        .btn.primary:hover {
          opacity: 0.9;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .save-indicator {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          min-width: 50px;
          text-align: center;
        }

        .save-indicator.saving {
          background: var(--color-background-warning);
          color: var(--color-text-warning);
        }

        .save-indicator.saved {
          background: var(--color-background-success);
          color: var(--color-text-success);
        }

        .save-indicator.error {
          background: var(--color-background-danger);
          color: var(--color-text-danger);
        }

        .editor-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          gap: 1px;
          background: var(--color-border-tertiary);
        }

        /* LEFT PANEL - File tree (collapsible, closed by default) */
        .sidebar {
          flex: 0 0 220px;
          background: var(--color-background-secondary);
          border-right: 1px solid var(--color-border-tertiary);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          transition: all 200ms ease;
        }

        .sidebar.collapsed {
          flex: 0 0 0;
          border-right: none;
          overflow: hidden;
        }

        .sidebar-title {
          padding: 12px 8px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
          position: sticky;
          top: 0;
          background: var(--color-background-secondary);
          border-bottom: 1px solid var(--color-border-tertiary);
          flex-shrink: 0;
        }

        .file-tree {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .file-tree-item {
          display: flex;
          align-items: center;
          padding: 0;
          transition: background 150ms ease;
        }

        .tree-button {
          flex: 1;
          padding: 6px 8px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          font-size: 12px;
          color: var(--color-text-secondary);
          transition: all 150ms ease;
          font-family: inherit;
        }

        .tree-button:hover {
          background: var(--color-background-tertiary);
          color: var(--color-text-primary);
        }

        .file-button:hover {
          color: var(--color-text-info);
        }

        /* CENTER PANEL - Code editor (collapsible, closed by default) */
        .editor-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--color-background-primary);
          transition: all 200ms ease;
        }

        .editor-main.collapsed {
          flex: 0 0 0;
          border-right: none;
          overflow: hidden;
        }

        .tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--color-border-tertiary);
          background: var(--color-background-secondary);
          overflow-x: auto;
          padding: 0 8px;
        }

        .tab {
          padding: 10px 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 12px;
          color: var(--color-text-secondary);
          border-bottom: 2px solid transparent;
          transition: all 150ms ease;
          white-space: nowrap;
          position: relative;
        }

        .tab.active {
          color: var(--color-text-primary);
          border-bottom-color: var(--color-text-info);
          font-weight: 500;
        }

        .tab:hover {
          color: var(--color-text-primary);
        }

        .tab-close {
          margin-left: 8px;
          padding: 0 4px;
          color: var(--color-text-tertiary);
        }

        .tab-close:hover {
          color: var(--color-text-danger);
        }

        .code-area {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .code-editor {
          flex: 1;
          padding: 16px;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
          border: none;
          background: var(--color-background-primary);
          color: var(--color-text-primary);
          resize: none;
          overflow-y: auto;
          tab-size: 2;
        }

        .code-editor::selection {
          background: var(--color-background-info);
          color: white;
        }

        .editor-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: var(--color-text-secondary);
          font-size: 14px;
        }

        .file-info {
          padding: 8px 16px;
          font-size: 11px;
          color: var(--color-text-tertiary);
          border-top: 1px solid var(--color-border-tertiary);
          background: var(--color-background-secondary);
        }

        /* RIGHT PANEL - Live preview (always visible) */
        .mobile-preview {
          flex: 0 0 450px;
          background: #1a1a1a;
          padding: 16px;
          overflow: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border-left: 1px solid var(--color-border-tertiary);
        }

        .iphone-frame {
          width: 402px;
          height: 874px;
          background: black;
          border-radius: 55px;
          padding: 16px 8px;
          box-shadow: 0 0 60px rgba(0, 0, 0, 0.8), inset 0 0 0 12px #1a1a1a;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .iphone-notch {
          height: 30px;
          background: black;
          border-radius: 0 0 30px 30px;
          margin: 0 auto 8px;
          width: 160px;
          flex-shrink: 0;
          z-index: 10;
        }

        .iphone-content {
          flex: 1;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .iphone-status-bar {
          height: 28px;
          background: #f5f5f5;
          border-bottom: 0.5px solid #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          font-size: 11px;
          color: #666;
          flex-shrink: 0;
        }

        .iphone-viewport {
          flex: 1;
          overflow: auto;
          background: white;
        }

        .iphone-viewport-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: #999;
          font-size: 12px;
          text-align: center;
        }

        .iphone-viewport iframe {
          width: 100%;
          height: 100%;
          border: none;
        }

        .iphone-home-indicator {
          height: 24px;
          background: black;
          border-radius: 2px;
          margin: 8px auto 0;
          width: 120px;
          flex-shrink: 0;
        }

        .panel-toggle {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        @media (max-width: 768px) {
          .mobile-preview {
            display: none;
          }
          .sidebar {
            flex: 0 0 160px;
          }
          .sidebar.collapsed {
            flex: 0 0 40px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="editor-header">
        <div className="editor-title">
          Visual Component Editor
        </div>
        <div className="editor-controls">
          <div className="panel-toggle">
            <button
              className={`btn ${showFileTree ? 'primary' : ''}`}
              onClick={() => setShowFileTree(!showFileTree)}
              title={showFileTree ? 'Hide files' : 'Show files'}
            >
              📁 Files
            </button>
            <button
              className={`btn ${showCodeEditor ? 'primary' : ''}`}
              onClick={() => setShowCodeEditor(!showCodeEditor)}
              title={showCodeEditor ? 'Hide code' : 'Show code'}
            >
              &lt;&gt; Code
            </button>
          </div>
          <button
            className="btn primary"
            onClick={saveFile}
            disabled={!activeFileData?.isDirty || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
          {saveStatus !== 'idle' && (
            <div className={`save-indicator ${saveStatus}`}>
              {saveStatus === 'saving' && '⏳'}
              {saveStatus === 'saved' && '✓'}
              {saveStatus === 'error' && '✕'}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="editor-body">
        {/* LEFT: File tree (collapsible, closed by default) */}
        <div className={`sidebar ${!showFileTree ? 'collapsed' : ''}`}>
          <div className="sidebar-title">📁 Files</div>
          <div className="file-tree">
            {loading ? (
              <div style={{ padding: '16px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                Loading...
              </div>
            ) : fileTree.length > 0 ? (
              renderTree(fileTree)
            ) : (
              <div style={{ padding: '16px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                No files
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Code editor (collapsible, closed by default) */}
        {(showCodeEditor || false) && (
          <div className={`editor-main ${!showCodeEditor ? 'collapsed' : ''}`}>
            {/* Tabs */}
            {openFiles.length > 0 && (
              <div className="tabs">
                {openFiles.map(file => (
                  <div
                    key={file.path}
                    className={`tab ${activeFile === file.path ? 'active' : ''}`}
                    onClick={() => setActiveFile(file.path)}
                  >
                    {file.isDirty ? '●' : ' '} {file.name}
                    <button
                      className="tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeFile(file.path);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Code area */}
            {activeFileData ? (
              <>
                <div className="code-area">
                  <textarea
                    ref={editorRef}
                    className="code-editor"
                    value={activeFileData.content}
                    onChange={handleContentChange}
                    spellCheck="false"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>
                <div className="file-info">
                  {activeFileData.path} • {activeFileData.content.length} bytes
                </div>
              </>
            ) : (
              <div className="editor-empty">
                Select a file to edit
              </div>
            )}
          </div>
        )}

        {/* RIGHT: Live iPhone preview (always visible) */}
        <div className="mobile-preview">
          <div className="iphone-frame">
            <div className="iphone-notch"></div>
            <div className="iphone-content">
              <div className="iphone-status-bar">
                <span>9:41</span>
                <span>●●●●●</span>
              </div>
              <div className="iphone-viewport">
                <iframe
                  ref={iframeRef}
                  src="/"
                  title="Mobile preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </div>
            </div>
            <div className="iphone-home-indicator"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getIcon(name: string): string {
  if (name.endsWith('.tsx')) return '⚛️';
  if (name.endsWith('.ts')) return '📘';
  if (name.endsWith('.jsx')) return '⚛️';
  if (name.endsWith('.js')) return '📕';
  if (name.endsWith('.css')) return '🎨';
  if (name.endsWith('.json')) return '{ }';
  if (name.endsWith('.md')) return '📄';
  return '📄';
}
