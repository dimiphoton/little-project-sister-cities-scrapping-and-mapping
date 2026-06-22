/** Load JSON datasets for the static site. */

export async function loadAllData(baseUrl = "data") {
  const names = [
    "graphe_jumelages.json",
    "stats.json",
    "city_index.json",
    "countries.json",
    "metadata.json",
  ];

  const entries = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`${baseUrl}/${name}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${name}: ${response.status}`);
      }
      return [name, await response.json()];
    }),
  );

  const data = Object.fromEntries(entries);
  return {
    graph: data["graphe_jumelages.json"],
    stats: data["stats.json"],
    cityIndex: data["city_index.json"],
    countries: data["countries.json"],
    metadata: data["metadata.json"],
  };
}

export function buildNodeMap(nodes) {
  const map = new Map();
  for (const node of nodes) {
    map.set(node.id, node);
  }
  return map;
}

export function buildAdjacency(links) {
  const adj = new Map();
  for (const link of links) {
    if (!adj.has(link.source)) adj.set(link.source, new Set());
    if (!adj.has(link.target)) adj.set(link.target, new Set());
    adj.get(link.source).add(link.target);
    adj.get(link.target).add(link.source);
  }
  return adj;
}
