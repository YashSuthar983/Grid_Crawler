"""
main.py — Entry point for the Grid Fault Management System.

Usage:
    python main.py                          # run full demo
    python main.py --faults S07 S28 S40     # custom fault nodes
    python main.py --depot S35              # use alternate depot
    python main.py --quantum 3 --crews 4    # scheduler tuning

All stdlib — no external dependencies required.
"""

import argparse
import os
import sys

# Ensure the package directory is on sys.path so imports resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fault_manager import FaultManager


def parse_args():
    p = argparse.ArgumentParser(
        description="Grid Fault Management System — DAA + OS demo",
    )
    p.add_argument(
        "--adj", default=os.path.join("data", "adj_list.txt"),
        help="Path to adjacency list file (default: data/adj_list.txt)",
    )
    p.add_argument(
        "--config", default=os.path.join("data", "node_config.json"),
        help="Path to node config JSON (default: data/node_config.json)",
    )
    p.add_argument(
        "--depot", default="S01",
        help="Depot / source node ID (default: S01)",
    )
    p.add_argument(
        "--faults", nargs="+", default=None,
        help="Fault node IDs (default: demo set S07 S28 S40)",
    )
    p.add_argument(
        "--repair-times", nargs="+", type=int, default=None,
        help="Repair time per fault in units (default: 4 each)",
    )
    p.add_argument(
        "--quantum", type=int, default=2,
        help="Round Robin time quantum (default: 2)",
    )
    p.add_argument(
        "--crews", type=int, default=3,
        help="Number of repair crews / threads (default: 3)",
    )
    return p.parse_args()


def main():
    args = parse_args()

    # Resolve paths relative to this script's directory
    base = os.path.dirname(os.path.abspath(__file__))
    adj_path = os.path.join(base, args.adj)
    cfg_path = os.path.join(base, args.config)

    # Default demo: 6 simultaneous faults, 3 crews — deliberately more
    # faults than crews so Round Robin queueing, non-zero waiting times,
    # and priority jumping (criticals before normals) are all visible.
    #   S07 hospital · S40 hospital · S28 emergency  → critical
    #   S10/S50/S33  normal substations              → low priority
    fault_nodes = args.faults or ["S10", "S07", "S50", "S28", "S33", "S40"]
    repair_times = args.repair_times or [4, 5, 3, 6, 4, 5]

    print()
    print("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
    print("┃    GRID FAULT MANAGEMENT SYSTEM — FULL DEMO       ┃")
    print("┃    DAA (BFS, DFS, Brute Force) + OS (Round Robin) ┃")
    print("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛")
    print(f"  Faults       : {', '.join(fault_nodes)}")
    print(f"  Repair times : {repair_times}")
    print(f"  Quantum      : {args.quantum}")
    print(f"  Crews        : {args.crews}")
    print()

    mgr = FaultManager(
        adj_file=adj_path,
        config_file=cfg_path,
        depot_node=args.depot,
        quantum=args.quantum,
        num_crews=args.crews,
    )
    mgr.process_faults(fault_nodes, repair_times)

    print("━" * 52)
    print("  ✓  All faults processed. System complete.")
    print("━" * 52)


if __name__ == "__main__":
    main()
