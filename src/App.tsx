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
  simulateRoundRobin, 
  FaultTask, 
  Crew, 
  GanttEntry,
  findShortestPathBFS,
  findShortestPathBruteForce
} from './utils/algorithms';
import { ActiveCrew } from './components/GridMap';

const INITIAL_NODES: Node[] = [
  { id: '1', name: 'Alpha Depot', type: 'depot', x: 120, y: 120 },
  { id: '2', name: 'Beta Depot', type: 'depot', x: 600, y: 120 },
  { id: '3', name: 'City Hospital', type: 'hospital', x: 360, y: 240 },
  { id: '4', name: 'Res-A', type: 'residential', x: 240, y: 360 },
  { id: '5', name: 'Ind-B', type: 'industrial', x: 480, y: 360 },
];

const INITIAL_EDGES: Edge[] = [
  { source: '1', target: '4' },
  { source: '4', target: '3' },
  { source: '2', target: '5' },
];

export default function App() {
  const [graph, setGraph] = useState<Graph>({ nodes: INITIAL_NODES, edges: INITIAL_EDGES });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [faults, setFaults] = useState<FaultTask[]>([]);
  const [simResults, setSimResults] = useState<{ gantt: GanttEntry[]; updatedFaults: FaultTask[] } | null>(null);
  const [mode, setMode] = useState<'build' | 'simulate'>('build');
  const [selectedBuildingType, setSelectedBuildingType] = useState<Node['type']>('residential');
  const [logs, setLogs] = useState<string[]>(["[SYSTEM] Booting PacketPath Sequencer...", "[SYSTEM] Grid connection: SECURE"]);
  
  const [simTime, setSimTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const activeCrews = useMemo<ActiveCrew[]>(() => {
    if (!simResults) return [];
    const crews = [
      { id: 'c1', name: 'Alpha-01' },
      { id: 'c2', name: 'Beta-02' },
      { id: 'c3', name: 'Gamma-03' },
    ];
    
    return crews.map(crew => {
      // Find the active task for this crew at current simTime
      const activeTask = simResults.gantt.find(
        g => g.crewId === crew.id && simTime >= g.start && simTime < g.end
      );
      
      let nodeId = null;
      if (activeTask) {
        const fault = faults.find(f => f.id === activeTask.taskId);
        if (fault) nodeId = fault.substationId;
      }
      
      return {
        id: crew.id,
        name: crew.name,
        nodeId,
        isWorking: !!activeTask
      };
    });
  }, [simResults, simTime, faults]);

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

  const handleInjectFault = (id: string) => {
    const node = graph.nodes.find(n => n.id === id);
    if (!node || node.type === 'depot') {
      addLog("PROTECTED: Depots cannot be faulted.");
      return;
    }

    const newFault: FaultTask = {
      id: `task-${Date.now()}`,
      substationId: id,
      severity: node.type === 'hospital' ? 10 : 5,
      arrivalTime: faults.length * 2,
      burstTime: 5 + Math.floor(Math.random() * 5),
      remainingTime: 0,
    };

    setFaults(prev => [...prev, newFault]);
    addLog(`CRITICAL ALERT: Fault detected at ${node.name}! Severity: ${newFault.severity}`);
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
    const crews: Crew[] = [
      { id: 'c1', name: 'Alpha-01 (Thread 0)', busy: false },
      { id: 'c2', name: 'Beta-02 (Thread 1)', busy: false },
      { id: 'c3', name: 'Gamma-03 (Thread 2)', busy: false },
    ];

    const results = simulateRoundRobin(faults, crews, 2);
    setSimResults(results);
    setSimTime(0);
    setIsPlaying(true);
    addLog("OS Engine: Multithreading simulation complete (Round Robin).");
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
              onClick={() => setMode('build')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shadow-sm ${
                mode === 'build' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-blue-600 hover:bg-white'
              }`}
            >
              <Settings2 className="w-3 h-3" />
              BUILD_MODE
            </button>
            <button 
              onClick={() => setMode('simulate')}
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
                { type: 'hospital', icon: Hospital, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-200' },
                { type: 'depot', icon: HardHat, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' }
              ].map(b => (
                <button
                  key={b.type}
                  onClick={() => setSelectedBuildingType(b.type as Node['type'])}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    selectedBuildingType === b.type 
                      ? `${b.bg} ring-2 ring-blue-500 ring-offset-1 scale-[0.98]` 
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 grayscale hover:grayscale-0'
                  }`}
                >
                  <b.icon className={`w-5 h-5 ${b.color}`} />
                  <span className="text-[9px] font-bold text-slate-700 uppercase">{b.type}</span>
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
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => handleInjectFault(selectedNodeId)}
                    className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded hover:from-orange-400 hover:to-red-400 transition-all shadow-sm"
                  >
                    Inject Fault
                  </button>
                  <p className="text-[9px] text-slate-500 text-center italic">
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
                      <button 
                        onClick={() => handleInjectFault(selectedNodeId)}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded hover:from-orange-400 hover:to-red-400 transition-all shadow-sm"
                      >
                        Inject Fault Here
                      </button>
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
                  // Inject 3 faults 
                  const demoFaults: FaultTask[] = [
                    { id: 'f1', substationId: '3', severity: 20, arrivalTime: 0, burstTime: 6, remainingTime: 6 },
                    { id: 'f2', substationId: '4', severity: 10, arrivalTime: 1, burstTime: 4, remainingTime: 4 },
                    { id: 'f3', substationId: '5', severity: 10, arrivalTime: 2, burstTime: 8, remainingTime: 8 },
                  ];
                  setFaults(demoFaults);
                  addLog("DEMO: 3 simultaneous faults injected across Grid.");
                }}
                className="col-span-2 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-all font-bold uppercase tracking-widest text-[9px] rounded flex items-center justify-center gap-2"
              >
                <Database className="w-3 h-3" />
                Inject 3x Simultaneous Demo
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
          <AnimatePresence mode="wait">
            {mode === 'build' ? (
              <motion.div 
                key="canvas"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-grow min-h-0"
              >
                <GridMap 
                  graph={graph}
                  onNodeClick={handleNodeClick}
                  faultNodeIds={faults.map(f => f.substationId)}
                  shortestPath={shortestPath}
                  affectedZones={affectedZones}
                  isBuilderMode={mode === 'build'}
                  selectedBuilderSource={selectedNodeId}
                  onBgClick={handleBgClick}
                  onNodeRightClick={handleCycleNodeType}
                  onNodePositionChange={handleNodePositionChange}
                  activeCrews={activeCrews}
                />
              </motion.div>
            ) : (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-grow overflow-y-auto custom-scrollbar"
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
                      crews={[
                        { id: 'c1', name: 'Alpha-01', busy: false },
                        { id: 'c2', name: 'Beta-02', busy: false },
                        { id: 'c3', name: 'Gamma-03', busy: false },
                      ]}
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
