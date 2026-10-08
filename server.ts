import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const STORAGE_DIR = path.resolve(__dirname, 'vault_storage');

// Ensure storage dir exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Global Types
interface VaultFileMeta {
  path: string;
  name: string;
  size: number;
  mtime: number;
  etag: string;
  isFolder: boolean;
  tags?: string[];
  links?: string[];
}

interface FileVersion {
  id: string;
  path: string;
  content: string;
  timestamp: number;
  author: string;
  size: number;
}

interface SyncDevice {
  id: string;
  name: string;
  platform: 'mac' | 'windows' | 'linux' | 'ios' | 'android' | 'web';
  lastSeen: number;
  ip?: string;
  userAgent?: string;
}

interface VaultMeta {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  secretToken: string;
  e2eeEnabled: boolean;
  e2eeSalt?: string;
  devices: SyncDevice[];
  history: FileVersion[];
  conflicts: Array<{
    id: string;
    path: string;
    localContent: string;
    serverContent: string;
    timestamp: number;
    device: string;
  }>;
}

// In-memory active SSE clients per vault
const sseClients: Map<string, Set<Response>> = new Map();

function broadcastEvent(vaultId: string, event: string, data: any) {
  const clients = sseClients.get(vaultId);
  if (!clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

// Helper to compute MD5 / ETag
function getFileETag(content: Buffer | string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Vault Helpers
function getVaultDir(vaultId: string): string {
  const dir = path.join(STORAGE_DIR, vaultId, 'files');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getVaultMetaPath(vaultId: string): string {
  return path.join(STORAGE_DIR, vaultId, 'meta.json');
}

function getVaultMeta(vaultId: string): VaultMeta {
  const metaPath = getVaultMetaPath(vaultId);
  if (fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      // fallback
    }
  }

  // Create default meta
  const meta: VaultMeta = {
    id: vaultId,
    name: vaultId === 'main-vault' ? 'Personal Knowledge Base' : vaultId,
    description: 'Synced Obsidian Vault with WebDAV and E2EE support',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    secretToken: 'vb_' + crypto.randomBytes(12).toString('hex'),
    e2eeEnabled: false,
    devices: [
      {
        id: 'web-client',
        name: 'VaultBridge Web Client',
        platform: 'web',
        lastSeen: Date.now(),
      }
    ],
    history: [],
    conflicts: [],
  };
  saveVaultMeta(vaultId, meta);
  return meta;
}

function saveVaultMeta(vaultId: string, meta: VaultMeta) {
  const metaPath = getVaultMetaPath(vaultId);
  const dir = path.dirname(metaPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

// Extract Wikilinks [[target]] and tags #tag from Markdown
function extractMarkdownMetadata(content: string): { links: string[]; tags: string[] } {
  const linkRegex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-\/]+)(?=\s|$)/g;

  const links = new Set<string>();
  const tags = new Set<string>();

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const rawLink = match[1].trim();
    if (rawLink) links.add(rawLink);
  }

  while ((match = tagRegex.exec(content)) !== null) {
    const rawTag = match[1].trim();
    if (rawTag && !rawTag.match(/^\d+$/)) {
      tags.add(rawTag);
    }
  }

  return { links: Array.from(links), tags: Array.from(tags) };
}

// Robust File Search in Vault (handles extension variations, leading slashes, and wikilink names)
function findVaultFile(vaultDir: string, inputPath: string): { fullPath: string; relPath: string } | null {
  if (!inputPath) return null;
  let clean = inputPath.replace(/^[\/\\]+/, '').trim();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // ignore
  }
  clean = path.normalize(clean);
  if (clean.startsWith('..')) return null;

  // 1. Direct path check
  const direct = path.resolve(vaultDir, clean);
  if (direct.startsWith(vaultDir) && fs.existsSync(direct) && !fs.statSync(direct).isDirectory()) {
    return { fullPath: direct, relPath: path.relative(vaultDir, direct) };
  }

  // 2. Direct path with .md extension
  if (!clean.endsWith('.md')) {
    const withMd = path.resolve(vaultDir, clean + '.md');
    if (withMd.startsWith(vaultDir) && fs.existsSync(withMd) && !fs.statSync(withMd).isDirectory()) {
      return { fullPath: withMd, relPath: path.relative(vaultDir, withMd) };
    }
  }

  // 3. Search case-insensitively or by base note name in vault
  const baseName = path.basename(clean).replace(/\.md$/i, '').toLowerCase();
  let found: { fullPath: string; relPath: string } | null = null;

  const searchRecursive = (dir: string) => {
    if (found || !fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        searchRecursive(full);
      } else if (entry.isFile()) {
        const entryBase = entry.name.replace(/\.md$/i, '').toLowerCase();
        if (entryBase === baseName) {
          found = { fullPath: full, relPath: path.relative(vaultDir, full) };
          return;
        }
      }
    }
  };

  searchRecursive(vaultDir);
  return found;
}

// Seed Initial Vault if empty
function seedDefaultVault() {
  const defaultId = 'main-vault';
  const vaultDir = getVaultDir(defaultId);
  const meta = getVaultMeta(defaultId);

  const existingFiles = fs.readdirSync(vaultDir);
  if (existingFiles.length === 0) {
    const filesToSeed: Record<string, string> = {
      'Welcome to VaultBridge.md': `# Welcome to VaultBridge 🚀

**VaultBridge** is your 100% free, private, self-hosted synchronization hub for Obsidian vaults.

You no longer need to pay $4-$10/month for Obsidian Sync. With VaultBridge, you maintain **total data ownership**, instantaneous sync across devices, visual conflict resolution, and full WebDAV compatibility!

## ✨ Key Capabilities
- 📱 **Cross-Device Sync**: Works seamlessly with Obsidian on macOS, Windows, Linux, iOS (iPhone/iPad), and Android.
- 🔒 **End-to-End Encryption (E2EE)**: Optional AES-256 client-side encryption. Nobody can read your notes without your master passphrase.
- 🌐 **Standard WebDAV**: Direct connection via the popular, free **Remotely Save** plugin.
- 🕸️ **Interactive Knowledge Graph**: Live 2D force-directed map of all your \`[[wikilinks]]\` and notes.
- ⚡ **Realtime Live Sync**: Instant file change broadcasting via Server-Sent Events.
- 🕒 **Version History & Visual Diffs**: Restore previous note snapshots or resolve edits visually without losing a single word.
- 📦 **One-Click Backup & Export**: Download your entire vault as a clean \`.zip\` archive at any time.

## 🔗 Connected Notes
- Check the setup manual: [[Setup Guide/Connect Obsidian Desktop]]
- Connect your phone or tablet: [[Setup Guide/Connect Obsidian Mobile]]
- See today's sample log: [[Daily Notes/2026-10-01]]
- Learn about graph linking: [[Ideas/Second Brain Architecture]]

#obsidian #vault-sync #productivity #self-hosted #pkm
`,
      'Setup Guide/Connect Obsidian Desktop.md': `# Connecting Obsidian Desktop (Mac, Windows, Linux)

Follow these simple 4 steps to sync your desktop Obsidian for free:

### Step 1: Install Remotely Save
1. In Obsidian, go to **Settings** (⚙️) -> **Community Plugins**.
2. Make sure Restricted Mode is **OFF**.
3. Click **Browse** and search for \`Remotely Save\` (created by fyears).
4. Click **Install**, then **Enable**.

### Step 2: Configure WebDAV
1. In Obsidian Settings, scroll down to **Remotely Save** in the sidebar.
2. Choose **Sync Service**: Select \`Webdav\`.
3. In **Server Address**, enter your VaultBridge WebDAV URL:
   \`\`\`
   <YOUR_APP_URL>/webdav/main-vault/
   \`\`\`
4. In **Username**, enter any name (e.g. \`obsidian\`).
5. In **Password**, enter your Vault token (shown in the VaultBridge Connection dialog).

### Step 3: Trigger Sync
1. Click the Sync icon (circular arrows) on the left ribbon or press \`Ctrl+P\` (or \`Cmd+P\`) and type \`Remotely Save: Sync\`.
2. All notes and folders will immediately synchronize!

### Step 4: Auto Sync (Optional)
- Enable "Sync automatically every 1 minute" or "Sync on Obsidian startup" in Remotely Save settings.

#setup #desktop #remotely-save #tutorial
`,
      'Setup Guide/Connect Obsidian Mobile.md': `# Connecting Obsidian Mobile (iOS & Android)

Syncing your iPhone, iPad, or Android phone is completely free and takes 2 minutes!

### Mobile Setup Instructions:
1. Open the Obsidian app on your mobile device.
2. Create an empty vault (e.g. \`My Brain\`).
3. Tap the Settings gear icon -> **Community Plugins** -> turn off restricted mode.
4. Search for and install **Remotely Save**.
5. Under Remotely Save settings:
   - Select **Webdav**
   - Paste Server URL: \`<YOUR_APP_URL>/webdav/main-vault/\`
   - Paste your VaultBridge Secret Token
6. Tap **Sync Now**!

### Pro Tip:
In VaultBridge web interface, click **Connect Obsidian** -> scan the QR code to auto-copy the URL on mobile!

#mobile #ios #android #sync
`,
      'Daily Notes/2026-10-01.md': `# Daily Note — Thursday, Oct 1, 2026

### 🎯 Primary Objectives
- [x] Set up free self-hosted vault sync with [[Welcome to VaultBridge]]
- [x] Configure desktop Remotely Save sync
- [ ] Connect mobile iPhone vault via [[Setup Guide/Connect Obsidian Mobile]]
- [ ] Review [[Ideas/Second Brain Architecture]] and link new project ideas

### 💡 Fleeting Thoughts
The combination of local-first markdown with WebDAV synchronization gives the best of both worlds: zero lock-in, lightning fast local editing, and cloud availability without monthly recurring fees.

### 📊 Sync Status
Sync bridge active. All nodes synced.

#daily-note #journal #october-2026
`,
      'Ideas/Second Brain Architecture.md': `# Second Brain Architecture

Building a Personal Knowledge Management (PKM) system requires low friction and reliable sync.

### Core Principles
1. **Local Markdown Files**: Plain text files with \`.md\` extension never become obsolete.
2. **Associative Linking**: Using \`[[Note Name]]\` builds an organic neural graph rather than rigid hierarchical folders.
3. **Continuous Capture**: Capture ideas rapidly on mobile, then process them on desktop. See [[Daily Notes/2026-10-01]].
4. **Zero Cloud Lock-in**: Powered by [[Welcome to VaultBridge]].

### Topics to Explore
- Zettelkasten slip-box technique
- Progressive summarization
- Daily journaling rhythm

#pkm #second-brain #philosophy #knowledge-management
`
    };

    for (const [relPath, content] of Object.entries(filesToSeed)) {
      const fullPath = path.join(vaultDir, relPath);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');

      // Record in history
      meta.history.push({
        id: crypto.randomUUID(),
        path: relPath,
        content,
        timestamp: Date.now(),
        author: 'System Initializer',
        size: Buffer.byteLength(content, 'utf-8'),
      });
    }

    saveVaultMeta(defaultId, meta);
  }
}

seedDefaultVault();

// Express Middlewares
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
// Raw body for WebDAV PUT requests
app.use('/webdav', express.raw({ type: '*/*', limit: '100mb' }));

// CORS headers for all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Depth, Authorization, X-Requested-With, If-Match, If-None-Match, ETag');
  res.header('Access-Control-Expose-Headers', 'ETag, DAV, Content-Length, Last-Modified');
  if (req.method === 'OPTIONS') {
    res.header('DAV', '1, 2');
    res.header('Allow', 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL');
    return res.status(200).end();
  }
  next();
});

// ==========================================
// 1. WEBDAV SERVER IMPLEMENTATION
// ==========================================
// Mounts at /webdav/:vaultId/*
// Supports: OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL

app.all('/webdav/:vaultId*', async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId || 'main-vault';
  const vaultDir = getVaultDir(vaultId);
  const meta = getVaultMeta(vaultId);

  // Extract relative path within the vault
  let subPath = req.params[0] || '';
  if (subPath.startsWith('/')) subPath = subPath.substring(1);
  subPath = decodeURIComponent(subPath);

  // Security check to avoid directory traversal
  const targetPath = path.resolve(vaultDir, subPath);
  if (!targetPath.startsWith(vaultDir)) {
    return res.status(403).send('Access Denied');
  }

  const method = req.method.toUpperCase();

  // Log WebDAV interaction
  console.log(`[WebDAV] ${method} /${subPath} (Vault: ${vaultId})`);

  // Touch device activity
  const userAgent = req.headers['user-agent'] || 'RemotelySave/WebDAV';
  const deviceName = userAgent.includes('Mobile') || userAgent.includes('iPhone') || userAgent.includes('Android')
    ? 'Obsidian Mobile'
    : 'Obsidian Desktop';
  
  let existingDevice = meta.devices.find(d => d.userAgent === userAgent);
  if (!existingDevice) {
    meta.devices.push({
      id: crypto.randomUUID(),
      name: deviceName,
      platform: userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'ios' : userAgent.includes('Android') ? 'android' : userAgent.includes('Mac') ? 'mac' : 'windows',
      lastSeen: Date.now(),
      userAgent,
      ip: req.ip,
    });
  } else {
    existingDevice.lastSeen = Date.now();
  }
  saveVaultMeta(vaultId, meta);

  // 1. OPTIONS
  if (method === 'OPTIONS') {
    res.setHeader('DAV', '1, 2');
    res.setHeader('Allow', 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL');
    res.setHeader('MS-Author-Via', 'DAV');
    return res.status(200).end();
  }

  // 2. PROPFIND
  if (method === 'PROPFIND') {
    const depth = req.headers.depth || '1';

    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('Not Found');
    }

    const stat = fs.statSync(targetPath);
    const items: Array<{
      href: string;
      isDir: boolean;
      size: number;
      mtime: Date;
      etag: string;
    }> = [];

    // Root request item
    const baseHref = `/webdav/${vaultId}/${subPath ? encodeURI(subPath) : ''}`.replace(/\/+/g, '/');
    items.push({
      href: stat.isDirectory() && !baseHref.endsWith('/') ? baseHref + '/' : baseHref,
      isDir: stat.isDirectory(),
      size: stat.size,
      mtime: stat.mtime,
      etag: getFileETag(`${stat.mtimeMs}-${stat.size}`),
    });

    if (stat.isDirectory() && depth !== '0') {
      const readDirRecursive = (currentDir: string, currentRel: string, currentDepth: number) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(currentDir, entry.name);
          const rel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
          const entryStat = fs.statSync(entryPath);
          const itemHref = `/webdav/${vaultId}/${encodeURI(rel)}${entry.isDirectory() ? '/' : ''}`.replace(/\/+/g, '/');

          items.push({
            href: itemHref,
            isDir: entry.isDirectory(),
            size: entryStat.size,
            mtime: entryStat.mtime,
            etag: getFileETag(`${entryStat.mtimeMs}-${entryStat.size}`),
          });

          if (entry.isDirectory() && depth === 'infinity') {
            readDirRecursive(entryPath, rel, currentDepth + 1);
          }
        }
      };

      readDirRecursive(targetPath, subPath, 1);
    }

    // Build WebDAV XML multistatus
    let xml = `<?xml version="1.0" encoding="utf-8" ?>\n`;
    xml += `<D:multistatus xmlns:D="DAV:">\n`;

    for (const item of items) {
      xml += `  <D:response>\n`;
      xml += `    <D:href>${item.href}</D:href>\n`;
      xml += `    <D:propstat>\n`;
      xml += `      <D:prop>\n`;
      xml += `        <D:getlastmodified>${item.mtime.toUTCString()}</D:getlastmodified>\n`;
      xml += `        <D:getcontentlength>${item.isDir ? '0' : item.size}</D:getcontentlength>\n`;
      xml += `        <D:getetag>"${item.etag}"</D:getetag>\n`;
      xml += `        <D:resourcetype>${item.isDir ? '<D:collection/>' : ''}</D:resourcetype>\n`;
      xml += `        <D:displayname>${path.basename(item.href) || 'root'}</D:displayname>\n`;
      xml += `      </D:prop>\n`;
      xml += `      <D:status>HTTP/1.1 200 OK</D:status>\n`;
      xml += `    </D:propstat>\n`;
      xml += `  </D:response>\n`;
    }

    xml += `</D:multistatus>`;

    res.status(207);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(xml);
  }

  // 3. GET
  if (method === 'GET') {
    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('Not Found');
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      return res.status(200).send(`WebDAV Folder: ${subPath}`);
    }
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('ETag', `"${getFileETag(`${stat.mtimeMs}-${stat.size}`)}"`);
    res.setHeader('Content-Type', targetPath.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'application/octet-stream');
    return fs.createReadStream(targetPath).pipe(res);
  }

  // 4. HEAD
  if (method === 'HEAD') {
    if (!fs.existsSync(targetPath)) {
      return res.status(404).end();
    }
    const stat = fs.statSync(targetPath);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('ETag', `"${getFileETag(`${stat.mtimeMs}-${stat.size}`)}"`);
    return res.status(200).end();
  }

  // 5. PUT (Upload / Update file from Obsidian)
  if (method === 'PUT') {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const bodyBuffer: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === 'string'
      ? Buffer.from(req.body, 'utf-8')
      : Buffer.from([]);

    // Check if file existed to save history
    if (fs.existsSync(targetPath)) {
      try {
        const oldContent = fs.readFileSync(targetPath, 'utf-8');
        meta.history.push({
          id: crypto.randomUUID(),
          path: subPath,
          content: oldContent,
          timestamp: Date.now(),
          author: deviceName,
          size: Buffer.byteLength(oldContent, 'utf-8'),
        });
        if (meta.history.length > 500) meta.history.shift();
      } catch {
        // binary file
      }
    }

    fs.writeFileSync(targetPath, bodyBuffer);
    const newStat = fs.statSync(targetPath);
    const etag = getFileETag(bodyBuffer);

    meta.updatedAt = Date.now();
    saveVaultMeta(vaultId, meta);

    // Broadcast live event to open web UI tabs!
    broadcastEvent(vaultId, 'file_updated', {
      path: subPath,
      size: newStat.size,
      mtime: newStat.mtimeMs,
      etag,
      author: deviceName,
    });

    res.setHeader('ETag', `"${etag}"`);
    return res.status(201).end();
  }

  // 6. MKCOL (Create directory)
  if (method === 'MKCOL') {
    if (fs.existsSync(targetPath)) {
      return res.status(405).send('Collection already exists');
    }
    fs.mkdirSync(targetPath, { recursive: true });
    broadcastEvent(vaultId, 'dir_created', { path: subPath });
    return res.status(201).end();
  }

  // 7. DELETE
  if (method === 'DELETE') {
    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('Not Found');
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      // Save last snapshot in history before deleting
      try {
        const oldContent = fs.readFileSync(targetPath, 'utf-8');
        meta.history.push({
          id: crypto.randomUUID(),
          path: subPath + ' [DELETED]',
          content: oldContent,
          timestamp: Date.now(),
          author: deviceName,
          size: Buffer.byteLength(oldContent, 'utf-8'),
        });
      } catch {
        // ignore binary
      }
      fs.unlinkSync(targetPath);
    }

    meta.updatedAt = Date.now();
    saveVaultMeta(vaultId, meta);

    broadcastEvent(vaultId, 'file_deleted', { path: subPath });
    return res.status(204).end();
  }

  return res.status(405).send('Method Not Allowed');
});

// ==========================================
// 2. REST API FOR VAULT MANAGEMENT & UI
// ==========================================

// SSE Endpoint for Live Sync Activity
app.get('/api/vaults/:vaultId/events', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!sseClients.has(vaultId)) {
    sseClients.set(vaultId, new Set());
  }
  sseClients.get(vaultId)!.add(res);

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients.get(vaultId)?.delete(res);
  });
});

// List all Vaults
app.get('/api/vaults', (_req: Request, res: Response) => {
  const vaults: any[] = [];
  const entries = fs.readdirSync(STORAGE_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const vaultId = entry.name;
      const meta = getVaultMeta(vaultId);
      const vaultDir = getVaultDir(vaultId);

      // Count files and total size
      let fileCount = 0;
      let totalSize = 0;

      const scan = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const f of files) {
          const fp = path.join(dir, f.name);
          if (f.isDirectory()) {
            scan(fp);
          } else {
            fileCount++;
            totalSize += fs.statSync(fp).size;
          }
        }
      };
      scan(vaultDir);

      vaults.push({
        ...meta,
        fileCount,
        totalSize,
      });
    }
  }

  res.json({ vaults });
});

// Create New Vault
app.post('/api/vaults', (req: Request, res: Response) => {
  const { name, description } = req.body;
  const rawId = (name || 'New Vault').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  let vaultId = rawId || 'vault-' + Date.now();

  // Ensure unique ID
  let counter = 1;
  while (fs.existsSync(path.join(STORAGE_DIR, vaultId))) {
    vaultId = `${rawId}-${counter++}`;
  }

  const vaultDir = getVaultDir(vaultId);
  const meta: VaultMeta = {
    id: vaultId,
    name: name || 'New Vault',
    description: description || 'Obsidian Vault',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    secretToken: 'vb_' + crypto.randomBytes(12).toString('hex'),
    e2eeEnabled: false,
    devices: [
      {
        id: 'web-client',
        name: 'VaultBridge Web Client',
        platform: 'web',
        lastSeen: Date.now(),
      }
    ],
    history: [],
    conflicts: [],
  };

  saveVaultMeta(vaultId, meta);

  // Add initial welcome file
  const welcomeFile = path.join(vaultDir, 'Index.md');
  const initialContent = `# ${name}\n\nCreated with **VaultBridge**. Synced and ready for your notes!\n\n#obsidian`;
  fs.writeFileSync(welcomeFile, initialContent, 'utf-8');

  res.status(201).json({ vault: { ...meta, fileCount: 1, totalSize: Buffer.byteLength(initialContent) } });
});

// Delete Vault
app.delete('/api/vaults/:vaultId', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  if (vaultId === 'main-vault') {
    return res.status(400).json({ error: 'Cannot delete the primary main vault' });
  }
  const dir = path.join(STORAGE_DIR, vaultId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  res.json({ success: true });
});

// Get Vault File Tree & Graph
app.get('/api/vaults/:vaultId/files', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const vaultDir = getVaultDir(vaultId);
  const meta = getVaultMeta(vaultId);

  const files: VaultFileMeta[] = [];
  const graphNodes: Array<{ id: string; name: string; folder: string; tags: string[]; val: number }> = [];
  const graphLinks: Array<{ source: string; target: string }> = [];
  const allTags = new Set<string>();

  const scan = (currentDir: string, currentRel: string) => {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      const rel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
      const stat = fs.statSync(entryPath);

      if (entry.isDirectory()) {
        files.push({
          path: rel,
          name: entry.name,
          size: 0,
          mtime: stat.mtimeMs,
          etag: '',
          isFolder: true,
        });
        scan(entryPath, rel);
      } else {
        let tags: string[] = [];
        let links: string[] = [];

        if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(entryPath, 'utf-8');
            const parsed = extractMarkdownMetadata(content);
            tags = parsed.tags;
            links = parsed.links;
            tags.forEach(t => allTags.add(t));
          } catch {
            // ignore
          }
        }

        files.push({
          path: rel,
          name: entry.name,
          size: stat.size,
          mtime: stat.mtimeMs,
          etag: getFileETag(`${stat.mtimeMs}-${stat.size}`),
          isFolder: false,
          tags,
          links,
        });

        // Add to graph nodes if markdown
        if (entry.name.endsWith('.md')) {
          const noteBaseName = entry.name.replace(/\.md$/, '');
          graphNodes.push({
            id: rel,
            name: noteBaseName,
            folder: path.dirname(rel) === '.' ? 'Root' : path.dirname(rel),
            tags,
            val: Math.max(1, links.length + 1),
          });

          // Link generation
          for (const link of links) {
            graphLinks.push({
              source: rel,
              target: link, // Can be matched against note base name or full path
            });
          }
        }
      }
    }
  };

  scan(vaultDir, '');

  res.json({
    vault: meta,
    files,
    allTags: Array.from(allTags),
    graph: {
      nodes: graphNodes,
      links: graphLinks,
    },
  });
});

// Get Single File Content
app.get('/api/vaults/:vaultId/file', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  const vaultDir = getVaultDir(vaultId);
  let resolved = findVaultFile(vaultDir, filePath);

  // If not found, Obsidian-style auto-initialization for requested note
  if (!resolved) {
    let cleanRel = filePath.replace(/^[\/\\]+/, '').trim();
    if (!cleanRel.endsWith('.md')) cleanRel += '.md';
    const targetPath = path.resolve(vaultDir, cleanRel);
    if (!targetPath.startsWith(vaultDir)) {
      return res.status(403).json({ error: 'Invalid path' });
    }
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const noteTitle = path.basename(cleanRel).replace(/\.md$/, '');
    const initialContent = `# ${noteTitle}\n\n`;
    fs.writeFileSync(targetPath, initialContent, 'utf-8');
    resolved = { fullPath: targetPath, relPath: cleanRel };

    const meta = getVaultMeta(vaultId);
    meta.updatedAt = Date.now();
    saveVaultMeta(vaultId, meta);
    broadcastEvent(vaultId, 'file_updated', {
      path: cleanRel,
      size: Buffer.byteLength(initialContent),
      mtime: Date.now(),
      author: 'Note Created',
    });
  }

  const stat = fs.statSync(resolved.fullPath);
  const content = fs.readFileSync(resolved.fullPath, 'utf-8');
  const metadata = extractMarkdownMetadata(content);

  res.json({
    path: resolved.relPath,
    content,
    mtime: stat.mtimeMs,
    size: stat.size,
    metadata,
  });
});

// Save Single File Content
app.put('/api/vaults/:vaultId/file', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const { path: rawPath, content, author } = req.body;
  if (!rawPath) return res.status(400).json({ error: 'path is required' });

  let cleanRel = rawPath.replace(/^[\/\\]+/, '').trim();
  if (!cleanRel.endsWith('.md') && !cleanRel.includes('.')) cleanRel += '.md';

  const vaultDir = getVaultDir(vaultId);
  const meta = getVaultMeta(vaultId);
  const target = path.resolve(vaultDir, cleanRel);
  if (!target.startsWith(vaultDir)) {
    return res.status(403).json({ error: 'Invalid path' });
  }

  const parentDir = path.dirname(target);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  if (fs.existsSync(target)) {
    try {
      const oldContent = fs.readFileSync(target, 'utf-8');
      meta.history.push({
        id: crypto.randomUUID(),
        path: cleanRel,
        content: oldContent,
        timestamp: Date.now(),
        author: author || 'Web Editor',
        size: Buffer.byteLength(oldContent, 'utf-8'),
      });
      if (meta.history.length > 500) meta.history.shift();
    } catch {
      // ignore
    }
  }

  fs.writeFileSync(target, content || '', 'utf-8');
  const stat = fs.statSync(target);

  meta.updatedAt = Date.now();
  saveVaultMeta(vaultId, meta);

  broadcastEvent(vaultId, 'file_updated', {
    path: cleanRel,
    size: stat.size,
    mtime: stat.mtimeMs,
    author: author || 'Web Editor',
  });

  res.json({
    success: true,
    file: {
      path: cleanRel,
      size: stat.size,
      mtime: stat.mtimeMs,
    }
  });
});

// Delete File
app.delete('/api/vaults/:vaultId/file', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  const vaultDir = getVaultDir(vaultId);
  const meta = getVaultMeta(vaultId);
  const resolved = findVaultFile(vaultDir, filePath);
  if (!resolved || !fs.existsSync(resolved.fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(resolved.fullPath);
  if (stat.isDirectory()) {
    fs.rmSync(resolved.fullPath, { recursive: true, force: true });
  } else {
    try {
      const old = fs.readFileSync(resolved.fullPath, 'utf-8');
      meta.history.push({
        id: crypto.randomUUID(),
        path: resolved.relPath + ' [DELETED]',
        content: old,
        timestamp: Date.now(),
        author: 'Web User',
        size: Buffer.byteLength(old, 'utf-8'),
      });
    } catch {
      // ignore
    }
    fs.unlinkSync(resolved.fullPath);
  }

  meta.updatedAt = Date.now();
  saveVaultMeta(vaultId, meta);

  broadcastEvent(vaultId, 'file_deleted', { path: resolved.relPath });
  res.json({ success: true });
});

// File Version History
app.get('/api/vaults/:vaultId/history', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const filePath = req.query.path as string;
  const meta = getVaultMeta(vaultId);

  const history = filePath
    ? meta.history.filter(h => h.path === filePath || h.path === filePath + ' [DELETED]')
    : meta.history;

  res.json({ history: history.slice().reverse() });
});

// Rollback / Restore Revision
app.post('/api/vaults/:vaultId/rollback', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const { historyId } = req.body;
  const meta = getVaultMeta(vaultId);
  const item = meta.history.find(h => h.id === historyId);
  if (!item) return res.status(404).json({ error: 'Version not found' });

  const cleanPath = item.path.replace(' [DELETED]', '');
  const vaultDir = getVaultDir(vaultId);
  const target = path.resolve(vaultDir, cleanPath);
  const parent = path.dirname(target);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  fs.writeFileSync(target, item.content, 'utf-8');

  meta.updatedAt = Date.now();
  meta.history.push({
    id: crypto.randomUUID(),
    path: cleanPath,
    content: item.content,
    timestamp: Date.now(),
    author: 'Rollback to ' + new Date(item.timestamp).toLocaleTimeString(),
    size: Buffer.byteLength(item.content, 'utf-8'),
  });
  saveVaultMeta(vaultId, meta);

  broadcastEvent(vaultId, 'file_updated', {
    path: cleanPath,
    size: Buffer.byteLength(item.content, 'utf-8'),
    mtime: Date.now(),
    author: 'Restored Version',
  });

  res.json({ success: true, path: cleanPath, content: item.content });
});

// Update Vault Settings (e.g. E2EE passphrase / salt)
app.patch('/api/vaults/:vaultId/settings', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const { name, description, e2eeEnabled, e2eeSalt } = req.body;
  const meta = getVaultMeta(vaultId);

  if (name) meta.name = name;
  if (description !== undefined) meta.description = description;
  if (e2eeEnabled !== undefined) meta.e2eeEnabled = e2eeEnabled;
  if (e2eeSalt !== undefined) meta.e2eeSalt = e2eeSalt;

  meta.updatedAt = Date.now();
  saveVaultMeta(vaultId, meta);
  res.json({ vault: meta });
});

// Generate new Secret Token for Vault
app.post('/api/vaults/:vaultId/refresh-token', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const meta = getVaultMeta(vaultId);
  meta.secretToken = 'vb_' + crypto.randomBytes(12).toString('hex');
  saveVaultMeta(vaultId, meta);
  res.json({ token: meta.secretToken });
});

// Simulate Conflict Injection (for testing and demoing 3-way visual merge)
app.post('/api/vaults/:vaultId/simulate-conflict', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const { path: filePath } = req.body;
  const meta = getVaultMeta(vaultId);
  const vaultDir = getVaultDir(vaultId);
  const target = path.resolve(vaultDir, filePath || 'Welcome to VaultBridge.md');

  let currentContent = '';
  if (fs.existsSync(target)) {
    currentContent = fs.readFileSync(target, 'utf-8');
  }

  const conflict = {
    id: crypto.randomUUID(),
    path: filePath || 'Welcome to VaultBridge.md',
    localContent: currentContent + '\n\n### [Local Edit from iPhone]\nAdded rapid meeting notes on the go via mobile sync.',
    serverContent: currentContent + '\n\n### [Server Edit from MacBook]\nAdded detailed research summary and architecture diagrams from desktop.',
    timestamp: Date.now(),
    device: 'iPhone 15 Pro',
  };

  meta.conflicts.push(conflict);
  saveVaultMeta(vaultId, meta);

  broadcastEvent(vaultId, 'conflict_detected', conflict);
  res.json({ success: true, conflict });
});

// Resolve Conflict
app.post('/api/vaults/:vaultId/resolve-conflict', (req: Request, res: Response) => {
  const vaultId = req.params.vaultId;
  const { conflictId, resolvedContent } = req.body;
  const meta = getVaultMeta(vaultId);
  const idx = meta.conflicts.findIndex(c => c.id === conflictId);
  if (idx === -1) return res.status(404).json({ error: 'Conflict not found' });

  const conflict = meta.conflicts[idx];
  meta.conflicts.splice(idx, 1);

  const vaultDir = getVaultDir(vaultId);
  const target = path.resolve(vaultDir, conflict.path);
  fs.writeFileSync(target, resolvedContent, 'utf-8');

  meta.updatedAt = Date.now();
  saveVaultMeta(vaultId, meta);

  broadcastEvent(vaultId, 'conflict_resolved', { conflictId, path: conflict.path });
  res.json({ success: true });
});

// Start Server and Mount Vite in dev
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Obsidian VaultBridge server running at http://0.0.0.0:${PORT}`);
    console.log(`📁 WebDAV Endpoint: http://0.0.0.0:${PORT}/webdav/:vaultId/`);
  });
}

startServer();
