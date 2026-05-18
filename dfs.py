"""
dfs.py — DFS zone-mapping engine.

Discovers ALL nodes reachable from a fault node to identify the full
affected zone.  DFS is the correct choice because:
  • We need every connected node, not just the nearest.
  • DFS naturally follows one path to its end before backtracking,
    covering every reachable node efficiently.
  • No shortest-path guarantee is needed here.

Data structure : Stack (recursion / call stack)
Time complexity: O(V + E)
"""

from graph import Graph


def dfs_zone_map(
    graph: Graph,
    start: str,
    node_config: dict[str, str] | None = None,
) -> tuple[list[str], list[str]]:
    """
    Return (traversal_order, critical_nodes) reachable from *start* via DFS.

    Parameters
    ----------
    graph       : Graph object
    start       : fault node ID (DFS root)
    node_config : optional dict mapping node_id → type
                  ('hospital', 'depot', 'water', etc.)

    Returns
    -------
    traversal_order : list of node IDs in DFS visit order
    critical_nodes  : subset of traversal_order that are critical
                      (hospital / water / emergency)
    """
    if node_config is None:
        node_config = {}

    visited: set[str] = set()
    order: list[str] = []
    critical: list[str] = []

    CRITICAL_TYPES = {"hospital", "water", "emergency"}

    def _dfs(node: str) -> None:
        visited.add(node)
        order.append(node)
        ntype = node_config.get(node, "normal")
        if ntype in CRITICAL_TYPES:
            critical.append(node)
        for nb in graph.neighbors(node):
            if nb not in visited:
                _dfs(nb)

    _dfs(start)
    return order, critical


def dfs_print_result(
    graph: Graph,
    fault_node: str,
    node_config: dict[str, str] | None = None,
) -> tuple[list[str], list[str]]:
    """Run DFS and pretty-print the zone mapping result."""
    order, critical = dfs_zone_map(graph, fault_node, node_config)

    print("\n╔══════════════════════════════════════════════════╗")
    print("║          DFS — AFFECTED ZONE MAPPING            ║")
    print("╚══════════════════════════════════════════════════╝")
    print(f"  Fault origin     : {fault_node}")
    print(f"  Affected nodes   : {len(order)}")
    print(f"  Traversal order  : {' → '.join(order)}")

    if critical:
        print(f"  ★ Critical nodes : {', '.join(critical)}")
        for cn in critical:
            ctype = (node_config or {}).get(cn, "unknown")
            print(f"     └─ {cn} ({ctype})")
    else:
        print("  ★ Critical nodes : none")

    print()
    return order, critical
