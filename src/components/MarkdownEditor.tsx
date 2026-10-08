import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Save, 
  History, 
  AlertTriangle, 
  Eye, 
  Code, 
  Columns, 
  Check, 
  Copy, 
  ArrowUpRight, 
  Hash, 
  Link as LinkIcon, 
  FileText, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import type { VaultFileMeta } from '../types';
import { formatTimeAgo } from '../utils/helpers';

interface MarkdownEditorProps {
  filePath: string;
  initialContent: string;
  mtime: number;
  files: VaultFileMeta[];
  onSave: (content: string) => Promise<void>;
  onNavigateToNote: (noteName: string) => void;
  onOpenHistory: () => void;
  onSimulateConflict: () => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  filePath,
  initialContent,
  mtime,
  files,
  onSave,
  onNavigateToNote,
  onOpenHistory,
  onSimulateConflict,
}) => {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'split'>('preview');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if initialContent changes externally (e.g. from sync)
  useEffect(() => {
    setContent(initialContent);
    setSaveStatus('saved');
  }, [initialContent, filePath]);

  // Handle content edits with debounced auto-save
  const handleContentChange = (newVal: string) => {
    setContent(newVal);
    setSaveStatus('dirty');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await onSave(newVal);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('dirty');
      }
    }, 1000);
  };

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    try {
      await onSave(content);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('dirty');
    }
  };

  // Find Backlinks: files whose content links to this current note
  const currentBaseName = filePath.replace(/\.md$/, '').split('/').pop() || '';
  const backlinks = useMemo(() => {
    return files.filter(f => {
      if (f.path === filePath || !f.links) return false;
      return f.links.some(l => {
        const cleanLink = l.replace(/\.md$/, '').split('/').pop();
        return cleanLink?.toLowerCase() === currentBaseName.toLowerCase();
      });
    });
  }, [files, filePath, currentBaseName]);

  // Word and character counts
  const wordCount = useMemo(() => {
    const text = content.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [content]);

  // Interactive Task Checkbox Click Handler
  const handleToggleTask = (lineIndex: number) => {
    const lines = content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    const line = lines[lineIndex];

    if (line.includes('- [ ]')) {
      lines[lineIndex] = line.replace('- [ ]', '- [x]');
    } else if (line.includes('- [x]')) {
      lines[lineIndex] = line.replace('- [x]', '- [ ]');
    } else if (line.includes('- [X]')) {
      lines[lineIndex] = line.replace('- [X]', '- [ ]');
    }

    const updated = lines.join('\n');
    handleContentChange(updated);
  };

  // Render Markdown to Interactive Obsidian AST/HTML Elements
  const renderMarkdown = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let codeLang = '';

    const parseInline = (text: string) => {
      // Split by wikilinks [[Target]] or [[Target|Alias]], bold **bold**, tags #tag, code `inline`
      const tokens: React.ReactNode[] = [];
      let remaining = text;
      let tokenIndex = 0;

      while (remaining.length > 0) {
        // 1. Check for wikilink [[Target]] or [[Target|Alias]]
        const wikiMatch = remaining.match(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/);
        // 2. Check for tag #tag
        const tagMatch = remaining.match(/(?:^|\s)(#([a-zA-Z0-9_\-\/]+))/);
        // 3. Inline code `code`
        const codeMatch = remaining.match(/`([^`]+)`/);
        // 4. Bold **text**
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

        // Find earliest match
        const matches = [
          { type: 'wiki', match: wikiMatch },
          { type: 'tag', match: tagMatch },
          { type: 'code', match: codeMatch },
          { type: 'bold', match: boldMatch },
        ]
          .filter(m => m.match && m.match.index !== undefined)
          .sort((a, b) => (a.match!.index || 0) - (b.match!.index || 0));

        if (matches.length === 0) {
          tokens.push(<span key={tokenIndex++}>{remaining}</span>);
          break;
        }

        const earliest = matches[0];
        const m = earliest.match!;
        const index = m.index || 0;

        if (index > 0) {
          tokens.push(<span key={tokenIndex++}>{remaining.slice(0, index)}</span>);
        }

        if (earliest.type === 'wiki') {
          const target = m[1].trim();
          const label = m[2]?.trim() || target;
          tokens.push(
            <button
              key={tokenIndex++}
              onClick={() => onNavigateToNote(target)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#705df2]/15 hover:bg-[#705df2]/30 text-[#a594fd] font-medium text-xs border border-[#705df2]/30 cursor-pointer transition-colors mx-0.5"
              title={`Jump to note: ${target}`}
            >
              <LinkIcon className="w-2.5 h-2.5 opacity-70" />
              <span>{label}</span>
            </button>
          );
        } else if (earliest.type === 'tag') {
          const fullTag = m[1].trim();
          tokens.push(
            <span
              key={tokenIndex++}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-900/30 text-purple-300 text-[11px] font-mono border border-purple-800/40 mx-0.5 font-medium"
            >
              {fullTag}
            </span>
          );
        } else if (earliest.type === 'code') {
          tokens.push(
            <code
              key={tokenIndex++}
              className="px-1.5 py-0.5 rounded bg-[#1f1f2a] text-[#f472b6] font-mono text-[11px] border border-[#2b2b3a]"
            >
              {m[1]}
            </code>
          );
        } else if (earliest.type === 'bold') {
          tokens.push(
            <strong key={tokenIndex++} className="font-bold text-white">
              {m[1]}
            </strong>
          );
        }

        remaining = remaining.slice(index + m[0].length);
      }

      return tokens;
    };

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];

      // Code Block Start/End
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLang = line.slice(3).trim();
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          const codeText = codeBuffer.join('\n');
          elements.push(
            <div key={`code-${idx}`} className="my-3 rounded-lg overflow-hidden border border-[#2e2e3e] bg-[#101015]">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#171720] border-b border-[#252533] text-[11px] text-zinc-400 font-mono">
                <span>{codeLang || 'plaintext'}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(codeText)}
                  className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-3 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
                {codeText}
              </pre>
            </div>
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Headers #, ##, ###
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={idx} className="text-2xl font-bold text-white tracking-tight mt-5 mb-2 pb-1 border-b border-[#272736]">
            {parseInline(line.slice(2))}
          </h1>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={idx} className="text-xl font-semibold text-zinc-100 tracking-tight mt-4 mb-2">
            {parseInline(line.slice(3))}
          </h2>
        );
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-base font-semibold text-zinc-200 mt-3 mb-1">
            {parseInline(line.slice(4))}
          </h3>
        );
        continue;
      }

      // Obsidian Callouts > [!NOTE], > [!TIP], > [!WARNING]
      if (line.startsWith('> [!')) {
        const typeMatch = line.match(/^> \[!([A-Z]+)\]\s*(.*)$/);
        const calloutType = typeMatch ? typeMatch[1].toLowerCase() : 'note';
        const calloutTitle = typeMatch && typeMatch[2] ? typeMatch[2] : calloutType.toUpperCase();
        elements.push(
          <div
            key={idx}
            className={`my-2 p-3 rounded-lg border-l-4 text-xs ${
              calloutType === 'warning'
                ? 'bg-amber-500/10 border-amber-500 text-amber-200'
                : calloutType === 'tip'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200'
                : 'bg-purple-500/10 border-[#705df2] text-purple-200'
            }`}
          >
            <div className="font-bold uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {calloutTitle}
            </div>
          </div>
        );
        continue;
      }

      // Task Checkboxes: - [ ] or - [x]
      if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]')) {
        const isChecked = line.includes('- [x]') || line.includes('- [X]');
        const textPart = line.replace(/^[-\s]*\[[ xX]\]/, '');
        elements.push(
          <div
            key={idx}
            onClick={() => handleToggleTask(idx)}
            className="flex items-start gap-2.5 my-1.5 py-0.5 px-1 rounded hover:bg-[#1a1a24] cursor-pointer transition-colors group"
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => handleToggleTask(idx)}
              className="mt-1 w-4 h-4 rounded border-zinc-700 bg-[#1e1e28] text-[#705df2] focus:ring-0 cursor-pointer accent-[#705df2]"
            />
            <span className={`text-xs text-zinc-300 leading-relaxed ${isChecked ? 'line-through text-zinc-500' : ''}`}>
              {parseInline(textPart)}
            </span>
          </div>
        );
        continue;
      }

      // Bullet lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-1 pl-2">
            <span className="text-[#a594fd] mt-1 text-xs">•</span>
            <span className="text-xs text-zinc-300 leading-relaxed">
              {parseInline(line.trim().slice(2))}
            </span>
          </div>
        );
        continue;
      }

      // Empty line / paragraph
      if (line.trim() === '') {
        elements.push(<div key={idx} className="h-2" />);
        continue;
      }

      // Standard paragraph
      elements.push(
        <p key={idx} className="text-xs text-zinc-300 leading-relaxed my-1">
          {parseInline(line)}
        </p>
      );
    }

    return elements;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#121217] overflow-hidden">
      {/* Note Header Toolbar */}
      <div className="h-12 border-b border-[#22222e] bg-[#14141a] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 truncate">
          <FileText className="w-4 h-4 text-[#a594fd] shrink-0" />
          <span className="font-semibold text-xs text-white truncate">{filePath}</span>
          <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
            Updated {formatTimeAgo(mtime)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Status */}
          <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 mr-2">
            {saveStatus === 'saving' && (
              <span className="text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                Synced
              </span>
            )}
            {saveStatus === 'dirty' && (
              <span className="text-zinc-500">Unsaved changes</span>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#1b1b24] border border-[#2b2b3a] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('preview')}
              className={`p-1.5 rounded ${viewMode === 'preview' ? 'bg-[#705df2] text-white' : 'text-zinc-400 hover:text-white'} transition-colors cursor-pointer`}
              title="Reading View (Preview)"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded ${viewMode === 'split' ? 'bg-[#705df2] text-white' : 'text-zinc-400 hover:text-white'} transition-colors cursor-pointer`}
              title="Split View (Side-by-Side)"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`p-1.5 rounded ${viewMode === 'edit' ? 'bg-[#705df2] text-white' : 'text-zinc-400 hover:text-white'} transition-colors cursor-pointer`}
              title="Source Editor (Markdown)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Version History Button */}
          <button
            onClick={onOpenHistory}
            className="p-1.5 bg-[#1b1b24] hover:bg-[#252533] border border-[#2b2b3a] text-zinc-300 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="View File Revisions & History"
          >
            <History className="w-3.5 h-3.5 text-[#9b8afb]" />
            <span className="hidden md:inline text-[11px]">History</span>
          </button>

          {/* Test Conflict Button */}
          <button
            onClick={onSimulateConflict}
            className="p-1.5 bg-[#251d18] hover:bg-[#34271e] border border-[#4d3625] text-amber-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="Simulate a 2-device sync conflict to test visual merge"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline text-[11px]">Test Conflict</span>
          </button>
        </div>
      </div>

      {/* Editor & Preview Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor (Shown in edit or split) */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex flex-col h-full ${viewMode === 'split' ? 'w-1/2 border-r border-[#22222e]' : 'w-full'}`}>
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start typing your note in Markdown... (use [[Wikilinks]] to link notes, #tags for categorization)"
              className="flex-1 p-6 bg-[#0f0f14] text-zinc-200 font-mono text-xs leading-relaxed resize-none focus:outline-none selection:bg-[#705df2]/30"
              spellCheck={false}
            />
          </div>
        )}

        {/* Live Preview (Shown in preview or split) */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full ${viewMode === 'split' ? 'bg-[#121217]' : 'bg-[#101015]'}`}>
            <div className="prose prose-invert max-w-none space-y-2">
              {renderMarkdown()}
            </div>

            {/* Backlinks Panel (Obsidian Mentions) */}
            <div className="mt-12 pt-6 border-t border-[#252533]">
              <div className="flex items-center gap-2 mb-3">
                <LinkIcon className="w-3.5 h-3.5 text-[#9b8afb]" />
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Linked Mentions ({backlinks.length})
                </h4>
              </div>

              {backlinks.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">
                  No other notes link to this note yet. Type <code className="text-[#a594fd]">[[{currentBaseName}]]</code> in any note to connect them.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {backlinks.map((b) => (
                    <button
                      key={b.path}
                      onClick={() => onNavigateToNote(b.name)}
                      className="p-2.5 rounded-lg bg-[#181822] hover:bg-[#20202e] border border-[#282838] text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-white group-hover:text-[#a594fd]">
                        <span className="truncate">{b.name.replace(/\.md$/, '')}</span>
                        <ArrowUpRight className="w-3 h-3 text-zinc-500 group-hover:text-[#a594fd]" />
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                        {b.path}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor Status Footer */}
      <div className="h-7 border-t border-[#22222e] bg-[#131319] px-4 flex items-center justify-between text-[11px] font-mono text-zinc-500 select-none">
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>{content.length} characters</span>
          <span className="hidden sm:inline">Obsidian Markdown Syntax</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Encoding: UTF-8</span>
          <span>E2EE Ready</span>
        </div>
      </div>
    </div>
  );
};
