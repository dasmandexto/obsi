import React, { useState } from 'react';
import { X, Copy, Check, QrCode, Shield, RefreshCw, Smartphone, Laptop, ExternalLink, Key, Globe, FolderSync } from 'lucide-react';
import type { VaultMeta } from '../types';

interface ConnectModalProps {
  vault: VaultMeta;
  isOpen: boolean;
  onClose: () => void;
  onRefreshToken: () => Promise<void>;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  vault,
  isOpen,
  onClose,
  onRefreshToken,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'remotely-save' | 'mobile' | 'details' | 'json'>('remotely-save');

  if (!isOpen) return null;

  // Determine current origin for WebDAV URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const webdavUrl = `${origin}/webdav/${vault.id}/`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshToken();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Remotely Save config json template
  const configJson = JSON.stringify(
    {
      syncConfigBy: 'webdav',
      webdav: {
        address: webdavUrl,
        username: 'obsidian',
        password: vault.secretToken,
        depth: 'infinity',
      },
      agreeToUploadLargeFiles: true,
      syncOnSave: true,
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#18181f] border border-[#2e2e3a] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#2a2a36] flex items-center justify-between bg-[#14141a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#705df2]/15 border border-[#705df2]/30 flex items-center justify-center text-[#9b8afb]">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Connect Obsidian
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  100% Free Sync
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Sync vault <span className="text-white font-medium">"{vault.name}"</span> across all your desktop and mobile devices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#2a2a36] px-5 bg-[#16161d] text-xs font-medium">
          <button
            onClick={() => setActiveTab('remotely-save')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'remotely-save'
                ? 'border-[#705df2] text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Laptop className="w-4 h-4 text-[#9b8afb]" />
            Remotely Save (Desktop)
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'mobile'
                ? 'border-[#705df2] text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            Mobile (iOS / Android)
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[#705df2] text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-4 h-4 text-amber-400" />
            WebDAV Credentials
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'json'
                ? 'border-[#705df2] text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Config Export
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Quick Copy Banner */}
          <div className="space-y-3 bg-[#131318] p-4 rounded-xl border border-[#272733]">
            <div>
              <label className="text-xs font-mono text-zinc-400 flex items-center gap-1.5 mb-1.5">
                <Globe className="w-3.5 h-3.5 text-[#9b8afb]" />
                WebDAV Server Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webdavUrl}
                  className="w-full bg-[#1b1b24] border border-[#2f2f3d] rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 select-all focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(webdavUrl, setCopiedUrl)}
                  className="px-3 py-2 bg-[#705df2] hover:bg-[#5f4de0] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUrl ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Vault Secret Token (Password)
                </label>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  title="Generate a new secret token"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  readOnly
                  value={vault.secretToken}
                  className="w-full bg-[#1b1b24] border border-[#2f2f3d] rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="px-2.5 py-2 bg-[#22222d] hover:bg-[#2b2b38] border border-[#2f2f3d] rounded-lg text-xs text-zinc-300 transition-colors shrink-0 cursor-pointer"
                >
                  {showToken ? 'Hide' : 'Reveal'}
                </button>
                <button
                  onClick={() => copyToClipboard(vault.secretToken, setCopiedToken)}
                  className="px-3 py-2 bg-[#2a2a36] hover:bg-[#343444] border border-[#3c3c4e] text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedToken ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'remotely-save' && (
            <div className="space-y-4">
              <h3 className="font-medium text-white flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
                Setup with Remotely Save (Recommended)
              </h3>
              <ol className="space-y-3 text-xs text-zinc-300 list-decimal list-inside pl-1">
                <li className="leading-relaxed">
                  In Obsidian, go to <strong className="text-white">Settings → Community Plugins</strong>. Turn off Restricted Mode.
                </li>
                <li className="leading-relaxed">
                  Search for <strong className="text-[#a594fd]">Remotely Save</strong> (free, trusted by 300k+ users). Click Install & Enable.
                </li>
                <li className="leading-relaxed">
                  Open Remotely Save settings, select <strong className="text-white">Webdav</strong> under <span className="text-zinc-400">Sync Service</span>.
                </li>
                <li className="leading-relaxed">
                  Paste the <strong className="text-white">WebDAV Server Address</strong> and <strong className="text-white">Vault Secret Token</strong> as your password.
                </li>
                <li className="leading-relaxed">
                  Click the sync icon in Obsidian's left ribbon to trigger your first instant sync!
                </li>
              </ol>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-[#9b8afb] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Zero Cloud Lock-in:</span> Your notes are standard Markdown files stored on this server. You can export or switch anytime without fees.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mobile' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#14141b] border border-[#252533]">
                {/* Visual QR Code Representation */}
                <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-lg">
                  <div className="w-32 h-32 flex items-center justify-center text-black font-mono text-[9px] text-center border-4 border-black p-1">
                    <div className="grid grid-cols-5 gap-1 w-full h-full p-1 bg-zinc-100">
                      <div className="bg-black col-span-2 row-span-2"></div>
                      <div className="bg-black"></div>
                      <div className="bg-black col-span-2 row-span-2"></div>
                      <div className="bg-black"></div>
                      <div className="bg-black"></div>
                      <div className="bg-black col-span-2"></div>
                      <div className="bg-black"></div>
                      <div className="bg-black"></div>
                      <div className="bg-black col-span-2 row-span-2"></div>
                      <div className="bg-black"></div>
                      <div className="bg-black col-span-2 row-span-2"></div>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-700 font-mono mt-1 font-semibold">WebDAV Scan</span>
                </div>

                <div className="space-y-2 text-xs text-zinc-300">
                  <h4 className="font-semibold text-white text-sm">Syncing iPhone / iPad / Android</h4>
                  <p>1. Open Obsidian on your phone and create an empty vault.</p>
                  <p>2. Install the <span className="text-[#a594fd] font-medium">Remotely Save</span> community plugin on your phone.</p>
                  <p>3. Choose <strong>Webdav</strong> and paste this server's address.</p>
                  <p className="text-zinc-400">Mobile sync runs in the background whenever you open or edit a note.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#14141a] border border-[#272733]">
                  <span className="text-zinc-400 block mb-1">HTTP Protocol</span>
                  <span className="font-mono text-white font-medium">WebDAV RFC 4918</span>
                </div>
                <div className="p-3 rounded-lg bg-[#14141a] border border-[#272733]">
                  <span className="text-zinc-400 block mb-1">Supported Methods</span>
                  <span className="font-mono text-emerald-400 font-medium">PROPFIND, PUT, GET, DELETE</span>
                </div>
                <div className="p-3 rounded-lg bg-[#14141a] border border-[#272733]">
                  <span className="text-zinc-400 block mb-1">Username</span>
                  <span className="font-mono text-white font-medium">obsidian (or any string)</span>
                </div>
                <div className="p-3 rounded-lg bg-[#14141a] border border-[#272733]">
                  <span className="text-zinc-400 block mb-1">Encryption Mode</span>
                  <span className="font-mono text-[#a594fd] font-medium">HTTPS / Client AES-256</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Ready-to-use config snippet for Remotely Save or third-party sync scripts:
                </p>
                <button
                  onClick={() => copyToClipboard(configJson, setCopiedJson)}
                  className="text-xs text-[#a594fd] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedJson ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre className="p-3 bg-[#111116] border border-[#272733] rounded-lg text-[11px] font-mono text-zinc-300 overflow-x-auto">
                {configJson}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#14141a] border-t border-[#2a2a36] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Server Ready & Listening on Port 3000
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#272733] hover:bg-[#343444] text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
