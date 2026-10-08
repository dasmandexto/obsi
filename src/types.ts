export interface VaultFileMeta {
  path: string;
  name: string;
  size: number;
  mtime: number;
  etag: string;
  isFolder: boolean;
  tags?: string[];
  links?: string[];
}

export interface FileVersion {
  id: string;
  path: string;
  content: string;
  timestamp: number;
  author: string;
  size: number;
}

export interface SyncDevice {
  id: string;
  name: string;
  platform: 'mac' | 'windows' | 'linux' | 'ios' | 'android' | 'web';
  lastSeen: number;
  ip?: string;
  userAgent?: string;
}

export interface ConflictItem {
  id: string;
  path: string;
  localContent: string;
  serverContent: string;
  timestamp: number;
  device: string;
}

export interface VaultMeta {
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
  conflicts: ConflictItem[];
  fileCount?: number;
  totalSize?: number;
}

export interface GraphNode {
  id: string; // file path e.g. "Welcome to VaultBridge.md"
  name: string; // "Welcome to VaultBridge"
  folder: string;
  tags: string[];
  val: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface SyncLogEntry {
  id: string;
  time: string;
  type: 'sync' | 'put' | 'delete' | 'conflict' | 'connect' | 'e2ee';
  message: string;
  author?: string;
  path?: string;
}
