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
  currentTaskId?: string;
}

export interface GanttEntry {
  crewId: string;
  taskId: string;
  start: number;
  end: number;
}

export function simulateRoundRobin(
  faults: FaultTask[],
  crews: Crew[],
  quantum: number = 2
): { gantt: GanttEntry[]; updatedFaults: FaultTask[] } {
  let currentTime = 0;
  const queue: FaultTask[] = [...faults].sort((a, b) => a.arrivalTime - b.arrivalTime);
  const gantt: GanttEntry[] = [];
  const readyQueue: FaultTask[] = [];
  const completedFaults: FaultTask[] = [];
  
  // Clone to avoid mutation
  const activeFaults = queue.map(f => ({ ...f, remainingTime: f.burstTime }));

  while (completedFaults.length < activeFaults.length) {
    // Add arrived faults to ready queue
    activeFaults.forEach(f => {
      if (f.arrivalTime <= currentTime && f.remainingTime > 0 && !readyQueue.includes(f) && !completedFaults.includes(f)) {
        readyQueue.push(f);
      }
    });

    // Priority execution: highest severity (1 highest priority, 2, 3.. or opposite? let's assume severity 3 is high priority, meaning higher number = jump queue)
    // Wait, standard convention: severity 1 = highest. Let's sort ready queue so severity 1 is processed first, but since it's Round Robin, we just prioritize pulling them!
    readyQueue.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity - b.severity; // smaller severity = higher priority
      }
      return 0; // keep order for same severity
    });

    if (readyQueue.length === 0) {
      currentTime++;
      continue;
    }

    const currentTask = readyQueue.shift()!;
    if (currentTask.startTime === undefined) {
      currentTask.startTime = currentTime;
    }

    const timeToRun = Math.min(currentTask.remainingTime, quantum);
    
    // In a real multi-crew scenario, we'd distribute across crews.
    // Ensure we pick a crew based on shortest Gantt end time to pack efficiently!
    let bestCrew = crews[0];
    let earliestAvailable = Infinity;
    crews.forEach(c => {
       const crewEntries = gantt.filter(g => g.crewId === c.id);
       const avail = crewEntries.length > 0 ? Math.max(...crewEntries.map(e => e.end)) : 0;
       if (avail < earliestAvailable) {
         earliestAvailable = avail;
         bestCrew = c;
       }
    });

    // We can only start when the best crew is available AND time has progressed to current
    const actualStart = Math.max(currentTime, earliestAvailable);

    gantt.push({
      crewId: bestCrew.id,
      taskId: currentTask.id,
      start: actualStart,
      end: actualStart + timeToRun
    });

    // The dispatch engine proceeds by actual time
    currentTime = actualStart + timeToRun;
    currentTask.remainingTime -= timeToRun;

    if (currentTask.remainingTime > 0) {
      // It will be re-added in next tick
    } else {
      currentTask.completionTime = currentTime;
      currentTask.waitingTime = currentTask.completionTime - currentTask.arrivalTime - currentTask.burstTime;
      completedFaults.push(currentTask);
    }
  }

  return { gantt, updatedFaults: completedFaults };
}
