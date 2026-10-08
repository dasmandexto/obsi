import React, { useState } from 'react';
import { X, Download, Upload, FileArchive, Check, AlertCircle, FileText, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import type { VaultMeta, VaultFileMeta } from '../types';

interface ImportExportModalProps {
  isOpen: boolean;
  mode: 'import' | 'export';
  vault: VaultMeta;
  files: VaultFileMeta[];
  onClose: () => void;
  onRefreshFiles: () => Promise<void>;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  mode,
  vault,
  files,
  onClose,
  onRefreshFiles,
}) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  // Export current vault as ZIP
  const handleExportZip = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const zip = new JSZip();

      // Fetch all files
      for (const f of files) {
        if (f.isFolder) continue;
        const res = await fetch(`/api/vaults/${vault.id}/file?path=${encodeURIComponent(f.path)}`);
        if (res.ok) {
          const data = await res.json();
          zip.file(f.path, data.content || '');
        }
      }

      // Add a meta readme
      zip.file(
        '_vaultbridge_sync.json',
        JSON.stringify(
          {
            vaultId: vault.id,
            vaultName: vault.name,
            exportedAt: new Date().toISOString(),
            filesCount: files.filter(f => !f.isFolder).length,
          },
          null,
          2
        )
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${vault.name.toLowerCase().replace(/\s+/g, '-')}-obsidian-backup.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg('Vault exported successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to export vault');
    } finally {
      setLoading(false);
    }
  };

  // Import files / zip into vault
  const handleFileUpload = async (uploadedFiles: FileList | File[]) => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let importedCount = 0;

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];

        if (file.name.endsWith('.zip')) {
          // Unzip
          const zip = new JSZip();
          const zipData = await zip.loadAsync(file);

          for (const [relPath, zipEntry] of Object.entries(zipData.files)) {
            if (zipEntry.dir || relPath.startsWith('__MACOSX') || relPath.startsWith('.')) continue;
            const content = await zipEntry.async('string');

            await fetch(`/api/vaults/${vault.id}/file`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: relPath,
                content,
                author: 'ZIP Importer',
              }),
            });
            importedCount++;
          }
        } else if (file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.canvas')) {
          const content = await file.text();
          await fetch(`/api/vaults/${vault.id}/file`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: file.name,
              content,
              author: 'File Upload',
            }),
          });
          importedCount++;
        }
      }

      await onRefreshFiles();
      setSuccessMsg(`Successfully imported ${importedCount} file${importedCount !== 1 ? 's' : ''}!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="bg-[#181820] border border-[#2e2e40] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[#282838] bg-[#131319] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#705df2]/15 border border-[#705df2]/30 flex items-center justify-center text-[#a594fd]">
              {mode === 'export' ? <Download className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">
                {mode === 'export' ? 'Backup Vault (.zip)' : 'Import Existing Notes'}
              </h3>
              <p className="text-xs text-zinc-400">Vault: {vault.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'export' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#121217] border border-[#252535] text-zinc-300 space-y-2">
                <div className="font-semibold text-white text-sm">Download Full Vault Archive</div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Generates an uncompressed standard Obsidian directory containing all your markdown notes, wikilinks, and folder hierarchies.
                </p>
                <div className="text-[11px] font-mono text-zinc-500 pt-1">
                  Ready to package {files.filter(f => !f.isFolder).length} notes.
                </div>
              </div>

              <button
                onClick={handleExportZip}
                disabled={loading}
                className="w-full py-2.5 bg-[#705df2] hover:bg-[#5f4de0] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs shadow-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {loading ? 'Creating Archive...' : 'Download .ZIP Archive'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files) {
                    handleFileUpload(e.dataTransfer.files);
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-[#705df2] bg-[#705df2]/10'
                    : 'border-[#2e2e42] bg-[#121217] hover:border-[#3e3e56]'
                }`}
              >
                <FileArchive className="w-8 h-8 text-[#9b8afb] mx-auto mb-2 opacity-80" />
                <div className="font-medium text-white mb-1">
                  Drag and drop a .zip or .md files here
                </div>
                <p className="text-[11px] text-zinc-400 mb-3">
                  Upload an existing Obsidian vault backup to sync immediately
                </p>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#252535] hover:bg-[#303042] text-white rounded-lg text-xs cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse Files</span>
                  <input
                    type="file"
                    multiple
                    accept=".zip,.md,.txt,.canvas"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleFileUpload(e.target.files);
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
