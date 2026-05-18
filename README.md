# Grid Fault Management System

A Python system demonstrating **DAA** (Design and Analysis of Algorithms) and **OS** (Operating Systems) concepts applied to power-grid fault management.

## Concepts Covered

| Area | Concept | Module |
|------|---------|--------|
| DAA  | BFS — shortest path (unweighted graph) | `bfs.py` |
| DAA  | DFS — zone mapping (full reachability) | `dfs.py` |
| DAA  | Brute force — all-paths enumeration | `brute_force.py` |
| OS   | Round Robin scheduling with threads | `scheduler.py` |
| DS   | Min-heap priority queue | `priority_queue.py` |

## Requirements

**Python 3.10+** — stdlib only, no external dependencies.

## Quick Start

```bash
# Run the full demo (3 faults, 3 crews, quantum=2)
python main.py

# Custom faults
python main.py --faults S07 S28 S40

# Use alternate depot, more crews, larger quantum
python main.py --depot S35 --crews 4 --quantum 3

# Custom repair times per fault
python main.py --faults S07 S28 --repair-times 5 3
```

## Project Structure

```
grid_fault_system/
├── main.py              # Entry point, CLI args, demo runner
├── graph.py             # Graph class, adjacency list, loader
├── bfs.py               # BFS shortest path implementation
├── dfs.py               # DFS zone mapping implementation
├── brute_force.py       # All-paths finder + perf comparison
├── scheduler.py         # Round Robin, threads, Gantt output
├── priority_queue.py    # Heap-based priority dispatch
├── fault_manager.py     # Orchestrates all modules
├── data/
│   ├── adj_list.txt     # Grid graph (60 nodes, edge list)
│   └── node_config.json # Node types: hospital, depot, normal
└── README.md
```

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

The system produces four types of output:

1. **BFS path log** — hop count + full route from depot to fault
2. **DFS zone map** — all affected nodes + critical nodes flagged
3. **Gantt chart** — ASCII crew dispatch timeline with context switches
4. **Perf report** — BFS vs brute-force timing comparison (μs/ms)
