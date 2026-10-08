import React, { useState } from 'react';
import { 
  Activity, 
  Laptop, 
  Smartphone, 
  Globe, 
  CheckCircle2, 
  Radio, 
  RefreshCw, 
  ShieldCheck, 
  HardDrive, 
  Layers, 
  Clock, 
  Send,
  Zap,
  Terminal
} from 'lucide-react';
import type { VaultMeta, SyncDevice, SyncLogEntry } from '../types';
import { formatTimeAgo, formatBytes } from '../utils/helpers';

interface SyncMonitorProps {
  vault: VaultMeta;
  logs: SyncLogEntry[];
  isConnected: boolean;
  onRefreshDevices: () => void;
  onSimulateSync: () => void;
}

export const SyncMonitor: React.FC<SyncMonitorProps> = ({
  vault,
  logs,
  isConnected,
  onRefreshDevices,
  onSimulateSync,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = logs.filter(l => {
    if (filterType === 'all') return true;
    return l.type === filterType;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#101015] overflow-y-auto p-6 space-y-6 select-none">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161620] border border-[#272736] p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-mono text-zinc-400">WebDAV Engine</div>
            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
              <span>Online & Listening</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Port 3000 • RFC 4918</div>
          </div>
        </div>

        <div className="bg-[#161620] border border-[#272736] p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#705df2]/10 border border-[#705df2]/20 flex items-center justify-center text-[#a594fd]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono text-zinc-400">Synced Notes</div>
            <div className="text-sm font-semibold text-white">
              {vault.fileCount || 0} Markdown Files
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">{formatBytes(vault.totalSize || 0)} Total</div>
          </div>
        </div>

        <div className="bg-[#161620] border border-[#272736] p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono text-zinc-400">Known Devices</div>
            <div className="text-sm font-semibold text-white">
              {vault.devices?.length || 1} Synced Clients
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Desktop & Mobile</div>
          </div>
        </div>

        <div className="bg-[#161620] border border-[#272736] p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono text-zinc-400">Privacy & Cost</div>
            <div className="text-sm font-semibold text-emerald-400">
              100% Free Forever
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">$0 / mo vs Obsidian $10</div>
          </div>
        </div>
      </div>

      {/* Connected Devices Table */}
      <div className="bg-[#15151e] border border-[#272738] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#252535] bg-[#121218] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#a594fd]" />
            <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
              Connected Devices & Sync Clients
            </h3>
          </div>
          <button
            onClick={onSimulateSync}
            className="px-3 py-1.5 bg-[#252535] hover:bg-[#303042] text-zinc-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Simulate Device Ping
          </button>
        </div>

        <div className="divide-y divide-[#20202e]">
          {(vault.devices || []).map((dev) => (
            <div key={dev.id} className="p-4 flex items-center justify-between hover:bg-[#181822] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#222230] border border-[#2e2e40] flex items-center justify-center text-zinc-300">
                  {dev.platform === 'ios' || dev.platform === 'android' ? (
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                  ) : dev.platform === 'web' ? (
                    <Globe className="w-4 h-4 text-[#a594fd]" />
                  ) : (
                    <Laptop className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>{dev.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">
                      {dev.platform}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {dev.userAgent || 'Obsidian Remotely Save Client'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-emerald-400 flex items-center gap-1 justify-end font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Active
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  Last seen {formatTimeAgo(dev.lastSeen)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Sync Terminal Log */}
      <div className="bg-[#121217] border border-[#272738] rounded-2xl overflow-hidden flex flex-col h-80">
        <div className="p-3 border-b border-[#222230] bg-[#0f0f14] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white font-mono">Live Sync Event Stream</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SSE Connected
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                filterType === 'all' ? 'bg-[#705df2] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('put')}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                filterType === 'put' ? 'bg-[#705df2] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Uploads
            </button>
            <button
              onClick={() => setFilterType('sync')}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                filterType === 'sync' ? 'bg-[#705df2] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sync
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs bg-[#0b0b0e]">
          {filteredLogs.length === 0 ? (
            <div className="text-zinc-600 text-center py-10">
              Waiting for incoming WebDAV sync requests from Obsidian...
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-0.5 text-zinc-300">
                <span className="text-zinc-600 text-[11px] shrink-0">[{log.time}]</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase shrink-0 ${
                    log.type === 'put'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : log.type === 'delete'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : log.type === 'conflict'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {log.type}
                </span>
                <span className="text-zinc-200">{log.message}</span>
                {log.author && (
                  <span className="text-zinc-500 text-[11px] ml-auto shrink-0">via {log.author}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
