# Grid Fault Management System

A Python system demonstrating **DAA** (Design and Analysis of Algorithms) and **OS** (Operating Systems) concepts applied to power-grid fault management.

## Concepts Covered

| Area | Concept | Module |
|------|---------|--------|
| DAA  | BFS — shortest path from the **nearest** depot (multi-source BFS, unweighted graph) | `bfs.py` |
| DAA  | DFS — affected-zone mapping (full reachability from the fault) | `dfs.py` |
| DAA  | Brute force — depth-bounded all-paths enumeration vs BFS | `brute_force.py` |
| OS   | Round Robin scheduling, **parallel multi-crew** threads | `scheduler.py` |
| DS   | Min-heap priority queue (criticals jump the queue) | `priority_queue.py` |

### How each maps to the deliverables

- **BFS** finds the minimum-hop route. With two depots (S01, S35) a
  *multi-source* BFS seeds both at level 0, so the first wavefront to
  reach the fault identifies the genuinely nearest depot — still O(V+E).
- **DFS** lists every node reachable from the fault point (the full
  affected zone) and flags critical nodes (hospital/water/emergency).
- **Round Robin** models each crew as a real `threading.Thread`. With
  C crews, up to C faults are repaired *simultaneously* each quantum —
  no crew blocks another. Waiting time uses the standard RR formula
  `wait = turnaround − burst`.
- **Brute force** (bonus) exhaustively enumerates paths up to a depth
  bound and is benchmarked against BFS on the 60-node grid, showing the
  exponential-vs-linear cost gap with real timings.
- **Priority dispatch** (bonus) — faults at hospitals/critical nodes
  are popped from a min-heap ahead of normal substations.

## Requirements

**Python 3.10+** — stdlib only, no external dependencies.

## Quick Start

```bash
# Full demo: 6 simultaneous faults, 3 crews, quantum=2
# (more faults than crews → RR queueing + priority jumping visible)
python main.py

# Custom faults (≥3 simultaneous faults recommended)
python main.py --faults S07 S28 S40

# Add a fallback depot, more crews, larger quantum
python main.py --depot S20 --crews 4 --quantum 3

# Custom repair times per fault (paired by position)
python main.py --faults S07 S28 --repair-times 5 3
```

## Project Structure

```
grid_fault_system/
├── main.py              # Entry point, CLI args, demo runner
├── graph.py             # Graph class, adjacency list, loader
├── bfs.py               # BFS shortest path + multi-source nearest depot
├── dfs.py               # DFS affected-zone mapping
├── brute_force.py       # Depth-bounded brute force + perf comparison
├── scheduler.py         # Parallel multi-crew Round Robin, threads, Gantt
├── priority_queue.py    # Heap-based priority dispatch
├── fault_manager.py     # Orchestrates all modules
├── data/
│   ├── adj_list.txt     # Grid graph (60 nodes, edge list)
│   └── node_config.json # Node types: hospital, depot, normal
├── web/                 # Optional interactive browser visualization
│   ├── index.html       # open this in a browser
│   ├── engine.js        # same algorithms as the Python backend
│   ├── game.js           # canvas rendering + UI
│   └── style.css
└── README.md
```

## Web Visualization (optional)

Open `web/index.html` in any browser — no server needed. It runs the
**same corrected algorithms** as the Python backend (nearest-depot
multi-source BFS, depth-bounded brute force, parallel multi-crew Round
Robin) so the on-screen results match `python main.py` exactly.

## Input Formats

### adj_list.txt
```
# substation_id  neighbour_id  weight
S01  S02  1
S01  S05  1
S02  S03  1
```

### node_config.json
```json
{"S01": "depot", "S07": "hospital", "S12": "water", "S28": "emergency"}
```

## Output

The system produces five outputs:

1. **Priority queue** — faults ordered with criticals jumping ahead
2. **BFS path log** — nearest depot + hop count + full route to the fault
3. **DFS zone map** — all affected nodes + critical nodes flagged
4. **Gantt chart + metrics** — parallel crew timeline, per-fault waiting
   time (`turnaround − burst`), and per-crew utilisation
5. **Perf report** — BFS vs depth-bounded brute-force timing (μs/ms)
