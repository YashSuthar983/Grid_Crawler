"""
brute_force.py — All-paths finder & BFS vs brute-force performance comparison.

Brute force uses recursive DFS to enumerate EVERY path from depot → fault,
then selects the minimum-length one.

    Brute-force complexity : O(V!)   (explores all permutations of nodes)
    BFS complexity         : O(V+E)  (level-order, guaranteed shortest)

Measurement: time.perf_counter()
"""

import time

from graph import Graph
from bfs import bfs_shortest_path


TIME_LIMIT = 2.0     # seconds — cap brute force to keep demo responsive


def brute_force_all_paths(
    graph: Graph, start: str, target: str
) -> tuple[list[list[str]], bool]:
    """
    Enumerate simple paths from *start* to *target* via recursive DFS.

    Stops after TIME_LIMIT seconds to keep runtime bounded on dense graphs.
    Returns (paths_list, was_truncated).
    """
    all_paths: list[list[str]] = []
    truncated = False
    deadline = time.perf_counter() + TIME_LIMIT

    def _explore(node: str, path: list[str], visited: set[str]) -> None:
        nonlocal truncated
        if time.perf_counter() >= deadline:
            truncated = True
            return
        if node == target:
            all_paths.append(list(path))
            return
        for nb in graph.neighbors(node):
            if nb not in visited and not truncated:
                visited.add(nb)
                path.append(nb)
                _explore(nb, path, visited)
                path.pop()
                visited.discard(nb)

    _explore(start, [start], {start})
    return all_paths, truncated


def brute_force_shortest(
    graph: Graph, start: str, target: str
) -> tuple[list[str] | None, int, int, bool]:
    """
    Find shortest path by brute force (enumerate all, pick min).

    Returns
    -------
    (shortest_path, hop_count, total_paths_explored, was_truncated)
    """
    paths, truncated = brute_force_all_paths(graph, start, target)
    if not paths:
        return None, -1, 0, truncated
    shortest = min(paths, key=len)
    return shortest, len(shortest) - 1, len(paths), truncated


def compare_bfs_vs_brute(
    graph: Graph, depot: str, fault_node: str
) -> None:
    """
    Run both BFS and brute force on the same depot→fault query.
    Print a side-by-side comparison table with timings.
    """
    # ── BFS timing ─────────────────────────────────────────────────
    t0 = time.perf_counter()
    bfs_path, bfs_hops = bfs_shortest_path(graph, depot, fault_node)
    t_bfs = time.perf_counter() - t0

    # ── Brute force timing ─────────────────────────────────────────
    t0 = time.perf_counter()
    bf_path, bf_hops, bf_count, bf_truncated = brute_force_shortest(
        graph, depot, fault_node
    )
    t_bf = time.perf_counter() - t0

    # ── Pretty print ───────────────────────────────────────────────
    print("\n╔══════════════════════════════════════════════════════════════╗")
    print("║        BONUS — BFS vs BRUTE FORCE COMPARISON               ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print(f"║  Query: {depot} → {fault_node:<42s}  ║")
    print("╠══════════════════════════════════════════════════════════════╣")

    header = f"  {'Metric':<28s}{'BFS':>14s}{'Brute Force':>16s}"
    print(header)
    print("  " + "─" * 58)

    # Path found
    bfs_path_str = " → ".join(bfs_path) if bfs_path else "N/A"
    bf_path_str = " → ".join(bf_path) if bf_path else "N/A"
    print(f"  {'Shortest path':<28s}{bfs_path_str:>14s}{bf_path_str:>16s}")

    # Hop count
    print(f"  {'Hop count':<28s}{bfs_hops:>14d}{bf_hops:>16d}")

    # Paths explored
    count_str = f"{bf_count:,d}" + (" (timeout 2s)" if bf_truncated else "")
    print(f"  {'Paths explored':<28s}{'1 (first hit)':>14s}{count_str:>16s}")

    # Complexity
    print(f"  {'Time complexity':<28s}{'O(V+E)':>14s}{'O(V!)':>16s}")

    # Wall-clock time
    def _fmt_time(t: float) -> str:
        if t < 1e-3:
            return f"{t * 1e6:.1f} μs"
        return f"{t * 1e3:.2f} ms"

    print(f"  {'Wall-clock time':<28s}{_fmt_time(t_bfs):>14s}{_fmt_time(t_bf):>16s}")

    # Speedup
    if t_bf > 0:
        speedup = t_bf / max(t_bfs, 1e-9)
        print(f"  {'Speedup (BFS vs brute)':<28s}{f'{speedup:.1f}×':>14s}{'-':>16s}")

    print("╚══════════════════════════════════════════════════════════════╝")
    print()
