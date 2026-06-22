/**
 * Main app — Deck.gl map, search, region filters, side panel.
 */

import { loadAllData, buildNodeMap, buildAdjacency } from "./data-loader.js";
import { haversineKm, formatKm, countryFlag } from "./geo.js";
import { renderTopCities, renderChord, updateHeroKpis } from "./charts.js";

const COUNTRY_COLORS = {
  FR: [240, 59, 78],
  GB: [0, 82, 180],
  DE: [255, 206, 0],
  US: [60, 120, 216],
  JP: [188, 0, 45],
  DEFAULT: [88, 166, 255],
};

let state = {
  data: null,
  nodeMap: null,
  adjacency: null,
  selectedCityId: null,
  countryFilter: "",
  continentFilter: "",
  deck: null,
};

function getCountryColor(code) {
  return COUNTRY_COLORS[code] || COUNTRY_COLORS.DEFAULT;
}

function nodePassesFilters(node) {
  if (!node) return false;
  if (state.countryFilter && node.country !== state.countryFilter) return false;
  if (state.continentFilter) {
    const info = state.data.countries[node.country];
    if (!info || info.continent !== state.continentFilter) return false;
  }
  return true;
}

function getVisibleNodeIds() {
  const ids = new Set();
  for (const node of state.data.graph.nodes) {
    if (nodePassesFilters(node) && node.lon != null && node.lat != null) {
      ids.add(node.id);
    }
  }
  return ids;
}

function buildArcData() {
  if (!state.selectedCityId) return [];

  const neighbors = state.adjacency.get(state.selectedCityId) || new Set();
  const arcs = [];
  const origin = state.nodeMap.get(state.selectedCityId);
  if (!origin || origin.lon == null) return [];

  for (const twinId of neighbors) {
    const target = state.nodeMap.get(twinId);
    if (!target || target.lon == null) continue;
    if (!nodePassesFilters(origin) && !nodePassesFilters(target)) continue;

    arcs.push({
      source: [origin.lon, origin.lat],
      target: [target.lon, target.lat],
      sourceColor: [88, 166, 255, 200],
      targetColor: [...getCountryColor(target.country), 200],
    });
  }
  return arcs;
}

function buildScatterData() {
  const visible = getVisibleNodeIds();
  return state.data.graph.nodes
    .filter((n) => visible.has(n.id) && n.lon != null && n.lat != null)
    .map((n) => ({
      id: n.id,
      name: n.name,
      position: [n.lon, n.lat],
      country: n.country,
      selected: n.id === state.selectedCityId,
    }));
}

function buildLayers() {
  const { BitmapLayer, TileLayer, ScatterplotLayer, ArcLayer } = deck;

  const tileLayer = new TileLayer({
    id: "basemap",
    data: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: (props) => {
      const {
        bbox: { west, south, east, north },
      } = props.tile;
      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [west, south, east, north],
      });
    },
  });

  const scatter = buildScatterData();
  const scatterLayer = new ScatterplotLayer({
    id: "cities",
    data: scatter,
    pickable: true,
    opacity: 0.9,
    stroked: true,
    filled: true,
    radiusScale: 40,
    radiusMinPixels: 5,
    radiusMaxPixels: 14,
    lineWidthMinPixels: 1,
    getPosition: (d) => d.position,
    getFillColor: (d) => {
      if (d.selected) return [240, 136, 62, 255];
      return [...getCountryColor(d.country), 220];
    },
    getLineColor: [255, 255, 255, 120],
    onClick: ({ object }) => {
      if (object) selectCity(object.id);
    },
  });

  const layers = [tileLayer, scatterLayer];

  const arcData = buildArcData();
  if (arcData.length) {
    layers.push(
      new ArcLayer({
        id: "twins",
        data: arcData,
        pickable: false,
        getWidth: 2,
        getSourcePosition: (d) => d.source,
        getTargetPosition: (d) => d.target,
        getSourceColor: (d) => d.sourceColor,
        getTargetColor: (d) => d.targetColor,
      }),
    );
  }

  return layers;
}

function updateMapView() {
  if (!state.deck) return;
  state.deck.setProps({ layers: buildLayers() });
}

function renderPanel() {
  const titleEl = document.getElementById("panel-title");
  const listEl = document.getElementById("twin-list");
  const hintEl = document.getElementById("panel-hint");

  if (!state.selectedCityId) {
    titleEl.textContent = "Select a city";
    hintEl.textContent = "Search or click a point on the map to see twin cities.";
    listEl.innerHTML = "";
    return;
  }

  const city = state.nodeMap.get(state.selectedCityId);
  if (!city) return;

  const flag = countryFlag(city.country, state.data.countries);
  titleEl.textContent = `${flag} ${city.name}`;
  const neighbors = [...(state.adjacency.get(state.selectedCityId) || [])];

  hintEl.textContent = `${neighbors.length} twin ${neighbors.length === 1 ? "city" : "cities"}`;

  const items = neighbors
    .map((id) => state.nodeMap.get(id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  listEl.innerHTML = items
    .map((twin) => {
      const tf = countryFlag(twin.country, state.data.countries);
      let dist = "—";
      if (city.lon != null && twin.lon != null) {
        dist = formatKm(haversineKm(city.lon, city.lat, twin.lon, twin.lat));
      }
      return `<li><strong>${tf} ${twin.name}</strong> <span style="color:#8b949e">${dist}</span></li>`;
    })
    .join("");
}

function selectCity(cityId) {
  state.selectedCityId = cityId;
  updateMapView();
  renderPanel();

  const city = state.nodeMap.get(cityId);
  if (city?.lon != null && state.deck) {
    state.deck.setProps({
      initialViewState: {
        longitude: city.lon,
        latitude: city.lat,
        zoom: 4,
        pitch: 0,
        bearing: 0,
      },
      transitionDuration: 600,
    });
  }

  const url = new URL(window.location);
  url.searchParams.set("city", cityId);
  history.replaceState({}, "", url);
}

function resetView() {
  state.selectedCityId = null;
  state.countryFilter = "";
  state.continentFilter = "";
  document.getElementById("country-filter").value = "";
  document.getElementById("continent-filter").value = "";
  document.getElementById("search-input").value = "";
  updateMapView();
  renderPanel();

  const url = new URL(window.location);
  url.searchParams.delete("city");
  history.replaceState({}, "", url);
}

function setupSearch() {
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      results.classList.remove("visible");
      return;
    }

    const matches = state.data.cityIndex
      .filter((c) => c.n.toLowerCase().includes(q))
      .slice(0, 8);

    results.innerHTML = matches
      .map(
        (c) =>
          `<button type="button" data-id="${c.id}">${countryFlag(c.cc, state.data.countries)} ${c.n}</button>`,
      )
      .join("");
    results.classList.toggle("visible", matches.length > 0);
  });

  results.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    selectCity(btn.dataset.id);
    results.classList.remove("visible");
    input.value = state.nodeMap.get(btn.dataset.id)?.name || "";
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) {
      results.classList.remove("visible");
    }
  });
}

function setupFilters() {
  const countrySelect = document.getElementById("country-filter");
  const continentSelect = document.getElementById("continent-filter");

  const countryCodes = Object.keys(state.data.countries).sort();
  for (const cc of countryCodes) {
    const opt = document.createElement("option");
    opt.value = cc;
    opt.textContent = `${state.data.countries[cc].flag || ""} ${cc}`;
    countrySelect.appendChild(opt);
  }

  const continents = [
    ...new Set(Object.values(state.data.countries).map((c) => c.continent)),
  ].sort();
  for (const cont of continents) {
    const opt = document.createElement("option");
    opt.value = cont;
    opt.textContent = cont;
    continentSelect.appendChild(opt);
  }

  countrySelect.addEventListener("change", () => {
    state.countryFilter = countrySelect.value;
    updateMapView();
  });

  continentSelect.addEventListener("change", () => {
    state.continentFilter = continentSelect.value;
    updateMapView();
  });

  document.getElementById("reset-btn").addEventListener("click", resetView);
}

function initDeck() {
  state.deck = new deck.Deck({
    parent: document.getElementById("map"),
    initialViewState: { longitude: 2, latitude: 46, zoom: 2.5, pitch: 0, bearing: 0 },
    controller: true,
    layers: buildLayers(),
  });
}

async function main() {
  try {
    state.data = await loadAllData("data");
    state.nodeMap = buildNodeMap(state.data.graph.nodes);
    state.adjacency = buildAdjacency(state.data.graph.links);

    updateHeroKpis(state.data.stats, state.data.metadata);
    document.getElementById("footer-source").textContent =
      `Source: Wikidata P190 · Last updated: ${state.data.metadata?.last_run || "—"}`;

    renderTopCities(document.getElementById("chart-top"), state.data.stats.top_cities, selectCity);
    renderChord(document.getElementById("chart-chord"), state.data.stats.country_chord);

    setupSearch();
    setupFilters();
    initDeck();

    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get("city");
    if (cityParam && state.nodeMap.has(cityParam)) {
      selectCity(cityParam);
    }
  } catch (err) {
    console.error(err);
    document.getElementById("map").innerHTML =
      `<p style="padding:2rem;color:#f85149">Failed to load data. Run <code>python scripts/copy_docs_data.py</code>.</p>`;
  }
}

main();
