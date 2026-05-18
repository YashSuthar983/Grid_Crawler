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
  crews: Crew[]
): { gantt: GanttEntry[]; updatedFaults: FaultTask[] } {
  const gantt: GanttEntry[] = [];
  const completedFaults: FaultTask[] = [];
  
  // Track where each crew is and when they are available next
  const crewState = new Map<string, { availableAt: number; currentNode: string }>();
  crews.forEach(c => {
    crewState.set(c.id, { 
      availableAt: 0, 
      currentNode: c.startNodeId || graph.nodes[0].id 
    });
  });

  // Sort faults by arrival time
  const pendingFaults = [...faults].sort((a, b) => a.arrivalTime - b.arrivalTime);
  // Optional priority sort (severity 1 is higher priority if arrived at same time)

  const TRAVEL_TIME_PER_EDGE = 2; // Arbitrary time units per edge

  for (const fault of pendingFaults) {
    let bestCrew = crews[0];
    let earliestArrivalAtFault = Infinity;
    let selectedPath: string[] | null = null;
    let selectedDepartureTime = 0;

    // Find which crew can arrive and fix it earliest
    // Or simpler: Assign task to the crew that has the shortest wait + travel + execution time
    for (const crew of crews) {
      const state = crewState.get(crew.id)!;
      const tOut = findShortestPathBFS(graph, state.currentNode, fault.substationId);
      const path = tOut.path || [state.currentNode]; // If no path, teleport (fallback)
      const travelTime = (path.length - 1) * TRAVEL_TIME_PER_EDGE;
      
      // Crew can start traveling either when they finish previous tasks, or when fault arrives
      const departureTime = Math.max(state.availableAt, fault.arrivalTime);
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
    
    // Add travel entry to Gantt if travel is needed
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
    const fixEnd = fixStart + fault.burstTime;

    gantt.push({
      crewId: bestCrew.id,
      taskId: fault.id,
      type: 'repair',
      path: [fault.substationId], // at node
      start: fixStart,
      end: fixEnd
    });

    state.availableAt = fixEnd;
    state.currentNode = fault.substationId; // Crew stays at the repaired node
    
    fault.completionTime = fixEnd;
    fault.waitingTime = fixEnd - fault.arrivalTime - fault.burstTime;
    fault.remainingTime = 0;
    completedFaults.push({ ...fault });
  }

  return { gantt, updatedFaults: completedFaults };
}
