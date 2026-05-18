import React, { useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Node, Edge, Graph } from '../utils/algorithms';
import { AlertCircle, Shield, Building2, Zap, HardHat, Hospital, Truck } from 'lucide-react';

export interface ActiveCrew {
  id: string;
  name: string;
  nodeId?: string | null;
  x?: number;
  y?: number;
  isWorking: boolean;
}

interface GridMapProps {
  graph: Graph;
  faultNodeIds?: string[];
  shortestPath?: string[];
  affectedZones?: string[];
  onNodeClick: (nodeId: string) => void;
  isBuilderMode?: boolean;
  onBgClick?: (x: number, y: number) => void;
  onNodeRightClick?: (nodeId: string) => void;
  selectedBuilderSource?: string | null;
  onNodePositionChange?: (nodeId: string, x: number, y: number) => void;
  activeCrews?: ActiveCrew[];
}

const GridMap: React.FC<GridMapProps> = ({ graph, faultNodeIds, shortestPath, affectedZones, onNodeClick, isBuilderMode, onBgClick, onNodeRightClick, selectedBuilderSource, onNodePositionChange, activeCrews }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPointer, setLastPointer] = useState<{ x: number; y: number } | null>(null);
  const [panTravel, setPanTravel] = useState(0);

  const getIcon = (type: string) => {
    switch (type) {
      case 'depot': return <HardHat className="w-5 h-5 text-blue-500" />;
      case 'hospital': return <Hospital className="w-5 h-5 text-rose-500" />;
      case 'residential': return <Building2 className="w-5 h-5 text-violet-500" />;
      case 'industrial': return <Zap className="w-5 h-5 text-amber-500" />;
      default: return <Shield className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'depot': return '#3b82f6'; // blue-500
      case 'hospital': return '#f43f5e'; // rose-500
      case 'residential': return '#8b5cf6'; // violet-500
      case 'industrial': return '#f59e0b'; // amber-500
      default: return '#10b981'; // emerald-500
    }
  };

  const getPathEdges = () => {
    if (!shortestPath) return [];
    const edges: string[] = [];
    for (let i = 0; i < shortestPath.length - 1; i++) {
      edges.push(`${shortestPath[i]}-${shortestPath[i+1]}`);
      edges.push(`${shortestPath[i+1]}-${shortestPath[i]}`);
    }
    return edges;
  };

  const pathEdges = useMemo(getPathEdges, [shortestPath]);

  const [hoverPointer, setHoverPointer] = useState<{ x: number; y: number } | null>(null);
  const [nodeDragTravel, setNodeDragTravel] = useState(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !isBuilderMode) return;
    
    // If clicking on SVG bg (not a node)
    if (e.target === svgRef.current) {
      if ((e.target as Element).setPointerCapture) {
        (e.target as Element).setPointerCapture(e.pointerId);
      }
      setIsPanning(true);
      setPanTravel(0);
      setLastPointer({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isBuilderMode) return;
    
    let localX = 0;
    let localY = 0;
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      localX = e.clientX - rect.left - pan.x;
      localY = e.clientY - rect.top - pan.y;
      setHoverPointer({ x: localX, y: localY });
    }
    
    if (isPanning && lastPointer) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      setPanTravel(prev => prev + Math.abs(dx) + Math.abs(dy));
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPointer({ x: e.clientX, y: e.clientY });
    } else if (draggedNode && onNodePositionChange && svgRef.current && lastPointer) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      setNodeDragTravel(prev => prev + Math.abs(dx) + Math.abs(dy));
      
      const snappedX = Math.round(localX / 40) * 40;
      const snappedY = Math.round(localY / 40) * 40;
      
      onNodePositionChange(draggedNode, snappedX, snappedY);
      setLastPointer({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning && e.target === svgRef.current && panTravel < 5 && onBgClick) {
      const rect = svgRef.current.getBoundingClientRect();
      onBgClick(e.clientX - rect.left - pan.x, e.clientY - rect.top - pan.y);
    }
    
    setIsPanning(false);
    setDraggedNode(null);
    setNodeDragTravel(0);
    setLastPointer(null);
    if ((e.target as Element).releasePointerCapture) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handlePointerLeave = () => {
    setHoverPointer(null);
  };


  const handleSvgContextMenu = (e: React.MouseEvent) => {
    if (isBuilderMode) {
      e.preventDefault();
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
      <svg 
        ref={svgRef} 
        width="100%" 
        height="100%" 
        className={`touch-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:40px_40px] ${isPanning ? 'cursor-grabbing' : isBuilderMode ? 'cursor-crosshair' : ''}`}
        style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleSvgContextMenu}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Removed rect grid, using CSS radial-gradient instead */}
        <g transform={`translate(${pan.x}, ${pan.y})`}>

          {/* Builder connecting trace */}
          {isBuilderMode && selectedBuilderSource && hoverPointer && (
            <line
              x1={graph.nodes.find(n => n.id === selectedBuilderSource)?.x || 0}
              y1={graph.nodes.find(n => n.id === selectedBuilderSource)?.y || 0}
              x2={hoverPointer.x}
              y2={hoverPointer.y}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="4, 4"
              opacity="0.5"
              className="pointer-events-none"
            />
          )}

          {/* Edges */}
          {graph.edges.map((edge: any, i) => {
          const sourceNode = graph.nodes.find(n => n.id === (typeof edge.source === 'string' ? edge.source : edge.source.id));
          const targetNode = graph.nodes.find(n => n.id === (typeof edge.target === 'string' ? edge.target : edge.target.id));

          if (!sourceNode || !targetNode) return null;

          const isPath = pathEdges.includes(`${sourceNode.id}-${targetNode.id}`);
          const isAffectedEdge = !isPath && affectedZones?.includes(sourceNode.id) && affectedZones?.includes(targetNode.id);
          
          return (
            <g key={`edge-${sourceNode.id}-${targetNode.id}-${i}`}>
              <line
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isPath ? '#22c55e' : isAffectedEdge ? '#f97316' : '#cbd5e1'}
                strokeWidth={isPath ? 6 : isAffectedEdge ? 4 : 3}
                opacity={isPath ? 0.9 : isAffectedEdge ? 0.8 : 0.6}
                strokeLinecap="round"
              />
              {/* Animated dash line overlay */}
              {(isPath || isAffectedEdge) && (
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={isPath ? '#ffffff' : '#ffedd5'}
                  strokeWidth={isPath ? 3 : 2}
                  strokeDasharray={isAffectedEdge ? "4, 8" : "6, 12"}
                  opacity={isPath ? 1 : 0.8}
                  className={isPath ? 'animate-flow-fast' : 'animate-flow-slow'}
                  strokeLinecap="round"
                />
              )}
            </g>
          );
        })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
          const isFault = faultNodeIds?.includes(node.id);
          const isAffected = affectedZones?.includes(node.id);
          const isPath = shortestPath?.includes(node.id);
          const isSelectedSrc = isBuilderMode && selectedBuilderSource === node.id;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x || 0},${node.y || 0})`}
              className={`group ${draggedNode === node.id ? 'opacity-80' : isBuilderMode ? 'cursor-grab active:cursor-grabbing hover:scale-105 transition-transform' : 'cursor-pointer'}`}
              onPointerDown={(e) => {
                if (isBuilderMode && e.button === 0) {
                  e.stopPropagation();
                  setDraggedNode(node.id);
                  setNodeDragTravel(0);
                  setLastPointer({ x: e.clientX, y: e.clientY });
                  if (e.target instanceof Element && e.target.setPointerCapture) {
                    e.target.setPointerCapture(e.pointerId);
                  }
                }
              }}
              onPointerUp={(e) => {
                if (draggedNode === node.id) {
                  e.stopPropagation();
                  if (nodeDragTravel < 5) {
                    onNodeClick(node.id);
                  }
                  setDraggedNode(null);
                  setNodeDragTravel(0);
                  if (e.target instanceof Element && e.target.releasePointerCapture) {
                    try {
                      e.target.releasePointerCapture(e.pointerId);
                    } catch(err) {}
                  }
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isBuilderMode) {
                  onNodeClick(node.id);
                }
              }}
              onContextMenu={(e) => {
                if (isBuilderMode && onNodeRightClick) {
                  e.preventDefault();
                  e.stopPropagation();
                  onNodeRightClick(node.id);
                }
              }}
            >
              <circle
                r="18"
                fill="#ffffff"
                stroke={isFault ? '#ef4444' : isAffected ? '#f97316' : isPath ? '#22c55e' : isSelectedSrc ? '#3b82f6' : getNodeColor(node.type)}
                strokeWidth={isSelectedSrc ? "3" : isFault || isAffected || isPath ? "3" : "2"}
                strokeDasharray={isSelectedSrc ? "4,2" : "0"}
                style={{ filter: 'url(#shadow)' }}
                className="transition-all duration-300"
              />
              <foreignObject x="-10" y="-10" width="20" height="20" style={{ pointerEvents: 'none' }}>
                <div className="flex items-center justify-center w-full h-full">
                  {isFault ? <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" /> : getIcon(node.type)}
                </div>
              </foreignObject>
              
              <text
                y="34"
                textAnchor="middle"
                className="text-[10px] font-mono select-none font-bold"
                fill={isFault ? '#ef4444' : isAffected ? '#f97316' : isPath ? '#22c55e' : isSelectedSrc ? '#3b82f6' : '#475569'}
                style={{ pointerEvents: 'none' }}
              >
                {node.name}
              </text>
            </g>
          );
        })}

        {/* Crews */}
        {activeCrews?.map((crew, idx) => {
          let cx = crew.x;
          let cy = crew.y;
          
          if (cx === undefined || cy === undefined) {
             if (!crew.nodeId) return null;
             const targetNode = graph.nodes.find(n => n.id === crew.nodeId);
             if (!targetNode) return null;
             cx = targetNode.x || 0;
             cy = targetNode.y || 0;
          }

          const offsetX = (idx - 1) * 16;
          const offsetY = -28;

          return (
            <motion.g
              key={crew.id}
              initial={false}
              animate={{
                x: cx + offsetX,
                y: cy + offsetY
              }}
              transition={{ type: "spring", stiffness: 60, damping: 15 }}
              className="pointer-events-none"
            >
              <rect x="-14" y="-12" width="28" height="24" rx="6" fill="#3b82f6" className="drop-shadow-md" />
              <foreignObject x="-10" y="-10" width="20" height="20" className="flex items-center justify-center">
                <Truck className={`w-5 h-5 text-white ${crew.isWorking ? 'animate-bounce text-amber-300' : 'opacity-90'}`} />
              </foreignObject>
              <text y="-16" textAnchor="middle" className="text-[9px] font-bold fill-blue-700 drop-shadow-sm">
                {crew.name}
              </text>
            </motion.g>
          );
        })}

        </g>
      </svg>


      {/* Legend & Info Overlay */}
      <div className="absolute top-4 left-4 p-4 bg-white/90 border border-slate-200 rounded-lg shadow-sm backdrop-blur-md pointer-events-none">
        <h3 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-widest">Grid Status</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
            <span className="text-[10px] text-slate-600 font-bold">Active Fault</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
            <span className="text-[10px] text-slate-600 font-bold">Affected Zone (DFS)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" />
            <span className="text-[10px] text-slate-600 font-bold">Optimization Path (BFS)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GridMap;
