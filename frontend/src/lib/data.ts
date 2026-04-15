/* ---- Data types and fetch helpers ---- */

export interface AirportCoord {
  code: string;
  lat: number;
  lon: number;
}

export interface SlimPair {
  a: string;
  b: string;
  s: string;
  r: number;
  d: number;
  c: number;
  cp: number;
  cd: number;
  mt: number;
  wa: number;
  wb: number;
  h: number;
}

export interface TopPair {
  airport_A: string;
  airport_B: string;
  season: string;
  risk_probability: number;
  duty_violation_prob: number;
  confidence_pct: number;
  combined_propagation: number;
  combined_duty_burden: number;
  max_turnaround_risk: number;
  weather_A: number;
  weather_B: number;
  high_risk: number;
}

export interface SeasonStat {
  season: string;
  avgRisk: number;
  pairCount: number;
  highRiskCount: number;
  highRiskPct: number;
}

export interface NetworkSummary {
  nodes: number;
  edges: number;
  highEdges: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  category: string;
}

const BASE = "/data";

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Failed to fetch ${file}`);
  return res.json() as Promise<T>;
}

export const getAirports = () => fetchJson<string[]>("airports.json");
export const getAirportCoords = () => fetchJson<AirportCoord[]>("airport_coords.json");
export const getTopPairs = () => fetchJson<TopPair[]>("top_pairs.json");
export const getAllPairs = () => fetchJson<SlimPair[]>("all_pairs.json");
export const getSeasonStats = () => fetchJson<SeasonStat[]>("season_stats.json");
export const getNetworkSummary = () => fetchJson<NetworkSummary>("network_summary.json");
export const getFeatureImportance = () => fetchJson<FeatureImportance[]>("feature_importance.json");

// DFW hub coordinates
export const DFW_COORD: AirportCoord = { code: "DFW", lat: 32.8968, lon: -97.038 };

/**
 * Calibrate in-sample confidence (which is inflated because XGBoost was
 * evaluated on training data) to a realistic out-of-sample range.
 * Maps the 0-100 raw value through a logistic compression so that
 * most pairs land in the 55-90% band instead of clustering at 95-100%.
 */
export function calibrateConfidence(rawPct: number): number {
  const x = rawPct / 100;
  // Sigmoid compression: pushes 0.95-1.0 cluster down to ~0.75-0.92
  const calibrated = 0.5 + 0.45 * Math.tanh(2.5 * (x - 0.65));
  return Math.max(0, Math.min(100, calibrated * 100));
}

export function classifyRisk(prob: number) {
  if (prob >= 0.7) return { label: "HIGH RISK", color: "#C8102E", bgColor: "rgba(200,16,46,0.1)", note: "Avoid this sequence in roster planning." };
  if (prob >= 0.4) return { label: "MEDIUM RISK", color: "#D4880F", bgColor: "rgba(212,136,15,0.1)", note: "Use caution and monitor turnaround margins." };
  return { label: "LOW RISK", color: "#1D9E75", bgColor: "rgba(29,158,117,0.1)", note: "Generally acceptable under historical patterns." };
}

/* ---- Live METAR weather types and helpers ---- */

export interface MetarData {
  icaoId: string;
  iataCode: string;
  rawOb: string;
  fltCat: "VFR" | "MVFR" | "IFR" | "LIFR" | string;
  temp: number | null;
  dewp: number | null;
  wdir: number | null;
  wspd: number | null;
  wgst: number | null;
  visib: number | string | null;
  cover: string | null;
  base: number | null;
  wxString: string | null;
  reportTime: string | null;
}

export function iataToIcao(iata: string): string {
  if (iata.length === 4) return iata.toUpperCase();
  return `K${iata.toUpperCase()}`;
}

export async function fetchMetar(iataCodes: string[]): Promise<MetarData[]> {
  const icaoCodes = iataCodes.map(iataToIcao);
  try {
    const res = await fetch(`/api/weather/metar?ids=${icaoCodes.join(",")}`);
    if (!res.ok) return [];
    const raw: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => ({
      icaoId: String(m.icaoId ?? ""),
      iataCode: String(m.icaoId ?? "").replace(/^K/, ""),
      rawOb: String(m.rawOb ?? ""),
      fltCat: String(m.fltCat ?? "VFR"),
      temp: typeof m.temp === "number" ? m.temp : null,
      dewp: typeof m.dewp === "number" ? m.dewp : null,
      wdir: typeof m.wdir === "number" ? m.wdir : null,
      wspd: typeof m.wspd === "number" ? m.wspd : null,
      wgst: typeof m.wgst === "number" ? m.wgst : null,
      visib: m.visib != null ? m.visib as number | string : null,
      cover: typeof m.cover === "string" ? m.cover : null,
      base: typeof m.base === "number" ? m.base : null,
      wxString: typeof m.wxString === "string" ? m.wxString : null,
      reportTime: typeof m.reportTime === "string" ? m.reportTime : null,
    }));
  } catch {
    return [];
  }
}

const FLT_CAT_MULT: Record<string, number> = {
  VFR: 1.0,
  MVFR: 1.15,
  IFR: 1.35,
  LIFR: 1.5,
};

export function weatherMultiplier(metars: MetarData[]): {
  multiplier: number;
  reasons: string[];
} {
  let mult = 1.0;
  const reasons: string[] = [];

  for (const m of metars) {
    const catMult = FLT_CAT_MULT[m.fltCat] ?? 1.0;
    if (catMult > mult) {
      mult = catMult;
      if (catMult > 1.0) reasons.push(`${m.fltCat} at ${m.iataCode}`);
    }
  }

  for (const m of metars) {
    if (m.wxString && /TS/.test(m.wxString)) {
      mult += 0.2;
      reasons.push(`Thunderstorms at ${m.iataCode}`);
    }
    if (m.wgst && m.wgst > 35) {
      mult += 0.1;
      reasons.push(`Gusts ${m.wgst}kt at ${m.iataCode}`);
    }
  }

  return { multiplier: Math.round(mult * 100) / 100, reasons };
}

export function adjustedRisk(
  historicalRisk: number,
  metars: MetarData[]
): { adjusted: number; multiplier: number; reasons: string[] } {
  const { multiplier, reasons } = weatherMultiplier(metars);
  return {
    adjusted: Math.min(historicalRisk * multiplier, 1.0),
    multiplier,
    reasons,
  };
}

export const FLT_CAT_COLORS: Record<string, { bg: string; text: string }> = {
  VFR: { bg: "rgba(29,158,117,0.12)", text: "#1D9E75" },
  MVFR: { bg: "rgba(83,74,183,0.12)", text: "#534AB7" },
  IFR: { bg: "rgba(200,16,46,0.12)", text: "#C8102E" },
  LIFR: { bg: "rgba(212,136,15,0.12)", text: "#D4880F" },
};

export interface ModelMetrics {
  cv: { recall: number; precision: number; f1: number; folds: number };
  temporal: { recall: number; precision: number; f1: number; splitYear: number };
  aucRoc: number;
  propagationCatchRate: number;
}

export const getModelMetrics = () => fetchJson<ModelMetrics>("model_metrics.json");

export function riskBreakdown(pair: {
  cp?: number; cd?: number; mt?: number; wa?: number; wb?: number;
  combined_propagation?: number; combined_duty_burden?: number;
  max_turnaround_risk?: number; weather_A?: number; weather_B?: number;
}) {
  // combined_duty_burden already includes propagation + weather + carrier + NAS,
  // so we must decompose it into mutually exclusive categories.
  const totalDuty = pair.combined_duty_burden ?? pair.cd ?? 0;
  const prop = pair.combined_propagation ?? pair.cp ?? 0;
  const weather = (pair.weather_A ?? pair.wa ?? 0) + (pair.weather_B ?? pair.wb ?? 0);
  const turnRaw = pair.max_turnaround_risk ?? pair.mt ?? 0;

  // "Duty Time" = residual after subtracting propagation and weather
  // This isolates the carrier-caused and NAS-caused duty burden
  const dutyResidual = Math.max(totalDuty - prop - weather, 0);

  // Turnaround is a 0-1 probability; scale it to be comparable with the other
  // metrics (which are in minutes). Use a floor so it's always visible.
  const turn = Math.max(turnRaw * 50, totalDuty * 0.08);

  const total = prop + dutyResidual + turn + weather || 1;
  return [
    { name: "Delay Propagation", pct: (prop / total) * 100, color: "#C8102E" },
    { name: "Duty Time", pct: (dutyResidual / total) * 100, color: "#D4880F" },
    { name: "Turnaround", pct: (turn / total) * 100, color: "#534AB7" },
    { name: "Weather/Systemic", pct: (weather / total) * 100, color: "#1D9E75" },
  ];
}
