import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Search, 
  Trash2, 
  Tag, 
  Clock, 
  FilePlus, 
  FolderPlus,
  Hash
} from 'lucide-react';
import type { VaultFileMeta } from '../types';
import { formatTimeAgo, formatBytes } from '../utils/helpers';

interface VaultExplorerProps {
  files: VaultFileMeta[];
  allTags: string[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  fileMeta?: VaultFileMeta;
  children: Record<string, TreeNode>;
}

export const VaultExplorer: React.FC<VaultExplorerProps> = ({
  files,
  allTags,
  selectedFilePath,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  selectedTag,
  onSelectTag,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [newFileInputOpen, setNewFileInputOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);

  // Toggle folder open/close
  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  // Filter files by search and tag
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      if (f.isFolder) return false;
      const matchesSearch = searchQuery === '' || 
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.path.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTag = !selectedTag || (f.tags && f.tags.includes(selectedTag));
      return matchesSearch && matchesTag;
    });
  }, [files, searchQuery, selectedTag]);

  // Build hierarchical folder tree
  const treeRoot = useMemo(() => {
    const root: TreeNode = { name: '', path: '', isFolder: true, children: {} };

    for (const f of files) {
      if (f.isFolder) continue;
      // If filtering active, check if filteredFiles includes it
      if ((searchQuery || selectedTag) && !filteredFiles.some(ff => ff.path === f.path)) {
        continue;
      }

      const parts = f.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isFolder: !isLast,
            fileMeta: isLast ? f : undefined,
            children: {},
          };
        }
        current = current.children[part];
      }
    }

    return root;
  }, [files, filteredFiles, searchQuery, selectedTag]);

  const handleCreateNewNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    let clean = newFileName.trim();
    if (!clean.endsWith('.md')) clean += '.md';
    onCreateFile(clean);
    setNewFileName('');
    setNewFileInputOpen(false);
  };

  // Recursive tree renderer
  const renderTree = (node: TreeNode, depth = 0) => {
    const entries = Object.values(node.children).sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });

    return entries.map((child) => {
      if (child.isFolder) {
        const isCollapsed = collapsedFolders[child.path] || false;
        return (
          <div key={child.path} className="select-none">
            <div
              onClick={(e) => toggleFolder(child.path, e)}
              style={{ paddingLeft: `${depth * 12 + 10}px` }}
              className="py-1.5 pr-2 flex items-center gap-1.5 text-zinc-300 hover:text-white hover:bg-[#1a1a24] rounded-md text-xs cursor-pointer transition-colors group"
            >
              <span className="text-zinc-500 group-hover:text-zinc-300">
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
              {isCollapsed ? (
                <Folder className="w-3.5 h-3.5 text-[#9b8afb]/70" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5 text-[#9b8afb]" />
              )}
              <span className="font-medium truncate">{child.name}</span>
            </div>

            {!isCollapsed && (
              <div className="border-l border-zinc-800/60 ml-3">
                {renderTree(child, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // File Node
      const isSelected = selectedFilePath === child.path;
      return (
        <div
          key={child.path}
          onClick={() => onSelectFile(child.path)}
          style={{ paddingLeft: `${depth * 12 + 10}px` }}
          className={`py-1.5 pr-2 flex items-center justify-between group rounded-md text-xs cursor-pointer transition-colors ${
            isSelected
              ? 'bg-[#705df2]/20 text-white font-medium border-l-2 border-[#705df2]'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181822]'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#a594fd]' : 'text-zinc-500'}`} />
            <span className="truncate">{child.name.replace(/\.md$/, '')}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {pendingDeletePath === child.path ? (
              <div className="flex items-center gap-1 bg-[#251518] px-1.5 py-0.5 rounded border border-rose-500/30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(child.path);
                    setPendingDeletePath(null);
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  Delete?
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDeletePath(null);
                  }}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDeletePath(child.path);
                }}
                title="Delete Note"
                className="p-1 hover:text-red-400 text-zinc-500 rounded transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="w-64 border-r border-[#22222e] bg-[#121217] flex flex-col h-full shrink-0 select-none">
      {/* Search Bar */}
      <div className="p-3 border-b border-[#20202c]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search notes or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#171720] border border-[#272736] focus:border-[#705df2] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Add Toolbar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1c1c26]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Files ({files.filter(f => !f.isFolder).length})
          </span>
          <button
            onClick={() => setNewFileInputOpen(true)}
            className="p-1 rounded hover:bg-[#1f1f2b] text-zinc-400 hover:text-[#a594fd] transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            title="Create New Note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>

        {newFileInputOpen && (
          <form onSubmit={handleCreateNewNote} className="mt-2 flex gap-1">
            <input
              type="text"
              autoFocus
              placeholder="Note title..."
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full bg-[#1b1b26] border border-[#705df2] rounded px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-[#705df2] hover:bg-[#5f4de0] text-white rounded text-xs cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setNewFileInputOpen(false);
                setNewFileName('');
              }}
              className="px-1.5 py-1 text-zinc-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {/* Tags Filter Pill Strip */}
      {allTags.length > 0 && (
        <div className="px-3 py-2 border-b border-[#20202c] overflow-x-auto flex gap-1.5 scrollbar-none">
          <button
            onClick={() => onSelectTag(null)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer shrink-0 transition-colors ${
              selectedTag === null
                ? 'bg-[#705df2] text-white'
                : 'bg-[#181822] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            all
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer shrink-0 flex items-center gap-1 transition-colors ${
                selectedTag === tag
                  ? 'bg-[#705df2] text-white'
                  : 'bg-[#181822] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Hash className="w-2.5 h-2.5 opacity-60" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {files.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">
            No notes yet. Create a note or connect Obsidian to sync.
          </div>
        ) : Object.keys(treeRoot.children).length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">
            No matching notes found.
          </div>
        ) : (
          renderTree(treeRoot)
        )}
      </div>
    </div>
  );
};
