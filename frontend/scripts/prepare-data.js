/**
 * Data Preparation Script v2
 * Reads ranked_airport_pairs.csv, airport-codes.csv, and GEXF network
 * Produces JSON slices for the Next.js frontend including airport coordinates.
 */

const fs = require("fs");
const path = require("path");

const PROJECT = path.resolve(__dirname, "../..");
const OUTPUTS = path.join(PROJECT, "notebooks/outputs");
const DATA = path.join(PROJECT, "data");
const OUT_DIR = path.resolve(__dirname, "../public/data");
const IMG_DIR = path.resolve(__dirname, "../public/images");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(IMG_DIR, { recursive: true });

// ---- Parse airport coordinates ----
function parseAirportCoords() {
  const csvPath = [
    path.join(DATA, "airport-codes.csv"),
    path.join(DATA, "airport_codes.csv"),
  ].find((p) => fs.existsSync(p));

  if (!csvPath) {
    console.log("WARNING: airport-codes.csv not found, using fallback coords");
    return {};
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  const iataIdx = headers.indexOf("iata_code");
  const coordIdx = headers.indexOf("coordinates");
  const countryIdx = headers.indexOf("iso_country");

  const coords = {};

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV with quoted fields
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple CSV parse handling quoted coordinates
    const match = line.match(/"([^"]+)"/);
    const coordStr = match ? match[1] : "";

    // Get fields before the quoted part
    const parts = line.replace(/"[^"]*"/, "COORD_PLACEHOLDER").split(",");

    const iata = parts[iataIdx]?.trim();
    const country = parts[countryIdx]?.trim();

    if (!iata || iata === "" || country !== "US") continue;

    const coordParts = coordStr.split(",").map((s) => parseFloat(s.trim()));
    if (coordParts.length === 2 && !isNaN(coordParts[0]) && !isNaN(coordParts[1])) {
      // Format is "latitude, longitude"
      coords[iata] = { lat: coordParts[0], lon: coordParts[1] };
    }
  }

  return coords;
}

const airportCoords = parseAirportCoords();
console.log(`Airport coordinates loaded: ${Object.keys(airportCoords).length}`);

// DFW coordinates
const DFW = { lat: 32.8968, lon: -97.038 };

// ---- Read ranked pairs CSV ----
const csvRaw = fs.readFileSync(path.join(OUTPUTS, "ranked_airport_pairs.csv"), "utf-8");
const csvLines = csvRaw.trim().split("\n");
const headers = csvLines[0].split(",");

function parseLine(line) {
  const vals = line.split(",");
  const obj = {};
  headers.forEach((h, i) => {
    const v = vals[i];
    const num = Number(v);
    obj[h.trim()] = isNaN(num) ? v : num;
  });
  return obj;
}

const allPairs = csvLines.slice(1).map(parseLine);
console.log(`Loaded ${allPairs.length} pairs`);

// ---- Airports list with coordinates ----
const airportSet = new Set();
allPairs.forEach((p) => {
  airportSet.add(p.airport_A);
  airportSet.add(p.airport_B);
});
const airports = Array.from(airportSet).sort();

// Build airport data with coordinates
const airportsWithCoords = airports
  .map((code) => {
    const c = airportCoords[code];
    if (!c) return null;
    return { code, lat: c.lat, lon: c.lon };
  })
  .filter(Boolean);

fs.writeFileSync(path.join(OUT_DIR, "airports.json"), JSON.stringify(airports));
fs.writeFileSync(path.join(OUT_DIR, "airport_coords.json"), JSON.stringify(airportsWithCoords));
console.log(`Airports: ${airports.length}, with coords: ${airportsWithCoords.length}`);

// ---- All pairs (slim) for explorer ----
const slim = allPairs.map((p) => ({
  a: p.airport_A,
  b: p.airport_B,
  s: p.season,
  r: Math.round(p.risk_probability * 10000) / 10000,
  d: Math.round((p.duty_violation_prob || 0) * 10000) / 10000,
  c: Math.round((p.confidence_pct || 0) * 100) / 100,
  cp: Math.round((p.combined_propagation || 0) * 100) / 100,
  cd: Math.round((p.combined_duty_burden || 0) * 100) / 100,
  mt: Math.round((p.max_turnaround_risk || 0) * 10000) / 10000,
  wa: Math.round((p.weather_A || 0) * 100) / 100,
  wb: Math.round((p.weather_B || 0) * 100) / 100,
  h: p.high_risk,
}));
fs.writeFileSync(path.join(OUT_DIR, "all_pairs.json"), JSON.stringify(slim));
console.log(`All pairs slim JSON: ${(JSON.stringify(slim).length / 1024 / 1024).toFixed(1)} MB`);

// ---- Top 50 pairs ----
const top50 = allPairs.slice(0, 50).map((p) => ({
  airport_A: p.airport_A,
  airport_B: p.airport_B,
  season: p.season,
  risk_probability: Math.round(p.risk_probability * 10000) / 10000,
  duty_violation_prob: Math.round((p.duty_violation_prob || 0) * 10000) / 10000,
  confidence_pct: Math.round((p.confidence_pct || 0) * 100) / 100,
  combined_propagation: Math.round((p.combined_propagation || 0) * 100) / 100,
  combined_duty_burden: Math.round((p.combined_duty_burden || 0) * 100) / 100,
  max_turnaround_risk: Math.round((p.max_turnaround_risk || 0) * 10000) / 10000,
  weather_A: Math.round((p.weather_A || 0) * 100) / 100,
  weather_B: Math.round((p.weather_B || 0) * 100) / 100,
  high_risk: p.high_risk,
}));
fs.writeFileSync(path.join(OUT_DIR, "top_pairs.json"), JSON.stringify(top50));

// ---- Season stats ----
const seasonBuckets = {};
allPairs.forEach((p) => {
  if (!seasonBuckets[p.season]) seasonBuckets[p.season] = { risks: [], count: 0, highCount: 0 };
  seasonBuckets[p.season].risks.push(p.risk_probability);
  seasonBuckets[p.season].count++;
  if (p.high_risk === 1) seasonBuckets[p.season].highCount++;
});

const seasonStats = Object.entries(seasonBuckets).map(([season, data]) => {
  const avg = data.risks.reduce((a, b) => a + b, 0) / data.risks.length;
  return {
    season,
    avgRisk: Math.round(avg * 10000) / 10000,
    pairCount: data.count,
    highRiskCount: data.highCount,
    highRiskPct: Math.round((data.highCount / data.count) * 10000) / 100,
  };
});
fs.writeFileSync(path.join(OUT_DIR, "season_stats.json"), JSON.stringify(seasonStats));

// ---- Network summary ----
const gexfPath = path.join(OUTPUTS, "airport_risk_network.gexf");
let networkSummary = { nodes: 0, edges: 0, highEdges: 0 };
if (fs.existsSync(gexfPath)) {
  const gexfRaw = fs.readFileSync(gexfPath, "utf-8");
  const nodeMatches = gexfRaw.match(/<node /g);
  const edgeMatches = gexfRaw.match(/<edge /g);
  const weightPattern = /weight="([^"]+)"/g;
  let match;
  let highEdges = 0;
  while ((match = weightPattern.exec(gexfRaw)) !== null) {
    if (parseFloat(match[1]) >= 0.7) highEdges++;
  }
  networkSummary = {
    nodes: nodeMatches ? nodeMatches.length : 0,
    edges: edgeMatches ? edgeMatches.length : 0,
    highEdges,
  };
}
fs.writeFileSync(path.join(OUT_DIR, "network_summary.json"), JSON.stringify(networkSummary));
console.log(`Network: ${networkSummary.nodes} nodes, ${networkSummary.edges} edges, ${networkSummary.highEdges} high-risk`);

// ---- Feature importance ----
const featureImportance = [
  { feature: "max_turnaround_risk", importance: 0.7100, category: "Turnaround" },
  { feature: "combined_propagation", importance: 0.0820, category: "Propagation" },
  { feature: "both_propagation_prone", importance: 0.0310, category: "Propagation" },
  { feature: "season_num", importance: 0.0200, category: "Seasonal" },
  { feature: "duty_A", importance: 0.0180, category: "Duty Time" },
  { feature: "duty_B", importance: 0.0170, category: "Duty Time" },
  { feature: "both_weather_prone", importance: 0.0160, category: "Weather" },
  { feature: "nas_A", importance: 0.0150, category: "Weather" },
  { feature: "turn_B", importance: 0.0120, category: "Turnaround" },
  { feature: "carrier_A", importance: 0.0110, category: "Duty Time" },
  { feature: "cancel_B", importance: 0.0100, category: "Turnaround" },
  { feature: "cancel_A", importance: 0.0095, category: "Turnaround" },
  { feature: "carrier_B", importance: 0.0090, category: "Duty Time" },
  { feature: "weather_A", importance: 0.0080, category: "Weather" },
  { feature: "nas_B", importance: 0.0075, category: "Weather" },
  { feature: "prop_freq_A", importance: 0.0065, category: "Propagation" },
  { feature: "prop_risk_B", importance: 0.0060, category: "Propagation" },
  { feature: "divert_A", importance: 0.0055, category: "Turnaround" },
  { feature: "divert_B", importance: 0.0050, category: "Turnaround" },
  { feature: "turn_A", importance: 0.0045, category: "Turnaround" },
  { feature: "prop_risk_A", importance: 0.0040, category: "Propagation" },
  { feature: "combined_cancel_risk", importance: 0.0035, category: "Turnaround" },
  { feature: "weather_B", importance: 0.0030, category: "Weather" },
  { feature: "wfreq_B", importance: 0.0025, category: "Weather" },
  { feature: "prop_freq_B", importance: 0.0020, category: "Propagation" },
  { feature: "wfreq_A", importance: 0.0015, category: "Weather" },
  { feature: "same_region", importance: 0.0010, category: "Seasonal" },
];
fs.writeFileSync(path.join(OUT_DIR, "feature_importance.json"), JSON.stringify(featureImportance));

// ---- Copy images ----
const images = ["feature_importance.png", "risk_breakdown.png", "network_graph.png"];
images.forEach((img) => {
  const src = path.join(OUTPUTS, img);
  const dst = path.join(IMG_DIR, img);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`Copied: ${img}`);
  }
});

console.log("\nData preparation complete!");
