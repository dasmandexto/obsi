import React from 'react';
import { 
  FolderSync, 
  ChevronDown, 
  Plus, 
  Wifi, 
  WifiOff, 
  Share2, 
  Download, 
  Upload, 
  AlertTriangle, 
  Network, 
  FileText, 
  Activity, 
  BookOpen,
  Lock,
  HardDrive
} from 'lucide-react';
import type { VaultMeta } from '../types';
import { formatBytes } from '../utils/helpers';

interface HeaderProps {
  vaults: VaultMeta[];
  currentVault: VaultMeta | null;
  onSelectVault: (vault: VaultMeta) => void;
  onOpenNewVaultModal: () => void;
  onOpenConnectModal: () => void;
  onOpenImportExport: (mode: 'import' | 'export') => void;
  onOpenConflictModal: () => void;
  activeTab: 'editor' | 'graph' | 'sync' | 'guide';
  setActiveTab: (tab: 'editor' | 'graph' | 'sync' | 'guide') => void;
  isConnected: boolean;
  onManualSync: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  vaults,
  currentVault,
  onSelectVault,
  onOpenNewVaultModal,
  onOpenConnectModal,
  onOpenImportExport,
  onOpenConflictModal,
  activeTab,
  setActiveTab,
  isConnected,
  onManualSync,
  isSyncing,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const conflictCount = currentVault?.conflicts?.length || 0;

  return (
    <header className="h-14 border-b border-[#252532] bg-[#121217] flex items-center justify-between px-4 select-none shrink-0 z-20">
      {/* Left: App Brand & Vault Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-[#252532]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#705df2] to-[#4834d4] flex items-center justify-center text-white shadow-md shadow-[#705df2]/20">
            <FolderSync className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-tight">VaultBridge</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#705df2]/20 text-[#a594fd] border border-[#705df2]/30">
                FREE
              </span>
            </div>
          </div>
        </div>

        {/* Vault Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#181822] hover:bg-[#20202c] border border-[#2b2b3a] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#9b8afb]" />
            <span className="max-w-[140px] truncate">{currentVault?.name || 'Select Vault'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 w-64 bg-[#181822] border border-[#2e2e3e] rounded-xl shadow-2xl py-1.5 z-40 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Switch Vault
                </div>
                {vaults.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      onSelectVault(v);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#222230] transition-colors cursor-pointer ${
                      currentVault?.id === v.id ? 'bg-[#705df2]/10 text-white font-medium' : 'text-zinc-300'
                    }`}
                  >
                    <div className="truncate">
                      <div className="truncate">{v.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {v.fileCount || 0} notes • {formatBytes(v.totalSize || 0)}
                      </div>
                    </div>
                    {v.e2eeEnabled && <Lock className="w-3 h-3 text-[#a594fd]" />}
                  </button>
                ))}
                <div className="border-t border-[#2a2a38] mt-1 pt-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenNewVaultModal();
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 text-[#a594fd] hover:bg-[#222230] transition-colors cursor-pointer font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create New Vault
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Live Sync Status indicator */}
        <div className="hidden md:flex items-center gap-2 pl-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>WebDAV Active</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Connecting...</span>
              </>
            )}
          </div>

          {conflictCount > 0 && (
            <button
              onClick={onOpenConflictModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer animate-bounce"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{conflictCount} Conflict{conflictCount > 1 ? 's' : ''}</span>
            </button>
          )}
        </div>
      </div>

      {/* Middle: Tab Switcher */}
      <div className="flex items-center bg-[#171720] border border-[#252533] p-0.5 rounded-lg text-xs font-medium">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-[#705df2] text-white shadow-sm font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
            activeTab === 'graph'
              ? 'bg-[#705df2] text-white shadow-sm font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Graph</span>
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
            activeTab === 'sync'
              ? 'bg-[#705df2] text-white shadow-sm font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Activity</span>
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
            activeTab === 'guide'
              ? 'bg-[#705df2] text-white shadow-sm font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Guide</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOpenImportExport('export')}
          title="Backup & Export Vault (.zip)"
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f2b] rounded-lg transition-colors cursor-pointer hidden sm:flex items-center gap-1 text-xs border border-transparent hover:border-[#2e2e3e]"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Backup</span>
        </button>

        <button
          onClick={() => onOpenImportExport('import')}
          title="Import files or existing vault (.zip)"
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f2b] rounded-lg transition-colors cursor-pointer hidden sm:flex items-center gap-1 text-xs border border-transparent hover:border-[#2e2e3e]"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Import</span>
        </button>

        {/* Connect Obsidian Button */}
        <button
          onClick={onOpenConnectModal}
          className="px-3 py-1.5 bg-gradient-to-r from-[#705df2] to-[#5f4de0] hover:from-[#7c6bf5] hover:to-[#6b59eb] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-[#705df2]/25 transition-all cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Connect Obsidian</span>
        </button>
      </div>
    </header>
  );
};
