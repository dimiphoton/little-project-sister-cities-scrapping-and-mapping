/** D3 charts — chord + top cities bar. */

export function renderTopCities(container, topCities, onSelectCity) {
  container.innerHTML = "";
  if (!topCities?.length) {
    container.textContent = "No data";
    return;
  }

  const width = container.clientWidth || 400;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 10, left: 100 };

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const maxDegree = d3.max(topCities, (d) => d.degree) || 1;
  const x = d3
    .scaleLinear()
    .domain([0, maxDegree])
    .range([0, width - margin.left - margin.right]);
  const y = d3
    .scaleBand()
    .domain(topCities.map((d) => d.n))
    .range([0, height - margin.top - margin.bottom])
    .padding(0.15);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.selectAll("rect")
    .data(topCities)
    .join("rect")
    .attr("y", (d) => y(d.n))
    .attr("width", (d) => x(d.degree))
    .attr("height", y.bandwidth())
    .attr("fill", "#58a6ff")
    .attr("rx", 3)
    .style("cursor", "pointer")
    .on("click", (_, d) => onSelectCity?.(d.id));

  g.selectAll("text.label")
    .data(topCities)
    .join("text")
    .attr("class", "label")
    .attr("x", -6)
    .attr("y", (d) => y(d.n) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("fill", "#e6edf3")
    .attr("font-size", "11px")
    .text((d) => d.n);
}

export function renderChord(container, chordData) {
  container.innerHTML = "";
  const labels = chordData?.labels || [];
  const matrix = chordData?.matrix || [];

  if (labels.length < 2) {
    container.innerHTML = "<p class='hint'>Need at least 2 countries for chord diagram.</p>";
    return;
  }

  const size = Math.min(container.clientWidth || 320, 320);
  const outerRadius = size * 0.4;
  const innerRadius = outerRadius - 20;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", size)
    .attr("height", size)
    .append("g")
    .attr("transform", `translate(${size / 2},${size / 2})`);

  const chord = d3.chord().padAngle(0.05)(matrix);
  const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
  const ribbon = d3.ribbon().radius(innerRadius);

  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(labels);

  svg
    .append("g")
    .selectAll("path")
    .data(chord.groups)
    .join("path")
    .attr("fill", (d) => color(labels[d.index]))
    .attr("stroke", "#0d1117")
    .attr("d", arc)
    .append("title")
    .text((d) => labels[d.index]);

  svg
    .append("g")
    .attr("fill-opacity", 0.7)
    .selectAll("path")
    .data(chord)
    .join("path")
    .attr("fill", (d) => color(labels[d.target.index]))
    .attr("d", ribbon)
    .append("title")
    .text((d) => `${labels[d.source.index]} → ${labels[d.target.index]}: ${matrix[d.source.index][d.target.index]}`);
}

export function updateHeroKpis(stats, metadata) {
  const kpis = stats?.kpis || {};
  document.getElementById("kpi-cities").textContent = (kpis.city_count ?? "—").toLocaleString("en");
  document.getElementById("kpi-links").textContent = (kpis.link_count ?? "—").toLocaleString("en");
  document.getElementById("kpi-countries").textContent = (kpis.country_count ?? "—").toLocaleString("en");

  const updated = metadata?.last_run || metadata?.generated_at;
  document.getElementById("last-updated").textContent = updated
    ? new Date(updated).toLocaleDateString("en", { dateStyle: "medium" })
    : "—";
}
