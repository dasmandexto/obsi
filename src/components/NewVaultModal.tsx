import React, { useState } from 'react';
import { X, FolderPlus, Sparkles } from 'lucide-react';

interface NewVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export const NewVaultModal: React.FC<NewVaultModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vault name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onCreate(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#18181f] border border-[#2e2e3a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-[#2a2a36] flex items-center justify-between bg-[#14141a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#705df2]/15 border border-[#705df2]/30 flex items-center justify-center text-[#9b8afb]">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create New Vault</h2>
              <p className="text-xs text-zinc-400">Add an isolated workspace for notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Vault Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Work Projects, Research Brain, University"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#121217] border border-[#2e2e3e] focus:border-[#705df2] rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="What kind of notes will live in this vault?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#121217] border border-[#2e2e3e] focus:border-[#705df2] rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none resize-none transition-colors"
            />
          </div>

          <div className="p-3 rounded-lg bg-[#14141d] border border-[#252533] text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#9b8afb]" />
              Independent WebDAV Endpoint
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Each vault gets its own dedicated WebDAV URL and sync token so you can sync different folders or teams separately.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#705df2] hover:bg-[#5f4de0] text-white font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FolderPlus className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
