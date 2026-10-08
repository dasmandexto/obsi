import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  VaultMeta, 
  VaultFileMeta, 
  GraphNode, 
  GraphLink, 
  ConflictItem, 
  SyncLogEntry 
} from './types';
import { Header } from './components/Header';
import { VaultExplorer } from './components/VaultExplorer';
import { MarkdownEditor } from './components/MarkdownEditor';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { SyncMonitor } from './components/SyncMonitor';
import { SetupGuideView } from './components/SetupGuideView';
import { ConnectModal } from './components/ConnectModal';
import { NewVaultModal } from './components/NewVaultModal';
import { ConflictResolverModal } from './components/ConflictResolverModal';
import { VersionHistoryDrawer } from './components/VersionHistoryDrawer';
import { ImportExportModal } from './components/ImportExportModal';
import { Loader2 } from 'lucide-react';

export default function App() {
  // Vault state
  const [vaults, setVaults] = useState<VaultMeta[]>([]);
  const [currentVault, setCurrentVault] = useState<VaultMeta | null>(null);
  const [files, setFiles] = useState<VaultFileMeta[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Note state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [currentMtime, setCurrentMtime] = useState<number>(Date.now());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'editor' | 'graph' | 'sync' | 'guide'>('editor');

  // SSE and Live Sync State
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString(),
      type: 'connect',
      message: 'VaultBridge sync engine initialized and ready on WebDAV endpoint.',
    }
  ]);

  // Modal dialog states
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [newVaultModalOpen, setNewVaultModalOpen] = useState(false);
  const [importExportModal, setImportExportModal] = useState<{ isOpen: boolean; mode: 'import' | 'export' }>({
    isOpen: false,
    mode: 'export',
  });
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ConflictItem | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Helper to add log entries
  const addLog = useCallback((type: SyncLogEntry['type'], message: string, author?: string, path?: string) => {
    setSyncLogs((prev) => [
      {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString(),
        type,
        message,
        author,
        path,
      },
      ...prev.slice(0, 99), // keep latest 100
    ]);
  }, []);

  // Fetch Vaults
  const fetchVaults = useCallback(async () => {
    try {
      const res = await fetch('/api/vaults');
      if (res.ok) {
        const data = await res.json();
        setVaults(data.vaults || []);
        if (data.vaults && data.vaults.length > 0 && !currentVault) {
          setCurrentVault(data.vaults[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching vaults:', err);
    } finally {
      setLoading(false);
    }
  }, [currentVault]);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  // Fetch Files and Graph for current vault
  const fetchVaultFiles = useCallback(async (vaultId: string) => {
    try {
      const res = await fetch(`/api/vaults/${vaultId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setAllTags(data.allTags || []);
        setGraphNodes(data.graph?.nodes || []);
        setGraphLinks(data.graph?.links || []);
        setCurrentVault(data.vault);

        // Auto-select initial note if none selected or not in file list
        const mdFiles = (data.files || []).filter((f: VaultFileMeta) => !f.isFolder && f.path.endsWith('.md'));
        if (mdFiles.length > 0) {
          setSelectedFilePath((prev) => {
            if (prev && mdFiles.some((f: VaultFileMeta) => f.path === prev)) return prev;
            const welcome = mdFiles.find((f: VaultFileMeta) => f.path.includes('Welcome'));
            return welcome ? welcome.path : mdFiles[0].path;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching vault files:', err);
    }
  }, []);

  // When current vault changes, fetch files & open SSE stream
  useEffect(() => {
    if (!currentVault) return;

    fetchVaultFiles(currentVault.id);

    // Setup Server-Sent Events (SSE) stream for live updates
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/vaults/${currentVault.id}/events`);
    eventSourceRef.current = sse;

    sse.addEventListener('connected', () => {
      setIsConnected(true);
      addLog('connect', `Connected to live sync stream for "${currentVault.name}"`);
    });

    sse.addEventListener('file_updated', (e) => {
      const payload = JSON.parse(e.data);
      addLog('put', `Updated: ${payload.path}`, payload.author, payload.path);
      fetchVaultFiles(currentVault.id);
    });

    sse.addEventListener('file_deleted', (e) => {
      const payload = JSON.parse(e.data);
      addLog('delete', `Deleted: ${payload.path}`, undefined, payload.path);
      fetchVaultFiles(currentVault.id);
    });

    sse.addEventListener('conflict_detected', (e) => {
      const conflict: ConflictItem = JSON.parse(e.data);
      addLog('conflict', `Sync conflict on ${conflict.path} from ${conflict.device}`, conflict.device, conflict.path);
      setActiveConflict(conflict);
      setConflictModalOpen(true);
      fetchVaultFiles(currentVault.id);
    });

    sse.addEventListener('conflict_resolved', (e) => {
      const payload = JSON.parse(e.data);
      addLog('sync', `Resolved conflict on ${payload.path}`);
      fetchVaultFiles(currentVault.id);
    });

    sse.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      sse.close();
    };
  }, [currentVault?.id, fetchVaultFiles, addLog]);

  // Load active note content
  useEffect(() => {
    if (!currentVault || !selectedFilePath) return;

    fetch(`/api/vaults/${currentVault.id}/file?path=${encodeURIComponent(selectedFilePath)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setCurrentContent(data.content || '');
        setCurrentMtime(data.mtime || Date.now());
        if (data.path && data.path !== selectedFilePath) {
          setSelectedFilePath(data.path);
        }
      })
      .catch((err) => {
        // Safe fallback without throwing unhandled errors
        setCurrentContent('');
      });
  }, [currentVault?.id, selectedFilePath]);

  // Create Note
  const handleCreateFile = async (newPath: string) => {
    if (!currentVault) return;
    const initialNote = `# ${newPath.replace(/\.md$/, '')}\n\nType your notes here... Link to other notes with [[Wikilinks]].\n`;
    try {
      await fetch(`/api/vaults/${currentVault.id}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: newPath,
          content: initialNote,
          author: 'Web Editor',
        }),
      });
      await fetchVaultFiles(currentVault.id);
      setSelectedFilePath(newPath);
      setActiveTab('editor');
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  // Delete Note
  const handleDeleteFile = async (targetPath: string) => {
    if (!currentVault) return;
    try {
      await fetch(`/api/vaults/${currentVault.id}/file?path=${encodeURIComponent(targetPath)}`, {
        method: 'DELETE',
      });
      await fetchVaultFiles(currentVault.id);
      if (selectedFilePath === targetPath) {
        setSelectedFilePath(null);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  // Save Note
  const handleSaveFile = async (newContent: string) => {
    if (!currentVault || !selectedFilePath) return;
    await fetch(`/api/vaults/${currentVault.id}/file`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: selectedFilePath,
        content: newContent,
        author: 'Web Editor',
      }),
    });
    setCurrentContent(newContent);
    setCurrentMtime(Date.now());
  };

  // Navigate to Note from Wikilink or Graph
  const handleNavigateToNote = async (targetName: string) => {
    let clean = targetName.trim().replace(/^[\/\\]+/, '');
    const cleanWithMd = clean.endsWith('.md') ? clean : clean + '.md';

    // Find match in current files
    const match = files.find(
      (f) =>
        f.path.toLowerCase() === cleanWithMd.toLowerCase() ||
        f.name.toLowerCase() === cleanWithMd.toLowerCase() ||
        f.name.replace(/\.md$/, '').toLowerCase() === clean.replace(/\.md$/, '').toLowerCase() ||
        f.path.replace(/\.md$/, '').toLowerCase() === clean.replace(/\.md$/, '').toLowerCase()
    );

    if (match) {
      setSelectedFilePath(match.path);
      setActiveTab('editor');
    } else {
      // Create note directly in standard Obsidian fashion
      await handleCreateFile(cleanWithMd);
    }
  };

  // Create Vault
  const handleCreateVault = async (name: string, description: string) => {
    const res = await fetch('/api/vaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchVaults();
      setCurrentVault(data.vault);
    }
  };

  // Refresh Secret Token
  const handleRefreshToken = async () => {
    if (!currentVault) return;
    const res = await fetch(`/api/vaults/${currentVault.id}/refresh-token`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setCurrentVault({ ...currentVault, secretToken: data.token });
      fetchVaults();
    }
  };

  // Simulate Conflict for demonstration
  const handleSimulateConflict = async () => {
    if (!currentVault || !selectedFilePath) return;
    const res = await fetch(`/api/vaults/${currentVault.id}/simulate-conflict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFilePath }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveConflict(data.conflict);
      setConflictModalOpen(true);
    }
  };

  // Resolve Conflict
  const handleResolveConflict = async (conflictId: string, resolvedContent: string) => {
    if (!currentVault) return;
    await fetch(`/api/vaults/${currentVault.id}/resolve-conflict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflictId, resolvedContent }),
    });
    if (currentVault) {
      await fetchVaultFiles(currentVault.id);
    }
  };

  // Rollback Past Revision
  const handleRestoreVersion = async (historyId: string) => {
    if (!currentVault) return;
    const res = await fetch(`/api/vaults/${currentVault.id}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historyId }),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentContent(data.content);
      setCurrentMtime(Date.now());
      await fetchVaultFiles(currentVault.id);
    }
  };

  // Trigger manual sync animation
  const handleManualSync = () => {
    setIsSyncing(true);
    addLog('sync', 'Manual sync requested by user. Querying WebDAV endpoints...');
    setTimeout(() => {
      setIsSyncing(false);
      if (currentVault) fetchVaultFiles(currentVault.id);
      addLog('sync', 'All vault nodes and files synchronized successfully.');
    }, 1200);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0e0e13] text-zinc-300 gap-3">
        <Loader2 className="w-8 h-8 text-[#705df2] animate-spin" />
        <span className="text-sm font-mono text-zinc-400">Loading Obsidian VaultBridge...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f14] text-zinc-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <Header
        vaults={vaults}
        currentVault={currentVault}
        onSelectVault={(v) => setCurrentVault(v)}
        onOpenNewVaultModal={() => setNewVaultModalOpen(true)}
        onOpenConnectModal={() => setConnectModalOpen(true)}
        onOpenImportExport={(mode) => setImportExportModal({ isOpen: true, mode })}
        onOpenConflictModal={() => {
          if (currentVault?.conflicts && currentVault.conflicts.length > 0) {
            setActiveConflict(currentVault.conflicts[0]);
            setConflictModalOpen(true);
          }
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor View */}
        {activeTab === 'editor' && (
          <div className="flex-1 flex overflow-hidden">
            <VaultExplorer
              files={files}
              allTags={allTags}
              selectedFilePath={selectedFilePath}
              onSelectFile={(path) => setSelectedFilePath(path)}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
              selectedTag={selectedTag}
              onSelectTag={(tag) => setSelectedTag(tag)}
            />

            {selectedFilePath ? (
              <MarkdownEditor
                filePath={selectedFilePath}
                initialContent={currentContent}
                mtime={currentMtime}
                files={files}
                onSave={handleSaveFile}
                onNavigateToNote={handleNavigateToNote}
                onOpenHistory={() => setHistoryDrawerOpen(true)}
                onSimulateConflict={handleSimulateConflict}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center bg-[#101015]">
                <p className="text-sm mb-2">No note selected</p>
                <button
                  onClick={() => handleCreateFile('Quick Note.md')}
                  className="px-3 py-1.5 bg-[#705df2] hover:bg-[#5f4de0] text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Create Quick Note
                </button>
              </div>
            )}
          </div>
        )}

        {/* Knowledge Graph View */}
        {activeTab === 'graph' && (
          <KnowledgeGraph
            nodes={graphNodes}
            links={graphLinks}
            onSelectNote={(notePath) => {
              setSelectedFilePath(notePath);
              setActiveTab('editor');
            }}
          />
        )}

        {/* Sync Stream & Devices View */}
        {activeTab === 'sync' && currentVault && (
          <SyncMonitor
            vault={currentVault}
            logs={syncLogs}
            isConnected={isConnected}
            onRefreshDevices={() => {
              if (currentVault) fetchVaultFiles(currentVault.id);
            }}
            onSimulateSync={handleManualSync}
          />
        )}

        {/* Step-by-Step Setup Guide */}
        {activeTab === 'guide' && currentVault && (
          <SetupGuideView
            vault={currentVault}
            onOpenConnectModal={() => setConnectModalOpen(true)}
          />
        )}
      </div>

      {/* Connect Modal */}
      {currentVault && (
        <ConnectModal
          vault={currentVault}
          isOpen={connectModalOpen}
          onClose={() => setConnectModalOpen(false)}
          onRefreshToken={handleRefreshToken}
        />
      )}

      {/* New Vault Modal */}
      <NewVaultModal
        isOpen={newVaultModalOpen}
        onClose={() => setNewVaultModalOpen(false)}
        onCreate={handleCreateVault}
      />

      {/* Conflict Resolution Modal */}
      <ConflictResolverModal
        conflict={activeConflict}
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        onResolve={handleResolveConflict}
      />

      {/* Version History Drawer */}
      {currentVault && selectedFilePath && (
        <VersionHistoryDrawer
          isOpen={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
          filePath={selectedFilePath}
          vaultId={currentVault.id}
          currentContent={currentContent}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Import / Export Modal */}
      {currentVault && (
        <ImportExportModal
          isOpen={importExportModal.isOpen}
          mode={importExportModal.mode}
          vault={currentVault}
          files={files}
          onClose={() => setImportExportModal({ ...importExportModal, isOpen: false })}
          onRefreshFiles={async () => {
            if (currentVault) await fetchVaultFiles(currentVault.id);
          }}
        />
      )}
    </div>
  );
}
