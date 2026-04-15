"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  getFeatureImportance,
  getTopPairs,
  getNetworkSummary,
  getSeasonStats,
  getModelMetrics,
  riskBreakdown,
  type FeatureImportance,
  type TopPair,
  type NetworkSummary,
  type SeasonStat,
  type ModelMetrics,
} from "@/lib/data";
import { AsciiBackground } from "@/components/ascii-background";
import {
  Plane,
  Database,
  Workflow,
  Brain,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Layers,
  Target,
  Cloud,
  Radio,
  Globe,
  Radar,
  ShieldAlert,
  FlaskConical,
  Scale,
  Lightbulb,
} from "lucide-react";

export default function ModelPage() {
  const [features, setFeatures] = useState<FeatureImportance[]>([]);
  const [topPairs, setTopPairs] = useState<TopPair[]>([]);
  const [network, setNetwork] = useState<NetworkSummary | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStat[]>([]);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);

  useEffect(() => {
    getFeatureImportance().then(setFeatures);
    getTopPairs().then((d) => setTopPairs(d.slice(0, 10)));
    getNetworkSummary().then(setNetwork);
    getSeasonStats().then(setSeasonStats);
    getModelMetrics().then(setMetrics).catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen">
      <AsciiBackground />

      <div className="relative z-10">
        {/* --- Nav --- */}
        <header className="bg-[#0A1A3A] text-white">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C8102E]">
                <Plane className="h-4 w-4 text-white -rotate-45" />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-tight">CrewRisk</span>
                <span className="ml-1.5 text-[10px] uppercase tracking-widest text-white/50">
                  AA Analytics
                </span>
              </div>
            </div>

            <div className="flex items-center gap-0 border border-white/15 rounded-lg overflow-hidden">
              <Link href="/" className="page-toggle-btn">
                Flight Map
              </Link>
              <Link href="/model" className="page-toggle-btn active">
                Model Rundown
              </Link>
            </div>

            <div className="text-[10px] uppercase tracking-widest text-white/40">
              GROW 26.2
            </div>
          </div>
        </header>

        {/* --- Content --- */}
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          {/* Title */}
          <div className="mb-8 animate-fade-in-up">
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>XGBoost Decision Pipeline</h1>
            <p className="mt-1 text-sm text-[#6B7B8D]">
              How the model identifies sub-optimal pilot crew sequences
            </p>
          </div>

          {/* --- Mind Map / Decision Flow --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Decision Flow
            </h2>

            {/* Flow diagram built with cards and connectors */}
            <div className="relative">
              {/* Step 1: Data Ingestion */}
              <div className="grid gap-4 md:grid-cols-5">
                <FlowNode
                  icon={<Database className="h-5 w-5" />}
                  title="1. Data Ingestion"
                  description="BTS on-time performance data: 6M+ flight records across 141 airports."
                  items={["Departure delays", "Arrival delays", "Cancellation codes", "Weather events"]}
                  color="#0078D2"
                  primary
                />
                <FlowConnector />
                <FlowNode
                  icon={<Workflow className="h-5 w-5" />}
                  title="2. Feature Engineering"
                  description="27 leakage-safe features built per airport pair by season."
                  items={["Propagation risk scores", "Duty burden metrics", "Turnaround reliability", "Weather frequency"]}
                  color="#D4880F"
                />
                <FlowConnector />
                <FlowNode
                  icon={<Brain className="h-5 w-5" />}
                  title="3. XGBoost Model"
                  description="Gradient-boosted ensemble, 300 trees. Learns non-linear risk surfaces."
                  items={["Binary classification", "80/20 train-test split", "0.89 AUC-ROC score", "Confidence calibration"]}
                  color="#C8102E"
                  primary
                />
              </div>

              <div className="my-4 flex items-center justify-center gap-2 text-[#6B7B8D]">
                <ArrowRight className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider">Output</span>
                <ArrowRight className="h-4 w-4" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FlowNode
                  icon={<Target className="h-5 w-5" />}
                  title="4. Risk Scoring"
                  description="Each 36,052 airport pair × season receives a probability score."
                  items={["P(disruption) from 0→1", "FAA duty hour check", "Confidence percentage"]}
                  color="#534AB7"
                />
                <FlowNode
                  icon={<Layers className="h-5 w-5" />}
                  title="5. Classification"
                  description="Pairs above 0.7 are flagged as HIGH RISK for crew scheduling."
                  items={["HIGH ≥ 0.7 — Avoid", "MEDIUM 0.4–0.7 — Monitor", "LOW < 0.4 — Acceptable"]}
                  color="#C8102E"
                />
                <FlowNode
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title="6. Actionable Output"
                  description="Ranked list of pairs to exclude from pilot crew sequences."
                  items={[`${network?.highEdges.toLocaleString() ?? "1,207"} flagged pairs`, "Per-season recommendations", "Risk breakdown per route"]}
                  color="#1D9E75"
                />
              </div>
            </div>
          </section>

          {/* --- Feature Importance --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Feature Importance
            </h2>
            <p className="mb-5 text-xs text-[#6B7B8D]">
              What the model weighs most when scoring a pair
            </p>

            <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-6">
              <div className="space-y-2">
                {features.slice(0, 15).map((f, i) => (
                  <FeatureBar key={f.feature} feature={f} rank={i + 1} maxImportance={features[0]?.importance ?? 1} />
                ))}
              </div>

              {/* Category legend */}
              <div className="mt-5 flex flex-wrap gap-4 border-t border-[#0A1A3A]/6 pt-4">
                {[
                  { label: "Turnaround", color: "#534AB7" },
                  { label: "Propagation", color: "#C8102E" },
                  { label: "Duty Time", color: "#D4880F" },
                  { label: "Weather", color: "#1D9E75" },
                  { label: "Seasonal", color: "#6B7B8D" },
                ].map((cat) => (
                  <span key={cat.label} className="flex items-center gap-1.5 text-xs text-[#6B7B8D]">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                    {cat.label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* --- Top Flagged Pairs --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Top 10 Flagged Pairs
            </h2>
            <p className="mb-5 text-xs text-[#6B7B8D]">
              Sequences the model recommends removing from pilot rosters
            </p>

            <div className="rounded-xl border border-[#0A1A3A]/8 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#0A1A3A]/6">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7B8D]">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7B8D]">Sequence</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7B8D]">Season</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6B7B8D]">Risk Score</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6B7B8D]">Primary Driver</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[#6B7B8D]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topPairs.map((pair, i) => {
                    const bd = riskBreakdown(pair);
                    const topDriver = bd.reduce((a, b) => (a.pct > b.pct ? a : b));
                    return (
                      <tr key={`${pair.airport_A}-${pair.airport_B}-${pair.season}`} className="border-b border-[#0A1A3A]/4 hover:bg-[#E8ECF0]/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[#6B7B8D]">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold">{pair.airport_A}</span>
                          <span className="mx-1 text-[#6B7B8D]">→ DFW →</span>
                          <span className="font-mono font-semibold">{pair.airport_B}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">{pair.season}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#C8102E]">
                          {pair.risk_probability.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: topDriver.color }} />
                            {topDriver.name} ({topDriver.pct.toFixed(0)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full bg-[#C8102E]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#C8102E]">
                            Remove
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* --- Seasonal Breakdown --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Seasonal Risk Summary
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {seasonStats.map((s) => {
                const seasonColors: Record<string, string> = {
                  Spring: "#1D9E75",
                  Summer: "#D4880F",
                  Fall: "#C8102E",
                  Winter: "#0078D2",
                };
                const color = seasonColors[s.season] ?? "#7D6B5D";
                return (
                  <div
                    key={s.season}
                    className="rounded-xl border border-[#0A1A3A]/8 bg-white p-4"
                    style={{ borderTopColor: color, borderTopWidth: 3 }}
                  >
                    <h3 className="font-semibold mb-2" style={{ color }}>{s.season}</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[#6B7B8D]">Avg Risk</p>
                        <p className="font-mono font-semibold text-base">{(s.avgRisk * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[#6B7B8D]">High-Risk %</p>
                        <p className="font-mono font-semibold text-base">{s.highRiskPct.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[#6B7B8D]">Total Pairs</p>
                        <p className="font-mono">{s.pairCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[#6B7B8D]">Flagged</p>
                        <p className="font-mono text-[#C8102E]">{s.highRiskCount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* --- Network graph image --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Airport Risk Network
            </h2>
            <p className="mb-5 text-xs text-[#6B7B8D]">
              Red edges = HIGH RISK (≥0.7), green edges = acceptable. Cluster density shows dangerous sub-networks.
            </p>
            <div className="rounded-xl border border-[#0A1A3A]/8 bg-white overflow-hidden">
              <Image
                src="/images/network_graph.png"
                alt="Airport risk network graph"
                width={1600}
                height={1200}
                className="w-full h-auto"
                priority
              />
            </div>
          </section>

          {/* --- Data Sources & Methodology --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Data Sources & Methodology
            </h2>
            <p className="mb-5 text-xs text-[#6B7B8D]">
              How we sourced, enriched, and supplemented flight and weather data
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DataSourceCard
                icon={<Database className="h-5 w-5" />}
                title="BTS On-Time Performance"
                status="Primary"
                statusColor="#1D9E75"
                description="6M+ American Airlines flight records from the Bureau of Transportation Statistics. Provides delay minutes by cause (weather, carrier, NAS, late aircraft), cancellation and diversion rates — the foundation for all risk features."
                url="transtats.bts.gov"
              />
              <DataSourceCard
                icon={<Cloud className="h-5 w-5" />}
                title="AWC METAR (Live)"
                status="Integrated"
                statusColor="#0078D2"
                description="Real-time terminal observations from the Aviation Weather Center. Provides flight category (VFR/IFR/LIFR), wind, visibility, ceiling, and active weather phenomena. Used to dynamically adjust risk scores on the Flight Map."
                url="aviationweather.gov"
              />
              <DataSourceCard
                icon={<Globe className="h-5 w-5" />}
                title="Airport Geospatial Data"
                status="Used"
                statusColor="#1D9E75"
                description="IATA/ICAO codes, coordinates, state, and US region for every airport. Enables the same-region flag — airports sharing regional storm patterns carry compounded risk."
                url="github.com/datasets/airport-codes"
              />
              <DataSourceCard
                icon={<Radar className="h-5 w-5" />}
                title="FAA ASPM"
                status="Recommended"
                statusColor="#D4880F"
                description="Aviation System Performance Metrics would provide direct airport efficiency scores, taxi times, and gate-to-gate delay data — richer than BTS cause-aggregated columns."
                url="aspm.faa.gov"
              />
              <DataSourceCard
                icon={<Radio className="h-5 w-5" />}
                title="NOAA Historical Weather"
                status="Recommended"
                statusColor="#D4880F"
                description="Hourly station observations with precipitation type, wind gusts, and visibility would replace BTS weather_delay proxies with actual meteorological measurements per airport per hour."
                url="weather.gov"
              />
              <DataSourceCard
                icon={<Plane className="h-5 w-5 -rotate-45" />}
                title="OpenSky Network"
                status="Recommended"
                statusColor="#D4880F"
                description="Real-time ADS-B aircraft positions could provide live traffic density as a congestion proxy — high density near an airport correlates with NAS delays and tighter turnarounds."
                url="opensky-network.org"
              />
            </div>
            <div className="mt-4 rounded-lg border border-[#0A1A3A]/6 bg-[#E8ECF0]/50 px-4 py-3 text-xs text-[#3A4A5A] leading-relaxed">
              <span className="font-semibold text-[#0A1A3A]">Why BTS as primary:</span>{" "}
              BTS On-Time Performance is the only public dataset that provides cause-decomposed delay minutes per airline per airport per month — 
              exactly the granularity needed to separate weather, propagation, carrier, and NAS effects. The AWC live overlay compensates for BTS being 
              historical-only by injecting current conditions into the risk assessment.
            </div>
          </section>

          {/* --- Addressing Sparse Weather Events --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Addressing Sparse Weather Events
            </h2>
            <p className="mb-5 text-xs text-[#6B7B8D]">
              Severe weather is rare but devastating — here&apos;s how we handle the long tail
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                <div className="flex items-center gap-2 mb-3 text-[#534AB7]">
                  <ShieldAlert className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-[#0A1A3A]">Minimum Flight Threshold</h3>
                </div>
                <p className="text-xs text-[#6B7B8D] leading-relaxed mb-3">
                  Airports with fewer than 100 total flights are excluded. With sparse data, a single severe weather event 
                  can dominate the risk profile and create misleading signals the model cannot distinguish from noise.
                </p>
                <div className="rounded-lg bg-[#534AB7]/8 px-3 py-2 text-[11px] font-mono text-[#534AB7]">
                  MIN_FLIGHTS = 100
                </div>
              </div>
              <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                <div className="flex items-center gap-2 mb-3 text-[#C8102E]">
                  <Scale className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-[#0A1A3A]">Class Imbalance Weighting</h3>
                </div>
                <p className="text-xs text-[#6B7B8D] leading-relaxed mb-3">
                  Severe weather affects ~30% of pairs. Without correction, the model would learn to predict &quot;low risk&quot; for everything. 
                  XGBoost&apos;s <code className="text-[11px] bg-[#E8ECF0] px-1 rounded">scale_pos_weight</code> upweights the minority class, 
                  ensuring rare but dangerous patterns are learned.
                </p>
                <div className="rounded-lg bg-[#C8102E]/8 px-3 py-2 text-[11px] font-mono text-[#C8102E]">
                  scale_pos_weight = neg_count / pos_count
                </div>
              </div>
              <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                <div className="flex items-center gap-2 mb-3 text-[#0078D2]">
                  <Cloud className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-[#0A1A3A]">Real-Time Weather Overlay</h3>
                </div>
                <p className="text-xs text-[#6B7B8D] leading-relaxed mb-3">
                  Historical data can&apos;t capture a storm happening right now. Live METAR data from AWC creates a complementary layer: 
                  when IFR/LIFR or thunderstorms are active, the risk multiplier boosts the historical score — catching conditions the training data underrepresents.
                </p>
                <div className="rounded-lg bg-[#0078D2]/8 px-3 py-2 text-[11px] font-mono text-[#0078D2]">
                  adjusted = historical × weather_multiplier
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-[#D4880F]/40 bg-[#D4880F]/5 px-4 py-3 text-xs text-[#3A4A5A] leading-relaxed">
              <span className="font-semibold text-[#D4880F]">Production enhancements:</span>{" "}
              SMOTE oversampling of rare severe-weather pairs, extended historical windows (10+ years), NOAA weather reanalysis grids 
              for sub-hourly precipitation and wind data, and ensemble methods that combine gradient boosting with weather-specific models.
            </div>
          </section>

          {/* --- Model Validation --- */}
          {metrics && (
            <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
                Model Validation
              </h2>
              <p className="mb-5 text-xs text-[#6B7B8D]">
                Performance measured with stratified cross-validation and temporal holdout
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Stratified CV */}
                <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                  <div className="flex items-center gap-2 mb-3 text-[#0078D2]">
                    <FlaskConical className="h-5 w-5" />
                    <h3 className="text-sm font-semibold text-[#0A1A3A]">{metrics.cv.folds}-Fold Stratified CV</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <ValidationMetric label="Recall" value={metrics.cv.recall} primary />
                    <ValidationMetric label="Precision" value={metrics.cv.precision} />
                    <ValidationMetric label="F1" value={metrics.cv.f1} />
                  </div>
                  <p className="text-[11px] text-[#6B7B8D] leading-relaxed">
                    Each fold preserves the class distribution and season balance. Recall is the primary metric — 
                    missing a dangerous pair (false negative) is far worse than over-flagging a safe one (false positive).
                  </p>
                </div>
                {/* Temporal Holdout */}
                <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                  <div className="flex items-center gap-2 mb-3 text-[#534AB7]">
                    <FlaskConical className="h-5 w-5" />
                    <h3 className="text-sm font-semibold text-[#0A1A3A]">Temporal Holdout (pre/post {metrics.temporal.splitYear})</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <ValidationMetric label="Recall" value={metrics.temporal.recall} primary />
                    <ValidationMetric label="Precision" value={metrics.temporal.precision} />
                    <ValidationMetric label="F1" value={metrics.temporal.f1} />
                  </div>
                  <p className="text-[11px] text-[#6B7B8D] leading-relaxed">
                    Train on years before {metrics.temporal.splitYear}, test on years after — simulates real deployment where the model 
                    predicts future risk from past patterns. A stricter test than random folds.
                  </p>
                </div>
              </div>
              {/* Additional metrics row */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7B8D]">AUC-ROC Score</p>
                    <p className="text-xs text-[#6B7B8D] mt-0.5">Area under the receiver operating curve</p>
                  </div>
                  <p className="text-2xl font-bold font-mono text-[#0078D2]">{metrics.aucRoc.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7B8D]">Propagation Catch Rate</p>
                    <p className="text-xs text-[#6B7B8D] mt-0.5">% of double-cascade pairs correctly flagged</p>
                  </div>
                  <p className="text-2xl font-bold font-mono text-[#C8102E]">{(metrics.propagationCatchRate * 100).toFixed(0)}%</p>
                </div>
              </div>
            </section>
          )}

          {/* --- Limitations & Future Work --- */}
          <section className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#6B7B8D]">
              Limitations & Future Work
            </h2>
            <p className="mb-5 text-xs text-[#6B7B8D]">
              Honest constraints and a roadmap for production deployment
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Limitations */}
              <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                <div className="flex items-center gap-2 mb-3 text-[#D4880F]">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-[#0A1A3A]">Current Limitations</h3>
                </div>
                <ul className="space-y-2.5">
                  <LimitationItem text="Labels are derived from composite risk (a statistical proxy), not ground-truth disruption outcomes from actual crew operations." />
                  <LimitationItem text="No actual crew schedule data — duty violation probability is estimated from delay accumulation rather than real FAA duty time tracking." />
                  <LimitationItem text="BTS weather_delay is an aggregated proxy; actual hourly weather conditions (METAR/TAF) would provide finer-grained risk signals." />
                  <LimitationItem text="Historical patterns assume future similarity — significant route network changes or new weather patterns could shift risk profiles." />
                  <LimitationItem text="Model evaluates 2-leg sequences (A→DFW→B) only. Real pilot sequences span multiple days and legs." />
                </ul>
              </div>
              {/* Future Work */}
              <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                <div className="flex items-center gap-2 mb-3 text-[#1D9E75]">
                  <Lightbulb className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-[#0A1A3A]">Production Roadmap</h3>
                </div>
                <ul className="space-y-2.5">
                  <RoadmapItem text="Integrate actual crew scheduling constraints (FAA rest rules, union agreements, aircraft-specific turnaround minimums)." />
                  <RoadmapItem text="Incorporate NOAA weather reanalysis data for hourly precipitation, wind, and visibility features per airport." />
                  <RoadmapItem text="Deploy as a real-time API that crew scheduling systems query before assigning a pilot to a sequence." />
                  <RoadmapItem text="Add a feedback loop from actual disruption outcomes (delayed sequences, duty violations) to continuously retrain the model." />
                  <RoadmapItem text="Extend to multi-leg sequences using graph-based sequence optimization (e.g., shortest path through low-risk edges)." />
                </ul>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-[#0A1A3A]/6 pt-6 pb-10">
            <div className="flex flex-col items-center gap-2 text-[#6B7B8D]">
              <div className="flex items-center gap-2">
                <Plane className="h-3.5 w-3.5 -rotate-45" />
                <span className="text-xs">EPPS × American Airlines Data Challenge — GROW 26.2</span>
              </div>
              <p className="text-[10px]">Built with XGBoost · Next.js · AWC METAR · react-simple-maps</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ---- Helper components ---- */

function FlowNode({
  icon,
  title,
  description,
  items,
  color,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: string[];
  color: string;
  primary?: boolean;
}) {
  return (
    <div className={`node-card ${primary ? "primary" : ""}`} style={primary ? { borderColor: color } : undefined} >
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <h3 className="text-sm font-semibold text-[#0A1A3A]">{title}</h3>
      </div>
      <p className="text-xs text-[#6B7B8D] mb-3 leading-relaxed">{description}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" style={{ color }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="hidden md:flex items-center justify-center">
      <div className="flex items-center gap-1 text-[#6B7B8D]">
        <div className="h-px w-6 bg-[#0A1A3A]/15" />
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

const catColorMap: Record<string, string> = {
  Turnaround: "#534AB7",
  Propagation: "#C8102E",
  "Duty Time": "#D4880F",
  Weather: "#1D9E75",
  Seasonal: "#6B7B8D",
};

function FeatureBar({
  feature,
  rank,
  maxImportance,
}: {
  feature: FeatureImportance;
  rank: number;
  maxImportance: number;
}) {
  const width = (feature.importance / maxImportance) * 100;
  const color = catColorMap[feature.category] ?? "#6B7B8D";

  return (
    <div className="flex items-center gap-3">
      <span className="w-4 text-right text-[10px] text-[#6B7B8D] font-mono">{rank}</span>
      <span className="w-40 text-xs font-mono truncate">{feature.feature}</span>
      <div className="flex-1 h-5 rounded bg-[#E8ECF0] relative overflow-hidden">
        <div
          className="h-full rounded transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-14 text-right text-xs font-mono font-semibold">{feature.importance.toFixed(4)}</span>
    </div>
  );
}

function DataSourceCard({
  icon,
  title,
  status,
  statusColor,
  description,
  url,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  statusColor: string;
  description: string;
  url: string;
}) {
  return (
    <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[#0A1A3A]">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ color: statusColor, backgroundColor: `${statusColor}15` }}
        >
          {status}
        </span>
      </div>
      <p className="text-xs text-[#6B7B8D] leading-relaxed mb-2">{description}</p>
      <p className="text-[10px] font-mono text-[#0078D2]">{url}</p>
    </div>
  );
}

function ValidationMetric({
  label,
  value,
  primary,
}: {
  label: string;
  value: number;
  primary?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold font-mono ${primary ? "text-[#C8102E]" : "text-[#0A1A3A]"}`}>
        {value.toFixed(2)}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[#6B7B8D] mt-0.5">
        {label}
        {primary && <span className="text-[#C8102E]"> *</span>}
      </p>
    </div>
  );
}

function LimitationItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-xs text-[#3A4A5A] leading-relaxed">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#D4880F]" />
      <span>{text}</span>
    </li>
  );
}

function RoadmapItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-xs text-[#3A4A5A] leading-relaxed">
      <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#1D9E75]" />
      <span>{text}</span>
    </li>
  );
}
