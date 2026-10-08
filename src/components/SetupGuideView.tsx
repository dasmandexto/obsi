import React from 'react';
import { 
  Laptop, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  HelpCircle, 
  Share2, 
  Zap, 
  Lock, 
  ArrowRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import type { VaultMeta } from '../types';

interface SetupGuideViewProps {
  vault: VaultMeta;
  onOpenConnectModal: () => void;
}

export const SetupGuideView: React.FC<SetupGuideViewProps> = ({
  vault,
  onOpenConnectModal,
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#101015] p-6 lg:p-10 select-none">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#1c1c28] to-[#14141d] border border-[#2d2d40] rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-xl">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#705df2]/20 border border-[#705df2]/40 text-[#a594fd] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Obsidian Free Sync Architecture
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Synchronize Obsidian Everywhere — 100% Free & Private
            </h1>
            <p className="text-zinc-300 text-xs lg:text-sm max-w-2xl leading-relaxed">
              Official Obsidian Sync charges a recurring monthly fee ($4 to $10/mo per user). 
              With VaultBridge, your vaults sync smoothly across your Mac, Windows, Linux, iPhone, iPad, and Android phones using standard WebDAV with zero subscriptions.
            </p>
            <div className="pt-2">
              <button
                onClick={onOpenConnectModal}
                className="px-4 py-2 bg-[#705df2] hover:bg-[#5f4de0] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-[#705df2]/20 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Get WebDAV Sync Credentials</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-[#15151e] border border-[#282838] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Comparison: VaultBridge vs Paid Obsidian Sync
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#282838] text-zinc-400">
                  <th className="py-2.5 font-medium">Feature</th>
                  <th className="py-2.5 font-medium text-emerald-400">VaultBridge (This App)</th>
                  <th className="py-2.5 font-medium text-zinc-400">Official Obsidian Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20202e] text-zinc-300">
                <tr>
                  <td className="py-2.5 font-medium text-white">Monthly Cost</td>
                  <td className="py-2.5 text-emerald-400 font-semibold">$0.00 / Free Forever</td>
                  <td className="py-2.5 text-rose-400">$4 to $10 / month</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-white">Device Compatibility</td>
                  <td className="py-2.5">Mac, Windows, Linux, iOS, Android, Web</td>
                  <td className="py-2.5">Mac, Windows, Linux, iOS, Android</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-white">Web Browser Access</td>
                  <td className="py-2.5 text-emerald-400">Yes (Built-in Note Editor & Graph)</td>
                  <td className="py-2.5 text-zinc-500">No (App install required)</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-white">Protocol</td>
                  <td className="py-2.5 font-mono text-zinc-300">Standard WebDAV (RFC 4918)</td>
                  <td className="py-2.5 font-mono text-zinc-500">Proprietary WebSocket</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-white">Conflict Resolution</td>
                  <td className="py-2.5 text-emerald-400">Visual 3-Way Side-by-Side Diff</td>
                  <td className="py-2.5">Automatic duplicate files</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-white">Data Sovereignty</td>
                  <td className="py-2.5">100% Owned by You</td>
                  <td className="py-2.5">Stored in Obsidian servers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3 Step Tutorial Cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Quick 3-Step Setup Tutorial
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#15151e] border border-[#272738] rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-[#705df2]/15 text-[#a594fd] font-bold text-xs flex items-center justify-center font-mono">
                01
              </div>
              <h3 className="font-semibold text-white text-xs">Install Remotely Save</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Open Obsidian on desktop or mobile. Go to <strong>Settings → Community Plugins</strong>. Search for <strong>Remotely Save</strong> and click Install & Enable.
              </p>
            </div>

            <div className="bg-[#15151e] border border-[#272738] rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-[#705df2]/15 text-[#a594fd] font-bold text-xs flex items-center justify-center font-mono">
                02
              </div>
              <h3 className="font-semibold text-white text-xs">Enter WebDAV Details</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                In Remotely Save settings, select <strong>Webdav</strong>. Paste the WebDAV Server Address and your Secret Token from VaultBridge.
              </p>
            </div>

            <div className="bg-[#15151e] border border-[#272738] rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-[#705df2]/15 text-[#a594fd] font-bold text-xs flex items-center justify-center font-mono">
                03
              </div>
              <h3 className="font-semibold text-white text-xs">Sync & Enjoy</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Click the sync icon in Obsidian's left ribbon or turn on auto-sync on interval. All notes, folders, and attachments synchronize immediately!
              </p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-[#15151e] border border-[#272738] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#a594fd]" />
            Frequently Asked Questions
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#121217] border border-[#222230]">
              <div className="font-semibold text-white mb-1">Does this support Obsidian Canvas (.canvas) and images?</div>
              <p className="text-zinc-400 leading-relaxed">
                Yes! The WebDAV server transfers all file formats without restriction: markdown <code className="text-[#a594fd]">.md</code>, Obsidian Canvas <code className="text-[#a594fd]">.canvas</code>, images (PNG, JPG, SVG), PDFs, and vault configs.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#121217] border border-[#222230]">
              <div className="font-semibold text-white mb-1">What happens if I edit notes offline on my phone?</div>
              <p className="text-zinc-400 leading-relaxed">
                Obsidian is local-first. You continue typing notes normally. When your phone reconnects to internet or Wi-Fi, Remotely Save automatically syncs the delta changes back to your VaultBridge vault!
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#121217] border border-[#222230]">
              <div className="font-semibold text-white mb-1">Can I backup or move my notes anytime?</div>
              <p className="text-zinc-400 leading-relaxed">
                Yes, click the <strong>Backup</strong> button at the top of the screen at any moment to download an uncompressed, complete <code className="text-emerald-400">.zip</code> of your entire vault.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
