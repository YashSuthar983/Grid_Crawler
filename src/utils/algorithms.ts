/**
 * Power Grid Algorithms & OS Concepts
 */

export interface Node {
  id: string;
  name: string;
  type: "depot" | "hospital" | "residential" | "industrial";
  x?: number;
  y?: number;
}

export interface Edge {
  source: string;
  target: string;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

/**
 * BFS for Shortest Path
 */
export function findShortestPathBruteForce(graph: Graph, startId: string, endId: string): { path: string[] | null, iterations: number } {
  let bestPath: string[] | null = null;
  let iterations = 0;
  
  const adjacency: Record<string, string[]> = {};
  graph.nodes.forEach(n => adjacency[n.id] = []);
  graph.edges.forEach(e => {
    adjacency[e.source].push(e.target);
    adjacency[e.target].push(e.source);
  });

  function dfsAllPaths(current: string, target: string, path: string[], visited: Set<string>) {
    iterations++;
    if (current === target) {
      if (!bestPath || path.length < bestPath.length) {
        bestPath = [...path];
      }
      return;
    }
    
    for (const neighbor of adjacency[current]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        path.push(neighbor);
        dfsAllPaths(neighbor, target, path, visited);
        path.pop();
        visited.delete(neighbor);
      }
    }
  }

  const visited = new Set<string>();
  visited.add(startId);
  dfsAllPaths(startId, endId, [startId], visited);
  return { path: bestPath, iterations };
}

export function findShortestPathBFS(graph: Graph, startId: string, endId: string): { path: string[] | null, iterations: number } {
  const adjacency: Record<string, string[]> = {};
  graph.nodes.forEach(n => adjacency[n.id] = []);
  graph.edges.forEach(e => {
    adjacency[e.source].push(e.target);
    adjacency[e.target].push(e.source);
  });

  const queue: [string, string[]][] = [[startId, [startId]]];
  const visited = new Set<string>();
  visited.add(startId);
  
  let iterations = 0;

  while (queue.length > 0) {
    iterations++;
    const [current, path] = queue.shift()!;
    if (current === endId) return { path, iterations };

    for (const neighbor of adjacency[current]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }

  return { path: null, iterations };
}

export function findShortestPath(graph: Graph, startId: string, endId: string): string[] | null {
  return findShortestPathBFS(graph, startId, endId).path;
}

/**
 * DFS for Affected Zones
 */
export function findAffectedZones(graph: Graph, startId: string): string[] {
  const adjacency: Record<string, string[]> = {};
  graph.nodes.forEach(n => adjacency[n.id] = []);
  graph.edges.forEach(e => {
    adjacency[e.source].push(e.target);
    adjacency[e.target].push(e.source);
  });

  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(u: string) {
    visited.add(u);
    result.push(u);
    for (const v of adjacency[u]) {
      if (!visited.has(v)) {
        dfs(v);
      }
    }
  }

  dfs(startId);
  return result;
}

/**
 * Round Robin Dispatch Simulation
 */
export interface FaultTask {
  id: string;
  substationId: string;
  severity: number; // For priority dispatching
  arrivalTime: number;
  burstTime: number; // Time needed to fix
  remainingTime: number;
  completionTime?: number;
  waitingTime?: number;
  startTime?: number;
}

export interface Crew {
  id: string;
  name: string;
  busy: boolean;
  startNodeId?: string;
  currentTaskId?: string;
}

export interface GanttEntry {
  crewId: string;
  taskId: string;
  type: 'travel' | 'repair';
  path?: string[];
  start: number;
  end: number;
}

export function simulateDispatch(
  graph: Graph,
  faults: FaultTask[],
  crews: Crew[],
  schedulingMode: 'fifo' | 'rr' = 'fifo'
): { gantt: GanttEntry[]; updatedFaults: FaultTask[] } {
  const gantt: GanttEntry[] = [];
  const completedFaults: FaultTask[] = [];
  
  const crewState = new Map<string, { availableAt: number; currentNode: string; id: string }>();
  crews.forEach(c => {
    crewState.set(c.id, { 
      availableAt: 0, 
      currentNode: c.startNodeId || graph.nodes[0].id,
      id: c.id
    });
  });

  const TRAVEL_TIME_PER_EDGE = 2;
  const TIME_QUANTUM = 3;
  const pendingFaults = [...faults].map(f => ({ ...f, remainingTime: f.burstTime, queueTime: f.arrivalTime }));
  let currentTime = 0;

  while (pendingFaults.length > 0) {
    // Find who is the next earliest available crew
    const sortedCrews = Array.from(crewState.values()).sort((a, b) => a.availableAt - b.availableAt);
    const nextCrewTime = sortedCrews[0].availableAt;
    
    // Time jumps to the earliest crew available, or next fault arrival IF all crews are idle and waiting
    let timeJump = nextCrewTime;

    // Available faults at this time jump
    let availableFaults = pendingFaults.filter(f => f.arrivalTime <= timeJump);
    
    if (availableFaults.length === 0) {
      // Find the next fault that will arrive
      const futureFaults = pendingFaults.sort((a, b) => a.arrivalTime - b.arrivalTime);
      if (futureFaults.length > 0) {
        timeJump = Math.max(timeJump, futureFaults[0].arrivalTime);
        availableFaults = pendingFaults.filter(f => f.arrivalTime <= timeJump);
      } else {
        break; // Should not happen if loop condition holds
      }
    }

    currentTime = timeJump;

    // Available crews AT this current time
    const availableCrews = sortedCrews.filter(c => c.availableAt <= currentTime);

    // Sort available faults based on schedulingMode
    availableFaults.sort((a, b) => {
      if (a.severity !== b.severity) return b.severity - a.severity;
      if (schedulingMode === 'fifo') {
        return a.arrivalTime - b.arrivalTime;
      } else {
        return (a as any).queueTime - (b as any).queueTime;
      }
    });

    if (availableCrews.length > 0 && availableFaults.length > 0) {
      const fault = availableFaults[0];
      let bestCrew = availableCrews[0];
      let earliestArrivalAtFault = Infinity;
      let selectedPath: string[] | null = null;
      let selectedDepartureTime = 0;

      for (const crew of availableCrews) {
        const tOut = findShortestPathBFS(graph, crew.currentNode, fault.substationId);
        const path = tOut.path || [crew.currentNode];
        const travelTime = (path.length - 1) * TRAVEL_TIME_PER_EDGE;
        
        const departureTime = Math.max(crew.availableAt, fault.arrivalTime);
        const arrivalAtFault = departureTime + travelTime;

        if (arrivalAtFault < earliestArrivalAtFault) {
          earliestArrivalAtFault = arrivalAtFault;
          bestCrew = crew;
          selectedPath = path;
          selectedDepartureTime = departureTime;
        }
      }

      const state = crewState.get(bestCrew.id)!;
      const travelTime = (selectedPath!.length - 1) * TRAVEL_TIME_PER_EDGE;
      
      if (travelTime > 0) {
        gantt.push({
          crewId: bestCrew.id,
          taskId: fault.id,
          type: 'travel',
          path: selectedPath!,
          start: selectedDepartureTime,
          end: selectedDepartureTime + travelTime
        });
      }

      const fixStart = selectedDepartureTime + Math.max(travelTime, 0);
      const workDone = schedulingMode === 'rr' 
        ? Math.min(fault.remainingTime, TIME_QUANTUM)
        : fault.remainingTime;
      const fixEnd = fixStart + workDone;

      gantt.push({
        crewId: bestCrew.id,
        taskId: fault.id,
        type: 'repair',
        path: [fault.substationId],
        start: fixStart,
        end: fixEnd
      });

      state.availableAt = fixEnd;
      state.currentNode = fault.substationId;
      
      fault.remainingTime -= workDone;

      if (fault.remainingTime <= 0) {
        fault.completionTime = fixEnd;
        fault.waitingTime = fixEnd - fault.arrivalTime - fault.burstTime;
        
        const idx = pendingFaults.findIndex(f => f.id === fault.id);
        if (idx !== -1) pendingFaults.splice(idx, 1);
        completedFaults.push(fault);
      } else {
        // Round Robin: Send task to the back of the ready queue
        (fault as any).queueTime = fixEnd;
      }
    } else {
      // If no valid matches, advance time slightly to prevent infinite loop
      currentTime++;
      sortedCrews.forEach(c => {
         if(c.availableAt < currentTime) c.availableAt = currentTime;
      });
    }
  }

  // Make crews return to their start node (depot)
  for (const crew of crews) {
    const state = crewState.get(crew.id)!;
    const startNode = crew.startNodeId || graph.nodes[0].id;
    if (state.currentNode !== startNode) {
      const tOut = findShortestPathBFS(graph, state.currentNode, startNode);
      const path = tOut.path;
      if (path && path.length > 1) {
        const travelTime = (path.length - 1) * TRAVEL_TIME_PER_EDGE;
        gantt.push({
          crewId: crew.id,
          taskId: 'ret',
          type: 'travel',
          path: path,
          start: state.availableAt,
          end: state.availableAt + travelTime
        });
        state.availableAt += travelTime;
        state.currentNode = startNode;
      }
    }
  }

  return { gantt, updatedFaults: completedFaults };
}
