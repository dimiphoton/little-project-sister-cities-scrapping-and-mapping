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
  showArcs: false,
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

function getVisibleCities() {
  const visible = getVisibleNodeIds();
  return state.data.graph.nodes
    .filter((n) => visible.has(n.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildArcData() {
  if (!state.showArcs || !state.selectedCityId) return [];

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
    pickable: false,
    renderSubLayers: (props) => {
      const {
        bbox: { west, south, east, north },
      } = props.tile;
      return new BitmapLayer(props, {
        id: `${props.id}-bitmap`,
        pickable: false,
        data: null,
        image: props.data,
        bounds: [west, south, east, north],
      });
    },
  });

  const scatterLayer = new ScatterplotLayer({
    id: "cities",
    data: buildScatterData(),
    pickable: true,
    autoHighlight: true,
    highlightColor: [240, 136, 62, 200],
    opacity: 0.95,
    stroked: true,
    filled: true,
    radiusScale: 60,
    radiusMinPixels: 10,
    radiusMaxPixels: 22,
    lineWidthMinPixels: 2,
    getPosition: (d) => d.position,
    getFillColor: (d) => {
      if (d.selected) return [240, 136, 62, 255];
      return [...getCountryColor(d.country), 230];
    },
    getLineColor: [255, 255, 255, 180],
  });

  const layers = [tileLayer, scatterLayer];

  const arcData = buildArcData();
  if (arcData.length) {
    layers.push(
      new ArcLayer({
        id: "twins",
        data: arcData,
        pickable: false,
        getWidth: 3,
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

function renderCityPickList() {
  const listEl = document.getElementById("city-pick-list");
  const cities = getVisibleCities();

  listEl.innerHTML = cities
    .map((city) => {
      const flag = countryFlag(city.country, state.data.countries);
      const activeClass = city.id === state.selectedCityId ? "active" : "";
      return `<li><button type="button" class="${activeClass}" data-id="${city.id}">${flag} ${city.name}</button></li>`;
    })
    .join("");

  listEl.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => selectCity(btn.dataset.id));
  });
}

function renderPanel() {
  const titleEl = document.getElementById("panel-title");
  const listEl = document.getElementById("twin-list");
  const hintEl = document.getElementById("panel-hint");

  renderCityPickList();

  if (!state.selectedCityId) {
    titleEl.textContent = "Select a city";
    hintEl.textContent = "Pick a city above, search, or click on the map.";
    listEl.innerHTML = "";
    return;
  }

  const city = state.nodeMap.get(state.selectedCityId);
  if (!city) return;

  const flag = countryFlag(city.country, state.data.countries);
  titleEl.textContent = `${flag} ${city.name}`;
  const neighbors = [...(state.adjacency.get(state.selectedCityId) || [])];

  const arcHint = state.showArcs ? "Arcs visible on map." : "Enable “Show twin arcs” to draw links.";
  hintEl.textContent = `${neighbors.length} twin ${neighbors.length === 1 ? "city" : "cities"}. ${arcHint}`;

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
      return `<li><button type="button" data-id="${twin.id}">${tf} ${twin.name}</button> <span style="color:#8b949e">${dist}</span></li>`;
    })
    .join("");

  listEl.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => selectCity(btn.dataset.id));
  });
}

function selectCity(cityId) {
  if (!state.nodeMap.has(cityId)) return;

  state.selectedCityId = cityId;
  document.getElementById("search-input").value = state.nodeMap.get(cityId)?.name || "";
  updateMapView();
  renderPanel();

  const city = state.nodeMap.get(cityId);
  if (city?.lon != null && state.deck) {
    state.deck.setProps({
      initialViewState: {
        longitude: city.lon,
        latitude: city.lat,
        zoom: 5,
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
  state.showArcs = false;
  document.getElementById("country-filter").value = "";
  document.getElementById("continent-filter").value = "";
  document.getElementById("search-input").value = "";
  document.getElementById("show-arcs").checked = false;
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

  for (const cc of Object.keys(state.data.countries).sort()) {
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
    renderPanel();
  });

  continentSelect.addEventListener("change", () => {
    state.continentFilter = continentSelect.value;
    updateMapView();
    renderPanel();
  });

  document.getElementById("show-arcs").addEventListener("change", (e) => {
    state.showArcs = e.target.checked;
    updateMapView();
    renderPanel();
  });

  document.getElementById("reset-btn").addEventListener("click", resetView);
}

function handleMapClick(info) {
  if (info?.object?.id) {
    selectCity(info.object.id);
  }
}

function initDeck() {
  state.deck = new deck.Deck({
    parent: document.getElementById("map"),
    initialViewState: { longitude: 2, latitude: 46, zoom: 2.5, pitch: 0, bearing: 0 },
    controller: true,
    getCursor: ({ isHovering }) => (isHovering ? "pointer" : "grab"),
    onClick: handleMapClick,
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
    renderPanel();

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
