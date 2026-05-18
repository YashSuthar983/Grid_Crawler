"""
fault_manager.py — Orchestrator module.

Ties together all subsystems:
  1. Load graph + node config
  2. Accept fault events
  3. Run BFS (shortest path depot → fault)
  4. Run DFS (affected zone mapping)
  5. Priority-queue the faults
  6. Dispatch via Round Robin scheduler
  7. (Bonus) Run brute-force vs BFS comparison
"""

import json
import os

from graph import Graph
from bfs import bfs_print_result
from dfs import dfs_print_result
from brute_force import compare_bfs_vs_brute
from priority_queue import FaultPriorityQueue
from scheduler import RoundRobinScheduler, RepairJob


class FaultManager:
    """Central orchestrator for the grid fault management pipeline."""

    def __init__(self, adj_file, config_file, depot_node="S01",
                 quantum=2, num_crews=3):
        self.graph = Graph.from_file(adj_file)
        self.node_config = self._load_config(config_file)
        self.quantum = quantum
        self.num_crews = num_crews

        # Discover every depot from the node config; fall back to the
        # CLI-supplied depot if none are classified.
        self.depots = sorted(
            n for n, t in self.node_config.items() if t == "depot"
        )
        if depot_node and depot_node not in self.depots:
            self.depots.append(depot_node)
        if not self.depots:
            self.depots = [depot_node]

        print("╔═══════════════════════════════════════════════════╗")
        print("║      GRID FAULT MANAGEMENT SYSTEM — loaded        ║")
        print("╚═══════════════════════════════════════════════════╝")
        print(f"  Graph  : {self.graph}")
        print(f"  Depots : {', '.join(self.depots)}")
        print(f"  Config : {len(self.node_config)} nodes classified")
        print()

    @staticmethod
    def _load_config(path):
        """Load node_config.json."""
        if not os.path.exists(path):
            return {}
        with open(path) as fh:
            return json.load(fh)

    def process_faults(self, fault_nodes, repair_times=None):
        """
        Full pipeline for a list of fault node IDs.

        Parameters
        ----------
        fault_nodes  : list of node IDs where faults occurred
        repair_times : optional list of int repair durations
                       (defaults to 4 units each)
        """
        if repair_times is None:
            repair_times = []
        # Pad/truncate so every fault has a repair time (default 4).
        repair_times = [
            repair_times[i] if i < len(repair_times) else 4
            for i in range(len(fault_nodes))
        ]

        # ── 1. Priority queue ──────────────────────────────────
        # Attach each repair time to its fault BEFORE the queue
        # reorders by priority, so the duration travels with the
        # correct node instead of being mismatched after draining.
        pq = FaultPriorityQueue()
        for node, rt in zip(fault_nodes, repair_times):
            pq.push({"node": node, "repair_time": rt}, self.node_config)
        pq.print_queue()

        ordered_faults = pq.drain()

        # ── 2. BFS + DFS for each fault ────────────────────────
        jobs = []
        for i, fault in enumerate(ordered_faults):
            node = fault["node"]
            print(f"\n{'=' * 52}")
            print(f"  FAULT #{i + 1}  —  Node {node}  "
                  f"(priority P{fault['priority']}, {fault['type']})")
            print(f"{'=' * 52}")

            # BFS: shortest path from the NEAREST depot to the fault
            bfs_print_result(self.graph, self.depots, node)

            # DFS: affected zone mapping
            dfs_print_result(self.graph, node, self.node_config)

            # Build scheduler job (repair time travels with the fault)
            rt = fault.get("repair_time", 4)
            jobs.append(RepairJob(
                job_id=i + 1,
                fault_node=node,
                repair_time=rt,
                priority=fault["priority"],
                node_type=fault["type"],
            ))

        # ── 3. Round Robin scheduling ──────────────────────────
        sched = RoundRobinScheduler(
            quantum=self.quantum, num_crews=self.num_crews
        )
        sched.add_jobs(jobs)
        sched.run()

        # ── 4. Bonus: BFS vs brute-force comparison ────────────
        # Pick the first fault for the performance comparison
        if ordered_faults:
            compare_bfs_vs_brute(
                self.graph, self.depots, ordered_faults[0]["node"]
            )
