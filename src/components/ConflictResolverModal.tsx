import React, { useState } from 'react';
import { X, AlertTriangle, Check, ArrowRight, Smartphone, Laptop, SplitSquareVertical } from 'lucide-react';
import type { ConflictItem } from '../types';
import { computeLineDiff } from '../utils/helpers';

interface ConflictResolverModalProps {
  conflict: ConflictItem | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (conflictId: string, resolvedContent: string) => Promise<void>;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  conflict,
  isOpen,
  onClose,
  onResolve,
}) => {
  const [resolvedText, setResolvedText] = useState('');
  const [activeChoice, setActiveChoice] = useState<'server' | 'local' | 'merge'>('merge');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (conflict) {
      // Default to combined merge
      const merged = `${conflict.serverContent}\n\n# --- Merged Changes from ${conflict.device} ---\n\n${conflict.localContent}`;
      setResolvedText(merged);
      setActiveChoice('merge');
    }
  }, [conflict]);

  if (!isOpen || !conflict) return null;

  const handleSelectServer = () => {
    setActiveChoice('server');
    setResolvedText(conflict.serverContent);
  };

  const handleSelectLocal = () => {
    setActiveChoice('local');
    setResolvedText(conflict.localContent);
  };

  const handleSelectMerge = () => {
    setActiveChoice('merge');
    setResolvedText(`${conflict.serverContent}\n\n# --- Appended from ${conflict.device} ---\n\n${conflict.localContent}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onResolve(conflict.id, resolvedText);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const serverDiff = computeLineDiff(conflict.serverContent, conflict.localContent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#171720] border border-[#323244] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#292938] bg-[#131319] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Sync Conflict Detected
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {conflict.path}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Simultaneous edits occurred on <strong className="text-zinc-200">{conflict.device}</strong> and the server.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff Comparison View */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server Version */}
            <div className="flex flex-col border border-[#2e2e3e] rounded-xl overflow-hidden bg-[#111116]">
              <div className="p-2.5 bg-[#1a1a24] border-b border-[#292938] flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-[#9b8afb]" />
                  Server Copy (Existing)
                </span>
                <button
                  type="button"
                  onClick={handleSelectServer}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    activeChoice === 'server'
                      ? 'bg-[#705df2] text-white'
                      : 'bg-[#252535] text-zinc-300 hover:text-white'
                  }`}
                >
                  Choose Server Copy
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-zinc-300 max-h-56 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {conflict.serverContent}
              </pre>
            </div>

            {/* Local Device Version */}
            <div className="flex flex-col border border-[#2e2e3e] rounded-xl overflow-hidden bg-[#111116]">
              <div className="p-2.5 bg-[#1a1a24] border-b border-[#292938] flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  Device Copy ({conflict.device})
                </span>
                <button
                  type="button"
                  onClick={handleSelectLocal}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    activeChoice === 'local'
                      ? 'bg-[#705df2] text-white'
                      : 'bg-[#252535] text-zinc-300 hover:text-white'
                  }`}
                >
                  Choose Device Copy
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono text-emerald-300/90 max-h-56 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {conflict.localContent}
              </pre>
            </div>
          </div>

          {/* Quick Choice Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectMerge}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeChoice === 'merge'
                  ? 'bg-[#705df2]/20 border-[#705df2] text-[#a594fd]'
                  : 'bg-[#181824] border-[#292938] text-zinc-400 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Merge Both Copies
            </button>
            <span className="text-xs text-zinc-500">
              Or edit the resolved output box below directly before saving.
            </span>
          </div>

          {/* Final Resolution Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Final Resolved Document (Will be synced to all devices):
            </label>
            <textarea
              rows={6}
              value={resolvedText}
              onChange={(e) => setResolvedText(e.target.value)}
              className="w-full bg-[#0f0f14] border border-[#2c2c3d] focus:border-[#705df2] rounded-xl p-3 text-xs font-mono text-zinc-100 leading-relaxed focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#131319] border-t border-[#292938] flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Resolved file will be broadcast to all connected devices immediately.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#705df2] hover:bg-[#5f4de0] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : 'Confirm Resolution'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
