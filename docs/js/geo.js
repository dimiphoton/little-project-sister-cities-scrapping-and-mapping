/** Geo helpers — haversine distance in km. */

export function haversineKm(lon1, lat1, lon2, lat2) {
  const radius = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

export function formatKm(km) {
  if (km == null || Number.isNaN(km)) return "—";
  if (km < 1) return "< 1 km";
  return `${Math.round(km).toLocaleString("en")} km`;
}

export function countryFlag(countryCode, countries) {
  if (!countryCode || !countries[countryCode]) return "";
  return countries[countryCode].flag || countryCode;
}
