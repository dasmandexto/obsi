import React, { useState, useEffect } from 'react';
import { X, History, RotateCcw, Clock, Laptop, Smartphone, Check, FileText } from 'lucide-react';
import type { FileVersion } from '../types';
import { formatTimeAgo, formatBytes, computeLineDiff } from '../utils/helpers';

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  vaultId: string;
  currentContent: string;
  onRestore: (versionId: string) => Promise<void>;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  filePath,
  vaultId,
  currentContent,
  onRestore,
}) => {
  const [history, setHistory] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<FileVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (isOpen && filePath) {
      setLoading(true);
      fetch(`/api/vaults/${vaultId}/history?path=${encodeURIComponent(filePath)}`)
        .then(res => res.json())
        .then(data => {
          setHistory(data.history || []);
          if (data.history && data.history.length > 0) {
            setSelectedVersion(data.history[0]);
          } else {
            setSelectedVersion(null);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, filePath, vaultId]);

  if (!isOpen) return null;

  const handleRestore = async (versionId: string) => {
    setRestoring(true);
    try {
      await onRestore(versionId);
      onClose();
    } finally {
      setRestoring(false);
    }
  };

  const diffLines = selectedVersion ? computeLineDiff(selectedVersion.content, currentContent) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl bg-[#161620] border-l border-[#2e2e3e] h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[#282838] bg-[#121217] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#9b8afb]" />
            <div>
              <h3 className="font-semibold text-sm text-white">Version History</h3>
              <p className="text-xs text-zinc-400 font-mono truncate max-w-sm">{filePath}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Timeline List */}
          <div className="w-60 border-r border-[#242434] overflow-y-auto p-2 space-y-1 bg-[#131319]">
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Snapshots ({history.length})
            </div>

            {loading ? (
              <div className="p-4 text-center text-xs text-zinc-500">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                No past revisions yet for this note. Changes are saved automatically upon sync.
              </div>
            ) : (
              history.map((rev) => {
                const isSelected = selectedVersion?.id === rev.id;
                return (
                  <button
                    key={rev.id}
                    onClick={() => setSelectedVersion(rev)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#705df2]/20 border border-[#705df2]/40 text-white'
                        : 'hover:bg-[#1a1a26] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{formatTimeAgo(rev.timestamp)}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{formatBytes(rev.size)}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                      {rev.author.includes('Mobile') ? (
                        <Smartphone className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Laptop className="w-3 h-3 text-[#9b8afb]" />
                      )}
                      <span>{rev.author}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Diff Preview Pane */}
          <div className="flex-1 flex flex-col bg-[#0f0f14] overflow-hidden">
            {selectedVersion ? (
              <>
                <div className="p-3 border-b border-[#252535] bg-[#14141c] flex items-center justify-between">
                  <div className="text-xs text-zinc-300">
                    Snapshot from <span className="font-semibold text-white">{new Date(selectedVersion.timestamp).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => handleRestore(selectedVersion.id)}
                    disabled={restoring}
                    className="px-3 py-1.5 bg-[#705df2] hover:bg-[#5f4de0] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {restoring ? 'Restoring...' : 'Restore This Version'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-0.5 font-mono text-[11px] leading-relaxed">
                  {diffLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 rounded ${
                        line.type === 'added'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : line.type === 'removed'
                          ? 'bg-rose-500/15 text-rose-300 line-through opacity-70'
                          : 'text-zinc-400'
                      }`}
                    >
                      <span className="w-4 inline-block select-none opacity-40">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      {line.text}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
                Select a revision to compare with current file.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
