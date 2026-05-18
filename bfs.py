"""
bfs.py — BFS shortest-path engine.

Finds the minimum-hop path from a depot node to a fault node.
BFS is the correct choice because the grid is an unweighted graph:
  • BFS explores level by level and is guaranteed to find the shortest
    path (minimum hops) first.
  • DFS would NOT guarantee shortest path on an unweighted graph.

Data structure : collections.deque (FIFO queue)
Time complexity: O(V + E)
"""

from collections import deque

from graph import Graph


def bfs_shortest_path(
    graph: Graph, start: str, target: str
) -> tuple[list[str] | None, int]:
    """
    Return (path, hop_count) from *start* to *target* using BFS.

    Parameters
    ----------
    graph  : Graph object
    start  : depot / source node ID
    target : fault node ID

    Returns
    -------
    (path, hops) where *path* is a list of node IDs from start→target
                 and *hops* is len(path) - 1.
    If no path exists, returns (None, -1).
    """
    if start == target:
        return [start], 0

    visited = {start}
    parent = {start: None}
    queue = deque([start])

    while queue:
        node = queue.popleft()
        for nb in graph.neighbors(node):
            if nb in visited:
                continue
            visited.add(nb)
            parent[nb] = node
            if nb == target:
                # Reconstruct path
                path = []
                cur = target
                while cur is not None:
                    path.append(cur)
                    cur = parent[cur]
                path.reverse()
                return path, len(path) - 1
            queue.append(nb)

    return None, -1


def bfs_print_result(
    graph: Graph, depot: str, fault_node: str
) -> tuple[list[str] | None, int]:
    """Run BFS and pretty-print the result. Returns (path, hops)."""
    path, hops = bfs_shortest_path(graph, depot, fault_node)

    print("\n╔══════════════════════════════════════════════════╗")
    print("║           BFS — SHORTEST PATH RESULT            ║")
    print("╚══════════════════════════════════════════════════╝")
    print(f"  Fault node   : {fault_node}")
    print(f"  Nearest depot: {depot}")

    if path is None:
        print("  ⚠  No path exists between depot and fault node.")
    else:
        print(f"  Path         : {' → '.join(path)}")
        print(f"  Hop count    : {hops}")

    print()
    return path, hops
