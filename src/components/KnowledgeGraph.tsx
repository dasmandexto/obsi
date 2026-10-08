import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Search, Sliders, Maximize2, FileText, ArrowRight } from 'lucide-react';
import type { GraphNode, GraphLink } from '../types';

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onSelectNote: (notePath: string) => void;
}

const FOLDER_COLORS: Record<string, string> = {
  Root: '#705df2',
  'Daily Notes': '#10b981',
  'Setup Guide': '#3b82f6',
  Projects: '#f59e0b',
  Ideas: '#ec4899',
  Templates: '#8b5cf6',
  Archive: '#6b7280',
};

function getFolderColor(folder: string): string {
  return FOLDER_COLORS[folder] || '#a855f7';
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  nodes: rawNodes,
  links: rawLinks,
  onSelectNote,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [repulsion, setRepulsion] = useState(120);

  // Simulation physics state
  const simNodesRef = useRef<Array<GraphNode & { x: number; y: number; vx: number; vy: number; radius: number }>>([]);
  const isDraggingRef = useRef<{ nodeIndex: number | null; startX: number; startY: number; isPan: boolean }>({
    nodeIndex: null,
    startX: 0,
    startY: 0,
    isPan: false,
  });

  // Prepare nodes with initial layout
  useEffect(() => {
    const width = 800;
    const height = 600;

    simNodesRef.current = rawNodes.map((n, i) => {
      // Preserve existing position if node was already present
      const existing = simNodesRef.current.find(en => en.id === n.id);
      if (existing) {
        return {
          ...n,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          radius: Math.max(6, Math.min(18, 6 + (n.val || 1) * 2.5)),
        };
      }

      const angle = (i / Math.max(1, rawNodes.length)) * Math.PI * 2;
      const dist = 120 + Math.random() * 150;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: Math.max(6, Math.min(18, 6 + (n.val || 1) * 2.5)),
      };
    });
  }, [rawNodes]);

  // Main Canvas Animation Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Resize canvas to match display size
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      const nodes = simNodesRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      // 1. Force Simulation Step
      const dt = 0.85; // friction / damping
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (isDraggingRef.current.nodeIndex === i) continue; // locked if dragging

        // Centering force
        a.vx += (cx - a.x) * 0.0015;
        a.vy += (cy - a.y) * 0.0015;

        // Repulsion between nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy + 100;
          const dist = Math.sqrt(distSq);
          const force = (repulsion * repulsion) / (distSq * dist);

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Link attraction forces
      for (const link of rawLinks) {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => 
          n.id === link.target || 
          n.name.toLowerCase() === link.target.toLowerCase() ||
          n.id.endsWith(link.target + '.md')
        );

        if (sourceNode && targetNode && sourceNode !== targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 90;
          const springForce = (dist - targetDist) * 0.02;

          const fx = (dx / dist) * springForce;
          const fy = (dy / dist) * springForce;

          sourceNode.vx += fx;
          sourceNode.vy += fy;
          targetNode.vx -= fx;
          targetNode.vy -= fy;
        }
      }

      // Update positions
      for (let i = 0; i < nodes.length; i++) {
        if (isDraggingRef.current.nodeIndex === i) continue;
        const node = nodes[i];
        node.vx *= dt;
        node.vy *= dt;
        node.x += node.vx;
        node.y += node.vy;
      }

      // 2. Render to Canvas
      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Pan & Zoom transform
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw subtle grid dots
      const gridSize = 40;
      ctx.fillStyle = '#181822';
      const startX = -pan.x / zoom;
      const startY = -pan.y / zoom;
      const endX = (width - pan.x) / zoom;
      const endY = (height - pan.y) / zoom;

      for (let gx = Math.floor(startX / gridSize) * gridSize; gx < endX; gx += gridSize) {
        for (let gy = Math.floor(startY / gridSize) * gridSize; gy < endY; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Links
      for (const link of rawLinks) {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => 
          n.id === link.target || 
          n.name.toLowerCase() === link.target.toLowerCase() ||
          n.id.endsWith(link.target + '.md')
        );

        if (sourceNode && targetNode) {
          const isHighlighted = hoveredNode && (hoveredNode.id === sourceNode.id || hoveredNode.id === targetNode.id);
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.strokeStyle = isHighlighted ? '#a594fd' : '#272738';
          ctx.lineWidth = isHighlighted ? 2 : 1;
          ctx.stroke();
        }
      }

      // Draw Nodes
      for (const node of nodes) {
        const isHovered = hoveredNode?.id === node.id;
        const matchesSearch = search && node.name.toLowerCase().includes(search.toLowerCase());
        const color = getFolderColor(node.folder);

        // Glow ring if hovered or matched
        if (isHovered || matchesSearch) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
          ctx.fillStyle = isHovered ? 'rgba(112, 93, 242, 0.3)' : 'rgba(234, 179, 8, 0.3)';
          ctx.fill();
        }

        // Main node body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = matchesSearch ? '#f59e0b' : color;
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#ffffff' : '#14141a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node label
        const fontSize = Math.max(10, Math.min(13, 11 / zoom));
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = isHovered ? '#ffffff' : '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, node.x, node.y + node.radius + fontSize + 2);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [rawLinks, zoom, pan, hoveredNode, search, repulsion]);

  // Mouse handlers for dragging nodes and panning canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    // Check if clicked a node
    const nodes = simNodesRef.current;
    let clickedIndex: number | null = null;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;
      if (dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4)) {
        clickedIndex = i;
        break;
      }
    }

    if (clickedIndex !== null) {
      isDraggingRef.current = {
        nodeIndex: clickedIndex,
        startX: e.clientX,
        startY: e.clientY,
        isPan: false,
      };
    } else {
      isDraggingRef.current = {
        nodeIndex: null,
        startX: e.clientX,
        startY: e.clientY,
        isPan: true,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    if (isDraggingRef.current.isPan) {
      const dx = e.clientX - isDraggingRef.current.startX;
      const dy = e.clientY - isDraggingRef.current.startY;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      isDraggingRef.current.startX = e.clientX;
      isDraggingRef.current.startY = e.clientY;
      return;
    }

    if (isDraggingRef.current.nodeIndex !== null) {
      const node = simNodesRef.current[isDraggingRef.current.nodeIndex];
      if (node) {
        node.x = mouseX;
        node.y = mouseY;
        node.vx = 0;
        node.vy = 0;
      }
      return;
    }

    // Hover detection
    const nodes = simNodesRef.current;
    let found: GraphNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;
      if (dx * dx + dy * dy <= (node.radius + 4) * (node.radius + 4)) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = {
      nodeIndex: null,
      startX: 0,
      startY: 0,
      isPan: false,
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.2, Math.min(3, prev * delta)));
  };

  const handleNodeClick = () => {
    if (hoveredNode) {
      onSelectNote(hoveredNode.id);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0e0e13] relative overflow-hidden select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Find note in graph..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#181822]/90 backdrop-blur-md border border-[#2b2b3a] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#705df2] w-48 transition-colors shadow-lg"
            />
          </div>

          {/* Node count pill */}
          <div className="px-2.5 py-1.5 rounded-lg bg-[#181822]/90 backdrop-blur-md border border-[#2b2b3a] text-xs font-mono text-zinc-300 shadow-lg">
            {rawNodes.length} Notes • {rawLinks.length} Links
          </div>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="flex items-center gap-1.5 bg-[#181822]/90 backdrop-blur-md border border-[#2b2b3a] p-1 rounded-lg pointer-events-auto shadow-lg">
          <button
            onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
            className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-[#252533] transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.2, prev * 0.8))}
            className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-[#252533] transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-[#252533] transition-colors cursor-pointer"
            title="Reset Graph Center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleNodeClick}
        className={`w-full h-full ${hoveredNode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
      />

      {/* Hovered Node Tooltip Card */}
      {hoveredNode && (
        <div className="absolute bottom-6 left-6 bg-[#161620]/95 backdrop-blur-md border border-[#2e2e42] p-3.5 rounded-xl shadow-2xl max-w-xs pointer-events-none z-20 space-y-1.5 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getFolderColor(hoveredNode.folder) }}
            />
            <h4 className="font-semibold text-xs text-white truncate">{hoveredNode.name}</h4>
          </div>
          <p className="text-[11px] text-zinc-400 font-mono truncate">{hoveredNode.id}</p>
          <div className="flex items-center gap-2 pt-1 text-[10px] text-zinc-500">
            <span>Folder: {hoveredNode.folder}</span>
            <span>•</span>
            <span className="text-[#a594fd] font-medium">Click to open note</span>
          </div>
        </div>
      )}

      {/* Bottom Folder Legend */}
      <div className="absolute bottom-4 right-4 bg-[#181822]/85 backdrop-blur-md border border-[#2b2b3a] p-2.5 rounded-xl flex items-center gap-3 text-[11px] text-zinc-300 pointer-events-none shadow-lg">
        {Object.entries(FOLDER_COLORS).slice(0, 5).map(([folder, color]) => (
          <div key={folder} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span>{folder}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
