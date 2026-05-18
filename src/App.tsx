/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  Zap, 
  Play, 
  RotateCcw, 
  Settings2, 
  Activity, 
  Terminal, 
  Database,
  Cpu,
  ShieldAlert,
  Ghost,
  Link,
  Info,
  Clock,
  Building2,
  HardHat,
  Hospital,
  AlertTriangle,
  Pause,
  SkipBack
} from 'lucide-react';
import GridMap from './components/GridMap';
import SchedulerUI from './components/SchedulerUI';
import { 
  Graph, 
  Node, 
  Edge, 
  findShortestPath, 
  findAffectedZones, 
  simulateDispatch, 
  FaultTask, 
  Crew, 
  GanttEntry,
  findShortestPathBFS,
  findShortestPathBruteForce
} from './utils/algorithms';
import { ActiveCrew } from './components/GridMap';

const INITIAL_NODES: Node[] = [
  // DEPOTS
  { id: 'd1', name: 'West Depot', type: 'depot', x: 150, y: 150 },
  { id: 'd2', name: 'East Depot', type: 'depot', x: 800, y: 150 },
  { id: 'd3', name: 'South Depot', type: 'depot', x: 475, y: 550 },

  // HOSPITALS
  { id: 'h1', name: 'Central Hospital', type: 'hospital', x: 475, y: 250 },
  { id: 'h2', name: 'East Med Center', type: 'hospital', x: 800, y: 350 },

  // RESIDENTIAL ZONES
  { id: 'r1', name: 'North West Res', type: 'residential', x: 300, y: 150 },
  { id: 'r2', name: 'West Suburbs', type: 'residential', x: 250, y: 300 },
  { id: 'r3', name: 'Downtown Living', type: 'residential', x: 350, y: 350 },
  { id: 'r4', name: 'East Side Res', type: 'residential', x: 650, y: 250 },
  { id: 'r5', name: 'South East Res', type: 'residential', x: 700, y: 450 },
  { id: 'r6', name: 'South West Res', type: 'residential', x: 300, y: 450 },

  // INDUSTRIAL ZONES
  { id: 'i1', name: 'North Ind Park', type: 'industrial', x: 600, y: 150 },
  { id: 'i2', name: 'Far West Plant', type: 'industrial', x: 100, y: 350 },
  { id: 'i3', name: 'East Tech Hub', type: 'industrial', x: 850, y: 250 },
  { id: 'i4', name: 'Central Power', type: 'industrial', x: 550, y: 400 },
];

const INITIAL_EDGES: Edge[] = [
  // Connect D1
  { source: 'd1', target: 'r1' },
  { source: 'd1', target: 'r2' },
  { source: 'd1', target: 'i2' },
  
  // Connect D2
  { source: 'd2', target: 'i1' },
  { source: 'd2', target: 'r4' },
  { source: 'd2', target: 'i3' },

  // Connect D3
  { source: 'd3', target: 'r6' },
  { source: 'd3', target: 'i4' },
  { source: 'd3', target: 'r5' },

  // Connect Hospitals
  { source: 'h1', target: 'r1' },
  { source: 'h1', target: 'r3' },
  { source: 'h1', target: 'r4' },
  { source: 'h1', target: 'i1' },
  
  { source: 'h2', target: 'i3' },
  { source: 'h2', target: 'r5' },
  { source: 'h2', target: 'i4' },

  // Cross Connections
  { source: 'r2', target: 'i2' },
  { source: 'r2', target: 'r6' },
  { source: 'r2', target: 'r3' },
  
  { source: 'r3', target: 'r6' },
  { source: 'r3', target: 'i4' },
  
  { source: 'r4', target: 'i4' },
  { source: 'r4', target: 'h2' },
  { source: 'r4', target: 'i3' },
  
  { source: 'r5', target: 'i4' },
];

export default function App() {
  const [graph, setGraph] = useState<Graph>({ nodes: INITIAL_NODES, edges: INITIAL_EDGES });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [faults, setFaults] = useState<FaultTask[]>([]);
  const [simResults, setSimResults] = useState<{ gantt: GanttEntry[]; updatedFaults: FaultTask[]; crews?: Crew[] } | null>(null);
  const [mode, setMode] = useState<'build' | 'simulate'>('build');
  const [selectedBuildingType, setSelectedBuildingType] = useState<Node['type']>('residential');
  const [logs, setLogs] = useState<string[]>(["[SYSTEM] Booting PacketPath Sequencer...", "[SYSTEM] Grid connection: SECURE"]);
  
  const [simTime, setSimTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const activeCrews = useMemo<ActiveCrew[]>(() => {
    if (!simResults || !simResults.crews) return [];
    
    return simResults.crews.map(crew => {
      // Find the active task for this crew at current simTime
      const activeTask = simResults.gantt.find(
        g => g.crewId === crew.id && simTime >= g.start && simTime < g.end
      );
      
      let x: number | undefined;
      let y: number | undefined;
      let nodeId: string | null = null;
      let isWorking = false;
      
      let currentPath: string[] | undefined;
      
      if (activeTask) {
        if (activeTask.type === 'travel' && activeTask.path) {
          currentPath = activeTask.path;
          // Interpolate along the path
          const progress = (simTime - activeTask.start) / (activeTask.end - activeTask.start);
          const totalEdges = activeTask.path.length - 1;
          const currentEdgeIndex = Math.min(Math.floor(progress * totalEdges), totalEdges - 1);
          const edgeProgress = (progress * totalEdges) - currentEdgeIndex;
          
          if (totalEdges > 0) {
            const startNode = graph.nodes.find(n => n.id === activeTask.path![currentEdgeIndex]);
            const endNode = graph.nodes.find(n => n.id === activeTask.path![currentEdgeIndex + 1]);
            if (startNode && endNode && startNode.x !== undefined && startNode.y !== undefined && endNode.x !== undefined && endNode.y !== undefined) {
              x = startNode.x + (endNode.x - startNode.x) * edgeProgress;
              y = startNode.y + (endNode.y - startNode.y) * edgeProgress;
            }
          }
        } else if (activeTask.type === 'repair') {
          isWorking = true;
          const fault = faults.find(f => f.id === activeTask.taskId);
          if (fault) nodeId = fault.substationId;
        }
      } else {
        // Either hasn't started yet, or finished. 
        // Find the last completed task.
        const pastTasks = simResults.gantt.filter(
          g => g.crewId === crew.id && g.end <= simTime
        ).sort((a, b) => b.end - a.end);
        
        if (pastTasks.length > 0) {
          const lastTask = pastTasks[0];
          if (lastTask.type === 'travel' && lastTask.path) {
             nodeId = lastTask.path[lastTask.path.length - 1];
          } else {
             const fault = faults.find(f => f.id === lastTask.taskId);
             if (fault) nodeId = fault.substationId;
          }
        } else {
          nodeId = crew.startNodeId || null;
        }
      }
      
      return {
        id: crew.id,
        name: crew.name,
        nodeId,
        x,
        y,
        isWorking,
        currentPath
      };
    });
  }, [simResults, simTime, faults, graph.nodes]);

  useEffect(() => {
    let interval: number;
    if (isPlaying && simResults) {
      interval = window.setInterval(() => {
        setSimTime(prev => {
          const maxTime = Math.max(...simResults.gantt.map(g => g.end), 10);
          if (prev >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return prev + 0.25; // advance 0.25 time units per tick
        });
      }, 250); // 4 ticks per second
    }
    return () => clearInterval(interval);
  }, [isPlaying, simResults]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  }, []);

  const handleNodeClick = (id: string) => {
    if (mode === 'simulate') {
      setSelectedNodeId(id);
      addLog(`Focusing Substation: ${id}`);
    } else {
      if (selectedNodeId && selectedNodeId !== id) {
        // Toggle edge
        const exists = graph.edges.find(e => 
          (e.source === selectedNodeId && e.target === id) || 
          (e.source === id && e.target === selectedNodeId)
        );
        if (exists) {
          setGraph(prev => ({ 
             ...prev, 
             edges: prev.edges.filter(e => e !== exists) 
          }));
          addLog(`High-Voltage Link severed: ${selectedNodeId} <-> ${id}`);
        } else {
          setGraph(prev => ({ ...prev, edges: [...prev.edges, { source: selectedNodeId, target: id }] }));
          addLog(`High-Voltage Link established: ${selectedNodeId} <-> ${id}`);
        }
        setSelectedNodeId(null);
      } else if (selectedNodeId === id) {
        setSelectedNodeId(null); // deselect if clicking the same node
      } else {
        setSelectedNodeId(id);
        addLog(`Focusing Substation: ${id}`);
      }
    }
  };

  const handleCycleNodeType = (id: string) => {
    const types: Node['type'][] = ['residential', 'industrial', 'hospital', 'depot'];
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => {
        if (n.id === id) {
          const currentIdx = types.indexOf(n.type);
          const nextType = types[(currentIdx + 1) % types.length];
          addLog(`Reconfigured Node ${n.name} to ${nextType.toUpperCase()}`);
          return { ...n, type: nextType };
        }
        return n;
      })
    }));
  };

  const handleBgClick = (x: number, y: number) => {
    if (mode !== 'build') return;
    const snappedX = Math.round(x / 40) * 40;
    const snappedY = Math.round(y / 40) * 40;
    
    // check if node already exists there
    if (graph.nodes.find(n => n.x === snappedX && n.y === snappedY)) return;

    const id = (Math.max(0, ...graph.nodes.map(n => parseInt(n.id) || 0)) + 1).toString();
    const newNode: Node = {
      id,
      name: `S-${id}`,
      type: selectedBuildingType,
      x: snappedX,
      y: snappedY
    };
    setGraph(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    addLog(`Deployed Substation ${newNode.name} at coordinates (${snappedX}, ${snappedY}).`);
  };

  const handleDeleteNode = (id: string) => {
    setGraph(prev => ({
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id)
    }));
    setFaults(prev => prev.filter(f => f.substationId !== id));
    setSelectedNodeId(null);
    addLog(`Decommissioned Substation: ${id}`);
  };

  const recalculateSimulation = (currentFaults: FaultTask[], newFaults: FaultTask[]) => {
    const combinedFaults = [...currentFaults, ...newFaults];
    setFaults(combinedFaults);
    
    // Spawn crews at depots
    const depots = graph.nodes.filter(n => n.type === 'depot');
    const crews: Crew[] = depots.map((d, i) => ({
      id: `c${i + 1}`,
      name: `Crew ${d.name || d.id}`,
      busy: false,
      startNodeId: d.id
    }));
    
    if (crews.length === 0) {
      crews.push({ id: 'c1', name: 'Emergency Crew', busy: false, startNodeId: graph.nodes[0].id });
    }

    const results = simulateDispatch(graph, combinedFaults, crews);
    setSimResults({ gantt: results.gantt, updatedFaults: results.updatedFaults, crews });
  };

  const handleInjectFault = (id: string, isCritical: boolean = false) => {
    const node = graph.nodes.find(n => n.id === id);
    if (!node || node.type === 'depot') {
      addLog("PROTECTED: Depots cannot be faulted.");
      return;
    }

    const isSimulating = mode === 'simulate';
    const arrival = isSimulating ? simTime : faults.length * 2;
    // Boost severity if it's explicitly 'critical' or a hospital
    const newFault: FaultTask = {
      id: `task-${Date.now()}`,
      substationId: id,
      severity: isCritical ? 20 : (node.type === 'hospital' ? 10 : 5),
      arrivalTime: arrival,
      burstTime: 5 + Math.floor(Math.random() * 5),
      remainingTime: 0,
    };

    if (isSimulating) {
      recalculateSimulation(faults, [newFault]);
    } else {
      setFaults(prev => [...prev, newFault]);
    }
    addLog(`${isCritical ? 'CRITICAL ' : ''}ALERT: Fault detected at ${node.name}! Severity: ${newFault.severity}`);
  };

  const handleNodePositionChange = (id: string, x: number, y: number) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === id ? { ...n, x, y } : n)
    }));
  };

  const runSimulation = () => {
    if (faults.length === 0) {
      addLog("ERROR: No active fault tasks in buffer.");
      return;
    }

    setMode('simulate');
    setSelectedNodeId(null);
    
    // Spawn crews at depots
    const depots = graph.nodes.filter(n => n.type === 'depot');
    const crews: Crew[] = depots.map((d, i) => ({
      id: `c${i + 1}`,
      name: `Crew ${d.name || d.id}`,
      busy: false,
      startNodeId: d.id
    }));
    
    // Fallback if no depots
    if (crews.length === 0) {
      crews.push({
        id: 'c1',
        name: 'Emergency Crew',
        busy: false,
        startNodeId: graph.nodes[0].id
      });
    }

    const results = simulateDispatch(graph, faults, crews);
    setSimResults({ gantt: results.gantt, updatedFaults: results.updatedFaults, crews }); // Save crews into results if needed or just use results
    setSimTime(0);
    setIsPlaying(true);
    addLog(`OS Engine: Dispatching ${crews.length} crews to resolve ${faults.length} faults.`);
  };

  const resetAll = () => {
    setGraph({ nodes: INITIAL_NODES, edges: INITIAL_EDGES });
    setFaults([]);
    setSimResults(null);
    setMode('build');
    addLog("FACTORY RESET: Topology wiped.");
  };

  // DAA Calculations
  const latestFaultId = faults.length > 0 ? faults[faults.length - 1].substationId : null;
  const closestDepot = useMemo(() => {
    if (!latestFaultId) return null;
    return graph.nodes.filter(n => n.type === 'depot')[0]?.id; // Simple pick for demo
  }, [latestFaultId, graph.nodes]);

  const bfsResult = useMemo(() => {
    if (!latestFaultId || !closestDepot) return null;
    return findShortestPathBFS(graph, closestDepot, latestFaultId);
  }, [graph, latestFaultId, closestDepot]);

  const bruteForceResult = useMemo(() => {
    if (!latestFaultId || !closestDepot) return null;
    return findShortestPathBruteForce(graph, closestDepot, latestFaultId);
  }, [graph, latestFaultId, closestDepot]);

  const shortestPath = bfsResult?.path || undefined;

  const affectedZones = useMemo(() => {
    if (!latestFaultId) return undefined;
    return findAffectedZones(graph, latestFaultId);
  }, [graph, latestFaultId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-blue-500/30 font-sans">
      {/* HUD Header */}
      <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg shadow-sm">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 italic">Grid Builder: Logic Sequencer</h1>
            <p className="text-[9px] text-slate-500 font-mono tracking-widest">CITY_OS VERSION 4.1.2 // CREATIVE MODE</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 shadow-inner">
            <button 
              onClick={() => {
                setMode('build');
                setSelectedNodeId(null);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shadow-sm ${
                mode === 'build' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-blue-600 hover:bg-white'
              }`}
            >
              <Settings2 className="w-3 h-3" />
              BUILD_MODE
            </button>
            <button 
              onClick={() => {
                setMode('simulate');
                setSelectedNodeId(null);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shadow-sm ${
                mode === 'simulate' ? 'bg-fuchsia-500 text-white' : 'text-slate-500 hover:text-fuchsia-600 hover:bg-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              SEQ_ENGINE
            </button>
          </div>
          <button 
            onClick={resetAll}
            className="p-2 hover:bg-red-50 rounded transition-colors group"
          >
            <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
          </button>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto p-6 grid grid-cols-12 gap-6 h-[calc(100vh-100px)]">
        {/* Left Column: Command Center */}
        <aside className="col-span-3 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
          {/* Main Module - Changes by Mode */}
          {mode === 'build' ? (
          <section className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
            <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
              <Database className="w-4 h-4" /> CONSTRUCTION_TOOLKIT
            </h2>
            
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'residential', icon: Building2, color: 'text-violet-500', bg: 'bg-violet-50 border-violet-200' },
                { type: 'industrial', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
                { type: 'hospital', label: 'critical', icon: Hospital, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-200' },
                { type: 'depot', icon: HardHat, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' }
              ].map(b => (
                <button
                  key={b.type}
                  onClick={() => {
                    setSelectedBuildingType(b.type as Node['type']);
                    if (selectedNodeId) {
                      setGraph(prev => ({
                        ...prev,
                        nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, type: b.type as Node['type'] } : n)
                      }));
                      addLog(`Reconfigured Node to ${b.label?.toUpperCase() || b.type.toUpperCase()}`);
                    }
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    selectedBuildingType === b.type 
                      ? `${b.bg} ring-2 ring-blue-500 ring-offset-1 scale-[0.98]` 
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 grayscale hover:grayscale-0'
                  }`}
                >
                  <b.icon className={`w-5 h-5 ${b.color}`} />
                  <span className="text-[9px] font-bold text-slate-700 uppercase">{b.label || b.type}</span>
                </button>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
              <p className="text-[10px] text-slate-500 font-medium text-center">
                Select a type and click on the grid to place. <br/>
                Drag grid to pan. Drag nodes to move.<br/>
                Right-click a node to cycle type.<br/>
                Click a node then another to link them.
              </p>
            </div>

            {selectedNodeId ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-4"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-orange-600 uppercase">Selected: {graph.nodes.find(n => n.id === selectedNodeId)?.name || `Node ${selectedNodeId}`}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteNode(selectedNodeId)} className="p-1 hover:text-red-600 text-slate-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleInjectFault(selectedNodeId, false)}
                    className="w-full py-2 bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded hover:bg-slate-200 transition-all shadow-sm"
                  >
                    Standard Fault
                  </button>
                  <button 
                    onClick={() => handleInjectFault(selectedNodeId, true)}
                    className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded hover:from-orange-400 hover:to-red-400 transition-all shadow-sm"
                  >
                    Critical Fault
                  </button>
                  <p className="col-span-2 text-[9px] text-slate-500 text-center italic mt-1">
                    Tip: Select another node to bridge a connection.
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="p-4 border border-dashed border-slate-300 bg-slate-50 rounded-lg text-center">
                <Info className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-[10px] text-slate-500">Pick a substation on the map to modify or link.</p>
              </div>
            )}
          </section>
          ) : (
          <section className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
            <h2 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> INCIDENT_COMMAND
            </h2>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg shadow-inner">
              <p className="text-[10px] text-slate-700 font-medium text-center">
                Select a node to inject or manage faults.<br/>
                Set priorities before running the sequence.
              </p>
            </div>

            {selectedNodeId ? (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-orange-600 uppercase">
                    Target: {graph.nodes.find(n => n.id === selectedNodeId)?.name}
                  </span>
                </div>
                
                {(() => {
                  const existingFault = faults.find(f => f.substationId === selectedNodeId);
                  if (existingFault) {
                    return (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-600">Severity/Priority:</span>
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">{existingFault.severity}</span>
                          </div>
                          <input 
                            type="range" min="1" max="10" 
                            value={existingFault.severity}
                            onChange={(e) => {
                              setFaults(prev => prev.map(f => f.id === existingFault.id ? { ...f, severity: parseInt(e.target.value) } : f));
                            }}
                            className="w-full accent-rose-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-600">Burst Time (Size):</span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{existingFault.burstTime}</span>
                          </div>
                          <input 
                            type="range" min="1" max="20" 
                            value={existingFault.burstTime}
                            onChange={(e) => {
                              setFaults(prev => prev.map(f => f.id === existingFault.id ? { ...f, burstTime: parseInt(e.target.value) } : f));
                            }}
                            className="w-full accent-blue-500"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            setFaults(prev => prev.filter(f => f.id !== existingFault.id));
                            setSimResults(null);
                          }}
                          className="w-full py-2 bg-red-100 text-red-600 text-[10px] font-bold uppercase rounded hover:bg-red-200 transition-colors border border-red-200"
                        >
                          Clear Fault
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleInjectFault(selectedNodeId, false)}
                          className="w-full py-3 bg-slate-100 border border-slate-300 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded hover:bg-slate-200 transition-all shadow-sm"
                        >
                          Stand. Fault
                        </button>
                        <button 
                          onClick={() => handleInjectFault(selectedNodeId, true)}
                          className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded hover:from-orange-400 hover:to-red-400 transition-all shadow-sm"
                        >
                          Crit. Fault
                        </button>
                      </div>
                    );
                  }
                })()}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-slate-300 bg-slate-50 rounded-lg text-center">
                <Info className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-[10px] text-slate-500">Pick a substation on the map to manage.</p>
              </div>
            )}
          </section>
          )}

          {/* Engine Status */}
          <section className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
            <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
              <Cpu className="w-4 h-4" /> PROCESS_ENGINE
            </h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center">
                <p className="text-[9px] text-amber-600 uppercase font-mono">Tasks</p>
                <p className="text-lg font-black text-amber-500">{faults.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-center">
                <p className="text-[9px] text-blue-600 uppercase font-mono">Topology</p>
                <p className="text-lg font-black text-blue-500">{graph.nodes.length}n</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-2">
              <button 
                onClick={runSimulation}
                disabled={faults.length === 0}
                className="col-span-2 h-12 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 transition-all text-white font-black uppercase tracking-widest text-[11px] rounded-xl shadow-md disabled:shadow-none flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-current" />
                RUN SEQUENCER
              </button>
              
              <button 
                onClick={() => {
                  setGraph({ nodes: INITIAL_NODES, edges: INITIAL_EDGES });
                  // Inject 3 random faults generator
                  const validNodes = INITIAL_NODES.filter(n => n.type !== 'depot');
                  const shuffled = [...validNodes].sort(() => 0.5 - Math.random());
                  const targets = shuffled.slice(0, 3);
                  
                  const demoFaults: FaultTask[] = targets.map((node, i) => ({
                    id: `f${Date.now()}-${i}`,
                    substationId: node.id,
                    severity: node.type === 'hospital' ? 20 : (Math.floor(Math.random() * 10) + 5),
                    arrivalTime: i, // slightly staggered or could be 0
                    burstTime: 4 + Math.floor(Math.random() * 6),
                    remainingTime: 0,
                  })).map(f => ({ ...f, remainingTime: f.burstTime }));
                  
                  if (mode === 'simulate') {
                    // Spawn crews at depots based on INITIAL_NODES
                    const depots = INITIAL_NODES.filter(n => n.type === 'depot');
                    const crews: Crew[] = depots.map((d, i) => ({
                      id: `c${i + 1}`,
                      name: `Crew ${d.name || d.id}`,
                      busy: false,
                      startNodeId: d.id
                    }));
                    if (crews.length === 0) {
                      crews.push({ id: 'c1', name: 'Emergency Crew', busy: false, startNodeId: INITIAL_NODES[0].id });
                    }
                    const simGraph = { nodes: INITIAL_NODES, edges: INITIAL_EDGES };
                    const results = simulateDispatch(simGraph, demoFaults, crews);
                    setFaults(demoFaults);
                    setSimResults({ gantt: results.gantt, updatedFaults: results.updatedFaults, crews });
                  } else {
                    setFaults(demoFaults);
                  }
                  
                  addLog("DEMO: 3 random simultaneous faults injected across Grid.");
                }}
                className="col-span-2 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-all font-bold uppercase tracking-widest text-[9px] rounded flex items-center justify-center gap-2"
              >
                <Database className="w-3 h-3" />
                Inject 3x Random Demo
              </button>
            </div>
          </section>

          {/* Terminal Logs */}
          <section className="bg-slate-800 rounded-xl flex-grow overflow-hidden flex flex-col shadow-inner border border-slate-700">
            <div className="p-3 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">IO_TERMINAL</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            </div>
            <div className="p-4 font-mono text-[10px] space-y-2 overflow-y-auto custom-scrollbar flex-grow bg-slate-950 text-slate-300">
              {logs.map((log, i) => (
                <div key={i} className={i === 0 ? "text-emerald-400" : "text-slate-400"}>
                  <span className="opacity-40 mr-2">[{i}]</span>
                  {log}
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Center/Right: Visual Canvas */}
        <div className="col-span-9 h-full flex flex-col gap-6">
          <div className={`${mode === 'simulate' ? 'h-1/2' : 'flex-grow'} transition-all duration-500 ease-in-out min-h-0 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden relative flex flex-col`}>
            <GridMap 
              graph={graph}
              onNodeClick={handleNodeClick}
              faultNodeIds={faults.map(f => f.substationId)}
              affectedZones={affectedZones}
              isBuilderMode={mode === 'build'}
              selectedBuilderSource={selectedNodeId}
              onBgClick={handleBgClick}
              onNodeRightClick={handleCycleNodeType}
              onNodePositionChange={handleNodePositionChange}
              activeCrews={activeCrews}
            />
          </div>

          <AnimatePresence>
            {mode === 'simulate' && (
              <motion.div 
                key="results"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: '50%' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-y-auto custom-scrollbar flex-shrink-0"
              >
                {simResults ? (
                  <div className="space-y-6">
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                          Playback: T+{Math.floor(simTime)}s
                        </h3>
                        <div className="flex bg-slate-100 rounded-lg p-1">
                          <button 
                            onClick={() => setSimTime(0)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                          >
                            <SkipBack className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`p-1.5 px-3 rounded shadow-sm text-white font-bold transition-colors flex items-center gap-2 ${isPlaying ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                          >
                            {isPlaying ? <><Pause className="w-3 h-3"/> PAUSE</> : <><Play className="w-3 h-3"/> PLAY</>}
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        Total Time: {Math.max(...simResults.gantt.map(g => g.end), 10)}s
                      </div>
                    </div>
                    <SchedulerUI 
                      gantt={simResults.gantt}
                      faults={simResults.updatedFaults}
                      crews={simResults.crews || []}
                      currentTime={simTime}
                    />
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-white border border-blue-200 shadow-sm rounded-xl p-5">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase mb-2">Algorithm: BFS (Shortest)</h4>
                        <p className="text-xs text-slate-600 font-mono mb-2">
                          Hops: {bfsResult?.path ? bfsResult.path.length - 1 : 0}<br/>
                          Iterations: <span className="text-blue-600 font-bold">{bfsResult?.iterations || 0}</span>
                        </p>
                        <p className="text-[9px] text-slate-400 italic">O(V + E) Optimal for unweighted grids.</p>
                      </div>
                      <div className="bg-white border border-purple-200 shadow-sm rounded-xl p-5">
                        <h4 className="text-[10px] font-black text-purple-600 uppercase mb-2">Algorithm: Brute Force</h4>
                        <p className="text-xs text-slate-600 font-mono mb-2">
                          Hops: {bruteForceResult?.path ? bruteForceResult.path.length - 1 : 0}<br/>
                          Iterations: <span className="text-purple-600 font-bold">{bruteForceResult?.iterations || 0}</span>
                        </p>
                        <p className="text-[9px] text-slate-400 italic">O(V!) Exhaustive search scale issue.</p>
                      </div>
                      <div className="bg-white border border-orange-200 shadow-sm rounded-xl p-5">
                        <h4 className="text-[10px] font-black text-orange-600 uppercase mb-2">Zone Ripple Impact (DFS)</h4>
                        <p className="text-xs text-slate-600 font-mono mb-2">
                          Mapped Nodes: <span className="text-orange-600 font-bold">{affectedZones?.length || 0}</span>
                        </p>
                        <p className="text-[9px] text-slate-400 italic">Identifies full impact tree structure.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border border-slate-200 border-dashed rounded-xl bg-slate-50">
                    <Ghost className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">No simulation artifacts present.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* DAA + OS Quick Reference */}
          <footer className="grid grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
              <div className="p-2 bg-blue-50 rounded text-blue-500">
                <Link className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">BFS Engine</p>
                <p className="text-[9px] text-slate-500 italic">Shortest path optimization</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
              <div className="p-2 bg-orange-50 rounded text-orange-500">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">DFS Tracer</p>
                <p className="text-[9px] text-slate-500 italic">Graph reachability mapping</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex items-center gap-4">
              <div className="p-2 bg-emerald-50 rounded text-emerald-500">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">Round Robin</p>
                <p className="text-[9px] text-slate-500 italic">Multitasking OS kernel</p>
              </div>
            </div>
          </footer>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}
