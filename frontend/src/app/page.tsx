"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import {
  getAirportCoords,
  getAllPairs,
  getNetworkSummary,
  classifyRisk,
  riskBreakdown,
  calibrateConfidence,
  fetchMetar,
  adjustedRisk,
  DFW_COORD,
  FLT_CAT_COLORS,
  type AirportCoord,
  type SlimPair,
  type NetworkSummary,
  type MetarData,
} from "@/lib/data";
import { AsciiBackground } from "@/components/ascii-background";
import {
  Plane,
  Shield,
  AlertTriangle,
  Clock,
  ArrowDown,
  ArrowUp,
  X,
  RotateCcw,
  ChevronDown,
  Info,
  Cloud,
  Wind,
  Eye,
  Zap,
  TrendingUp,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const SEASONS = ["Spring", "Summer", "Fall", "Winter"];

interface PopupState {
  code: string;
  x: number;
  y: number;
}

/* ---- Curved path helpers ---- */

/** Compute a quadratic bezier control point for a nice flight arc */
function getArcControlPoint(
  from: [number, number],
  to: [number, number]
): [number, number] {
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Arc height proportional to distance — flights curve more for longer routes
  const arcHeight = Math.min(dist * 0.35, 12);
  // Perpendicular offset — always curve upward (negative Y in geo coords = northward)
  const nx = -dy / dist;
  const ny = dx / dist;
  return [midX + nx * arcHeight, midY - Math.abs(ny * arcHeight) - arcHeight * 0.3];
}

/** Build SVG path string for the arc */
function buildArcPath(from: [number, number], to: [number, number]): string {
  const cp = getArcControlPoint(from, to);
  return `M ${from[0]},${from[1]} Q ${cp[0]},${cp[1]} ${to[0]},${to[1]}`;
}

/** Compute zoom center between an airport and DFW */
function getZoomCenter(
  airportCoord: { lon: number; lat: number } | undefined
): [number, number] {
  if (!airportCoord) return [-96, 38];
  return [
    (airportCoord.lon + DFW_COORD.lon) / 2,
    (airportCoord.lat + DFW_COORD.lat) / 2,
  ];
}

export default function FlightMapPage() {
  const [coords, setCoords] = useState<AirportCoord[]>([]);
  const [allPairs, setAllPairs] = useState<SlimPair[]>([]);
  const [network, setNetwork] = useState<NetworkSummary | null>(null);
  const [airportA, setAirportA] = useState<string | null>(null);
  const [airportB, setAirportB] = useState<string | null>(null);
  const [season, setSeason] = useState("Summer");
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-96, 38]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [pathKey, setPathKey] = useState(0); // force re-animate
  const [metars, setMetars] = useState<MetarData[]>([]);
  const [metarLoading, setMetarLoading] = useState(false);

  useEffect(() => {
    Promise.all([getAirportCoords(), getAllPairs(), getNetworkSummary()]).then(
      ([c, p, n]) => {
        setCoords(c);
        setAllPairs(p);
        setNetwork(n);
        setLoading(false);
      }
    );
  }, []);

  // Fetch live METAR when airports change
  useEffect(() => {
    const codes = [airportA, airportB].filter(Boolean) as string[];
    if (codes.length === 0) { setMetars([]); return; }
    setMetarLoading(true);
    const timer = setTimeout(() => {
      fetchMetar(codes).then((m) => { setMetars(m); setMetarLoading(false); });
    }, 400); // debounce
    return () => clearTimeout(timer);
  }, [airportA, airportB]);

  // Sorted airport list for dropdowns
  const airportCodes = useMemo(
    () => coords.map((c) => c.code).sort(),
    [coords]
  );

  // Coord lookup
  const coordMap = useMemo(() => {
    const m: Record<string, AirportCoord> = {};
    coords.forEach((c) => (m[c.code] = c));
    return m;
  }, [coords]);

  // Look up the selected pair
  const result = useMemo(() => {
    if (!airportA || !airportB) return null;
    return (
      allPairs.find(
        (p) =>
          ((p.a === airportA && p.b === airportB) ||
            (p.a === airportB && p.b === airportA)) &&
          p.s === season
      ) ?? null
    );
  }, [allPairs, airportA, airportB, season]);

  const riskInfo = result ? classifyRisk(result.r) : null;
  const breakdown = result ? riskBreakdown(result) : [];

  // Live-adjusted risk from METAR data
  const liveRisk = useMemo(() => {
    if (!result || metars.length === 0) return null;
    return adjustedRisk(result.r, metars);
  }, [result, metars]);
  const liveRiskInfo = liveRisk ? classifyRisk(liveRisk.adjusted) : null;

  // Find METAR for each selected airport
  const metarA = useMemo(
    () => metars.find((m) => m.iataCode === airportA) ?? null,
    [metars, airportA]
  );
  const metarB = useMemo(
    () => metars.find((m) => m.iataCode === airportB) ?? null,
    [metars, airportB]
  );

  // Zoom to selected airports
  useEffect(() => {
    if (airportA && airportB) {
      const a = coordMap[airportA];
      const b = coordMap[airportB];
      if (a && b) {
        setMapCenter([(a.lon + b.lon) / 2, (a.lat + b.lat) / 2]);
        setMapZoom(2.2);
      }
    } else if (airportA) {
      const a = coordMap[airportA];
      if (a) {
        setMapCenter(getZoomCenter(a));
        setMapZoom(2);
      }
    } else if (airportB) {
      const b = coordMap[airportB];
      if (b) {
        setMapCenter(getZoomCenter(b));
        setMapZoom(2);
      }
    }
  }, [airportA, airportB, coordMap]);

  // Handle clicking an airport dot
  const handleDotClick = useCallback(
    (code: string, event: React.MouseEvent) => {
      if (code === "DFW") return;
      const rect = (event.currentTarget as SVGElement)
        .closest(".map-container")
        ?.getBoundingClientRect();
      if (!rect) return;
      setPopup({
        code,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    []
  );

  // Set as inbound (Airport A)
  const setInbound = useCallback(
    (code: string) => {
      setAirportA(code);
      setPopup(null);
      setPathKey((k) => k + 1);
      if (airportB && code !== airportB) {
        setTimeout(
          () =>
            resultsRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          300
        );
      }
    },
    [airportB]
  );

  // Set as outbound (Airport B)
  const setOutbound = useCallback(
    (code: string) => {
      setAirportB(code);
      setPopup(null);
      setPathKey((k) => k + 1);
      if (airportA && code !== airportA) {
        setTimeout(
          () =>
            resultsRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          300
        );
      }
    },
    [airportA]
  );

  const closePopup = useCallback(() => setPopup(null), []);

  // FULL RESET
  const resetAll = useCallback(() => {
    setAirportA(null);
    setAirportB(null);
    setPopup(null);
    setMapZoom(1);
    setMapCenter([-96, 38]);
    setPathKey((k) => k + 1);
  }, []);

  const bothSelected = !!airportA && !!airportB && airportA !== airportB;

  // Build arc paths for selected airports
  const arcPaths = useMemo(() => {
    const paths: {
      id: string;
      d: string;
      color: string;
      type: "inbound" | "outbound";
    }[] = [];

    if (airportA) {
      const a = coordMap[airportA];
      if (a) {
        // Inbound: Airport A → DFW (blue)
        paths.push({
          id: `arc-inbound-${airportA}-${pathKey}`,
          d: buildArcPath(
            [a.lon, a.lat],
            [DFW_COORD.lon, DFW_COORD.lat]
          ),
          color: "#0078D2",
          type: "inbound",
        });
      }
    }

    if (airportB) {
      const b = coordMap[airportB];
      if (b) {
        // Outbound: DFW → Airport B (red)
        paths.push({
          id: `arc-outbound-${airportB}-${pathKey}`,
          d: buildArcPath(
            [DFW_COORD.lon, DFW_COORD.lat],
            [b.lon, b.lat]
          ),
          color: "#C8102E",
          type: "outbound",
        });
      }
    }

    return paths;
  }, [airportA, airportB, coordMap, pathKey]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8102E] border-t-transparent" />
          <span className="text-sm text-[#6B7B8D]">Loading flight data...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen"
      onClick={popup ? closePopup : undefined}
    >
      <AsciiBackground />

      <div className="relative z-10">
        {/* --- Navy top nav --- */}
        <header className="bg-[#0A1A3A] text-white">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C8102E]">
                <Plane className="h-4 w-4 text-white -rotate-45" />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-tight">
                  CrewRisk
                </span>
                <span className="ml-1.5 text-[10px] uppercase tracking-widest text-white/50">
                  AA Analytics
                </span>
              </div>
            </div>
            <div className="flex items-center gap-0 border border-white/15 rounded-lg overflow-hidden">
              <Link href="/" className="page-toggle-btn active">
                Flight Map
              </Link>
              <Link href="/model" className="page-toggle-btn">
                Model Rundown
              </Link>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              GROW 26.2
            </div>
          </div>
        </header>

        {/* --- Main --- */}
        <div className="mx-auto max-w-[1400px] px-6 py-6">
          {/* Title row */}
          <div className="mb-4 flex items-end justify-between animate-fade-in-up">
            <div>
              <h1
                className="text-4xl font-normal tracking-tight leading-none"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Navigate{" "}
                <span className="text-[#C8102E]">Risk</span>
              </h1>
              <p className="mt-1 text-sm text-[#6B7B8D]">
                Explore pilot crew sequence risk across the American Airlines DFW hub network
              </p>
            </div>
            {/* Season selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#6B7B8D]">
                Season:
              </span>
              <div className="flex gap-0 border border-[#0A1A3A]/10 rounded-md overflow-hidden">
                {SEASONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeason(s)}
                    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      season === s
                        ? "bg-[#0A1A3A] text-white"
                        : "text-[#6B7B8D] hover:bg-[#E8ECF0]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* --- Map + Controls column --- */}
            <div className="space-y-4">
              {/* Map container */}
              <div
                className="map-container relative animate-fade-in-up"
                style={{ animationDelay: "0.05s", aspectRatio: "16/10" }}
              >
                {/* Top bar */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-2.5">
                  <span className="flex items-center gap-1.5 rounded-sm bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider border border-[#0A1A3A]/8">
                    <span className="h-2 w-2 rounded-full bg-[#C8102E] animate-pulse" />
                    {coords.length} Airports
                  </span>
                  <span className="rounded-sm bg-white/90 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-[#0A1A3A]/8">
                    Hub: DFW
                  </span>
                  {airportA && (
                    <span className="rounded-sm bg-[#0078D2]/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-[#0078D2] border border-[#0078D2]/20">
                      A: {airportA}
                    </span>
                  )}
                  {airportB && (
                    <span className="rounded-sm bg-[#C8102E]/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-[#C8102E] border border-[#C8102E]/20">
                      B: {airportB}
                    </span>
                  )}
                  {(airportA || airportB) && (
                    <button
                      onClick={resetAll}
                      className="ml-auto flex h-6 w-6 items-center justify-center rounded bg-[#0A1A3A]/5 hover:bg-[#0A1A3A]/10 transition-colors"
                      title="Reset map"
                    >
                      <X className="h-3 w-3 text-[#6B7B8D]" />
                    </button>
                  )}
                </div>

                {/* SVG Map */}
                <ComposableMap
                  projection="geoAlbersUsa"
                  width={960}
                  height={600}
                  style={{ width: "100%", height: "100%" }}
                >
                  <defs>
                    {/* Glow filter for flight paths */}
                    <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="glow-filter-wide" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <ZoomableGroup
                    center={mapCenter}
                    zoom={mapZoom}
                    minZoom={1}
                    maxZoom={5}
                    onMoveEnd={({ coordinates, zoom }) => {
                      setMapCenter(coordinates as [number, number]);
                      setMapZoom(zoom);
                    }}
                  >
                    {/* State outlines */}
                    <Geographies geography={GEO_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rpiKey || geo.properties?.name}
                            geography={geo}
                            fill="#C5CED6"
                            stroke="#D8DFE5"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", fill: "#B8C4CE" },
                              pressed: { outline: "none" },
                            }}
                          />
                        ))
                      }
                    </Geographies>

                    {/* Subtle background lines when nothing selected */}
                    {!airportA &&
                      !airportB &&
                      coords.map((ap) => (
                        <line
                          key={`bg-${ap.code}`}
                          x1={0}
                          y1={0}
                          x2={0}
                          y2={0}
                          stroke="#A0ADB8"
                          strokeWidth={0.3}
                          strokeOpacity={0.15}
                        >
                          {/* Invisible placeholder — the Marker positions handle it */}
                        </line>
                      ))}

                    {/* ---- ANIMATED CURVED FLIGHT PATHS ---- */}
                    {arcPaths.map((arc) => (
                      <g key={arc.id}>
                        {/* Wide glow background */}
                        <path
                          d={arc.d}
                          fill="none"
                          stroke={arc.color}
                          strokeWidth={8}
                          strokeOpacity={0.15}
                          strokeLinecap="round"
                          className="flight-path-glow"
                        />
                        {/* Medium glow */}
                        <path
                          d={arc.d}
                          fill="none"
                          stroke={arc.color}
                          strokeWidth={4}
                          strokeOpacity={0.3}
                          strokeLinecap="round"
                          filter="url(#glow-filter)"
                        />
                        {/* Core beam — animated dash */}
                        <path
                          d={arc.d}
                          fill="none"
                          stroke={arc.color}
                          strokeWidth={2.5}
                          strokeOpacity={0.9}
                          strokeLinecap="round"
                          className="flight-path-beam"
                        />
                        {/* Animated plane dot traveling along path */}
                        <circle r={4} fill={arc.color} className="flight-plane-dot">
                          <animateMotion
                            dur="3s"
                            repeatCount="indefinite"
                            path={arc.d}
                          />
                        </circle>
                        {/* Trailing glow dot */}
                        <circle r={8} fill={arc.color} opacity={0.15}>
                          <animateMotion
                            dur="3s"
                            repeatCount="indefinite"
                            path={arc.d}
                          />
                        </circle>
                      </g>
                    ))}

                    {/* DFW hub — glowing */}
                    <Marker
                      coordinates={[DFW_COORD.lon, DFW_COORD.lat]}
                    >
                      <circle r={14} fill="#C8102E" opacity={0.08}>
                        <animate
                          attributeName="r"
                          values="10;18;10"
                          dur="3s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.1;0;0.1"
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      <circle r={8} fill="#C8102E" opacity={0.15}>
                        <animate
                          attributeName="r"
                          values="6;12;6"
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.2;0.05;0.2"
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      <circle
                        r={5}
                        fill="#C8102E"
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                      />
                      <text
                        textAnchor="middle"
                        y={-11}
                        style={{
                          fill: "#C8102E",
                          fontSize: 9,
                          fontWeight: 800,
                          fontFamily: "var(--font-geist-mono)",
                        }}
                        className="airport-label"
                      >
                        DFW
                      </text>
                    </Marker>

                    {/* Airport dots */}
                    {coords.map((ap) => {
                      const isA = ap.code === airportA;
                      const isB = ap.code === airportB;
                      const isSelected = isA || isB;
                      const dimmed = bothSelected && !isSelected;
                      const dotColor = isA
                        ? "#0078D2"
                        : isB
                        ? "#C8102E"
                        : "#0A1A3A";
                      const dotR = isSelected ? 4.5 : 2.5;

                      return (
                        <Marker
                          key={`dot-${ap.code}`}
                          coordinates={[ap.lon, ap.lat]}
                        >
                          {/* Glow halo */}
                          <circle
                            r={dimmed ? 0 : 8}
                            fill={dotColor}
                            opacity={0}
                          >
                            <animate
                              attributeName="r"
                              values={
                                isSelected ? "5;14;5" : "4;10;4"
                              }
                              dur={isSelected ? "2s" : "3.5s"}
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              values={
                                isSelected
                                  ? "0.25;0;0.25"
                                  : "0.08;0;0.08"
                              }
                              dur={isSelected ? "2s" : "3.5s"}
                              repeatCount="indefinite"
                            />
                          </circle>
                          {isSelected && (
                            <circle
                              r={6}
                              fill={dotColor}
                              opacity={0}
                            >
                              <animate
                                attributeName="r"
                                values="4;20;4"
                                dur="2.5s"
                                repeatCount="indefinite"
                              />
                              <animate
                                attributeName="opacity"
                                values="0.15;0;0.15"
                                dur="2.5s"
                                repeatCount="indefinite"
                              />
                            </circle>
                          )}
                          <circle
                            r={isSelected ? 9 : 5}
                            fill={dotColor}
                            opacity={
                              dimmed
                                ? 0.02
                                : isSelected
                                ? 0.12
                                : 0.04
                            }
                          />
                          <circle
                            r={dotR}
                            fill={dotColor}
                            stroke={isSelected ? "#FFFFFF" : "none"}
                            strokeWidth={isSelected ? 1.5 : 0}
                            opacity={dimmed ? 0.12 : 0.85}
                            className="airport-dot"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDotClick(
                                ap.code,
                                e as unknown as React.MouseEvent
                              );
                            }}
                          />
                          <text
                            textAnchor="middle"
                            y={-9}
                            style={{
                              fill: isA
                                ? "#0078D2"
                                : isB
                                ? "#C8102E"
                                : "#6B7B8D",
                              fontSize: isSelected ? 8 : 6,
                              fontWeight: isSelected ? 800 : 600,
                              fontFamily: "var(--font-geist-mono)",
                              opacity: dimmed
                                ? 0.08
                                : isSelected
                                ? 1
                                : 0.5,
                            }}
                            className={
                              isSelected
                                ? "airport-label-selected"
                                : "airport-label"
                            }
                          >
                            {ap.code}
                          </text>
                        </Marker>
                      );
                    })}
                  </ZoomableGroup>
                </ComposableMap>

                {/* Click popup */}
                {popup && (
                  <div
                    className="airport-popup absolute animate-scale-in"
                    style={{
                      left: popup.x,
                      top: popup.y - 10,
                      transform: "translate(-50%, -100%)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-1.5 border-b border-[#0A1A3A]/6 bg-[#E8ECF0]/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A1A3A]">
                        {popup.code}
                      </span>
                    </div>
                    <button
                      className="airport-popup-btn inbound"
                      onClick={() => setInbound(popup.code)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      <span>Set as Inbound (A→DFW)</span>
                    </button>
                    <button
                      className="airport-popup-btn outbound"
                      onClick={() => setOutbound(popup.code)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                      <span>Set as Outbound (DFW→B)</span>
                    </button>
                  </div>
                )}

                {/* Bottom bar */}
                <div className="map-bottom-bar absolute bottom-0 left-0 right-0">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#6B7B8D]">
                        Historical
                      </span>
                      <span className="ml-2 font-mono text-base font-bold">
                        {result ? result.r.toFixed(2) : "—"}
                      </span>
                    </div>
                    {liveRisk && liveRisk.multiplier > 1 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#C8102E]">
                          Live-Adj
                        </span>
                        <span className="ml-2 font-mono text-base font-bold text-[#C8102E]">
                          {liveRisk.adjusted.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#6B7B8D]">
                        Confidence
                      </span>
                      <span className="ml-2 font-mono text-base font-bold">
                        {result ? `${calibrateConfidence(result.c).toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#6B7B8D]">
                        Model
                      </span>
                      <span className="ml-2 font-mono text-base font-bold">
                        XGBoost + Live
                      </span>
                    </div>
                  </div>
                  {bothSelected && (liveRiskInfo ?? riskInfo) && (
                    <span
                      className="rounded-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        color: (liveRiskInfo ?? riskInfo)!.color,
                        backgroundColor: (liveRiskInfo ?? riskInfo)!.bgColor,
                      }}
                    >
                      {(liveRiskInfo ?? riskInfo)!.label}
                    </span>
                  )}
                </div>

                {/* Legend */}
                <div className="absolute bottom-12 right-3 flex flex-col gap-1.5 text-[9px] text-[#6B7B8D]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#0078D2]" />{" "}
                    Inbound (A→DFW)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#C8102E]" />{" "}
                    Outbound (DFW→B)
                  </span>
                </div>
              </div>

              {/* ---- AIRPORT SELECTOR PANEL (below map) ---- */}
              <div
                className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5 animate-fade-in-up"
                style={{ animationDelay: "0.1s" }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7B8D] mb-3">
                  Select Airports — Map or Dropdown
                </h3>
                <div className="flex flex-wrap items-end gap-4">
                  {/* Inbound dropdown */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#0078D2] mb-1.5">
                      <ArrowDown className="inline h-3 w-3 mr-1" />
                      Inbound (A → DFW)
                    </label>
                    <select
                      className="airport-select inbound w-full"
                      value={airportA ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          setInbound(v);
                        } else {
                          setAirportA(null);
                        }
                      }}
                    >
                      <option value="">Choose airport…</option>
                      {airportCodes.map((code) => (
                        <option key={code} value={code} disabled={code === airportB}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DFW hub indicator */}
                  <div className="flex flex-col items-center pb-1.5">
                    <span className="text-[9px] uppercase tracking-wider text-[#6B7B8D] mb-1">
                      Hub
                    </span>
                    <div className="flex h-9 w-12 items-center justify-center rounded-md bg-[#C8102E] text-white text-xs font-bold font-mono">
                      DFW
                    </div>
                  </div>

                  {/* Outbound dropdown */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#C8102E] mb-1.5">
                      <ArrowUp className="inline h-3 w-3 mr-1" />
                      Outbound (DFW → B)
                    </label>
                    <select
                      className="airport-select outbound w-full"
                      value={airportB ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          setOutbound(v);
                        } else {
                          setAirportB(null);
                        }
                      }}
                    >
                      <option value="">Choose airport…</option>
                      {airportCodes.map((code) => (
                        <option key={code} value={code} disabled={code === airportA}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Season (inline) */}
                  <div className="min-w-[120px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7B8D] mb-1.5">
                      Season
                    </label>
                    <select
                      className="airport-select w-full"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                    >
                      {SEASONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reset button */}
                  <button className="reset-btn" onClick={resetAll}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                </div>

                {/* Current selection status */}
                {!bothSelected && (
                  <div className="mt-3 rounded-lg border border-dashed border-[#0A1A3A]/10 bg-[#E8ECF0]/50 px-4 py-2.5 text-center text-xs text-[#6B7B8D]">
                    {!airportA && !airportB && (
                      <>
                        Select airports from the dropdowns above or click
                        directly on the map
                      </>
                    )}
                    {airportA && !airportB && (
                      <>
                        Inbound set:{" "}
                        <span className="font-mono font-semibold text-[#0078D2]">
                          {airportA}→DFW
                        </span>
                        . Now select an{" "}
                        <span className="font-semibold text-[#C8102E]">
                          outbound
                        </span>{" "}
                        airport.
                      </>
                    )}
                    {!airportA && airportB && (
                      <>
                        Outbound set:{" "}
                        <span className="font-mono font-semibold text-[#C8102E]">
                          DFW→{airportB}
                        </span>
                        . Now select an{" "}
                        <span className="font-semibold text-[#0078D2]">
                          inbound
                        </span>{" "}
                        airport.
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* --- Right panel: Metrics & Info --- */}
            <div
              className="space-y-4 animate-fade-in-up"
              style={{ animationDelay: "0.1s" }}
            >
              {/* KPI cards */}
              {network && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="metric-card">
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7B8D] mb-0.5">
                      Airports
                    </p>
                    <p className="text-lg font-bold font-mono">
                      {network.nodes}
                    </p>
                  </div>
                  <div className="metric-card">
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7B8D] mb-0.5">
                      Pair Edges
                    </p>
                    <p className="text-lg font-bold font-mono">
                      {network.edges.toLocaleString()}
                    </p>
                  </div>
                  <div className="metric-card">
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7B8D] mb-0.5">
                      High-Risk
                    </p>
                    <p className="text-lg font-bold font-mono text-[#C8102E]">
                      {network.highEdges.toLocaleString()}
                    </p>
                  </div>
                  <div className="metric-card">
                    <p className="text-[10px] uppercase tracking-wider text-[#6B7B8D] mb-0.5">
                      Season
                    </p>
                    <p className="text-lg font-bold font-mono">{season}</p>
                  </div>
                </div>
              )}

              {/* Instructions or Results */}
              {bothSelected && result && riskInfo ? (
                <div ref={resultsRef} className="space-y-4 animate-slide-in">
                  {/* Risk score */}
                  <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7B8D]">
                        Sequence Risk
                      </h3>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          color: riskInfo.color,
                          backgroundColor: riskInfo.bgColor,
                        }}
                      >
                        {riskInfo.label}
                      </span>
                    </div>
                    <div className="text-center mb-4">
                      <p
                        className="text-4xl font-bold font-mono"
                        style={{ color: riskInfo.color }}
                      >
                        {(result.r * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-[#6B7B8D] mt-1 font-mono">
                        {airportA} → DFW → {airportB} · {season}
                      </p>
                    </div>
                    <div className="space-y-2.5 border-t border-[#0A1A3A]/6 pt-3">
                      <MetricRow
                        icon={
                          <Shield className="h-3.5 w-3.5 text-[#0078D2]" />
                        }
                        label="Confidence"
                        value={`${calibrateConfidence(result.c).toFixed(0)}%`}
                      />
                      <MetricRow
                        icon={
                          <Clock className="h-3.5 w-3.5 text-[#D4880F]" />
                        }
                        label="Duty Violation"
                        value={`${(result.d * 100).toFixed(1)}%`}
                      />
                      <MetricRow
                        icon={
                          <AlertTriangle className="h-3.5 w-3.5 text-[#534AB7]" />
                        }
                        label="Turnaround Risk"
                        value={result.mt.toFixed(4)}
                      />
                    </div>
                  </div>

                  {/* ---- LIVE WEATHER CONDITIONS ---- */}
                  {(metarA || metarB || metarLoading) && (
                    <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7B8D] mb-3 flex items-center gap-1.5">
                        <Cloud className="h-3.5 w-3.5" />
                        Live Weather — AWC METAR
                      </h3>
                      {metarLoading ? (
                        <div className="flex items-center gap-2 text-xs text-[#6B7B8D]">
                          <div className="h-3 w-3 animate-spin rounded-full border border-[#6B7B8D] border-t-transparent" />
                          Fetching live conditions...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {[metarA, metarB].map((m) => {
                            if (!m) return null;
                            const isA = m.iataCode === airportA;
                            const catColors = FLT_CAT_COLORS[m.fltCat] ?? FLT_CAT_COLORS.VFR;
                            return (
                              <div key={m.icaoId} className="rounded-lg border border-[#0A1A3A]/6 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold font-mono" style={{ color: isA ? "#0078D2" : "#C8102E" }}>
                                    {m.iataCode} {isA ? "(Inbound)" : "(Outbound)"}
                                  </span>
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: catColors.text, backgroundColor: catColors.bg }}
                                  >
                                    {m.fltCat}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[11px]">
                                  <div className="flex items-center gap-1 text-[#6B7B8D]">
                                    <Wind className="h-3 w-3" />
                                    <span>{m.wspd ?? 0}kt{m.wgst ? ` G${m.wgst}` : ""}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[#6B7B8D]">
                                    <Eye className="h-3 w-3" />
                                    <span>{m.visib ?? "—"}sm</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[#6B7B8D]">
                                    <Cloud className="h-3 w-3" />
                                    <span>{m.base ? `${m.base}ft` : "CLR"}</span>
                                  </div>
                                </div>
                                {m.wxString && (
                                  <div className="mt-1.5 flex items-center gap-1">
                                    <Zap className="h-3 w-3 text-[#D4880F]" />
                                    <span className="text-[11px] font-semibold text-[#D4880F]">{m.wxString}</span>
                                  </div>
                                )}
                                <p className="mt-2 font-mono text-[9px] text-[#6B7B8D]/70 leading-relaxed break-all">
                                  {m.rawOb}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- LIVE-ADJUSTED RISK ---- */}
                  {liveRisk && liveRisk.multiplier > 1 && liveRiskInfo && (
                    <div
                      className="rounded-xl border-2 p-5"
                      style={{
                        borderColor: liveRiskInfo.color,
                        backgroundColor: liveRiskInfo.bgColor,
                      }}
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7B8D] mb-3 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Live-Adjusted Risk
                      </h3>
                      <div className="flex items-baseline gap-3 mb-2">
                        <p
                          className="text-3xl font-bold font-mono"
                          style={{ color: liveRiskInfo.color }}
                        >
                          {(liveRisk.adjusted * 100).toFixed(1)}%
                        </p>
                        <span className="text-xs font-mono text-[#6B7B8D] line-through">
                          {(result.r * 100).toFixed(1)}%
                        </span>
                        <span
                          className="text-xs font-bold font-mono"
                          style={{ color: liveRiskInfo.color }}
                        >
                          +{((liveRisk.adjusted - result.r) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="space-y-1">
                        {liveRisk.reasons.map((r, i) => (
                          <p key={i} className="text-[11px] text-[#3A4A5A] flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: liveRiskInfo.color }} />
                            {r}
                          </p>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-[#6B7B8D]">
                        Weather multiplier: {liveRisk.multiplier}x — sourced from aviationweather.gov METAR
                      </p>
                    </div>
                  )}

                  {/* Severity Matrix */}
                  <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7B8D] mb-3">
                      Risk Severity Matrix
                    </h3>
                    <div className="space-y-3">
                      {breakdown.map((b) => (
                        <div key={b.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">
                              {b.name}
                            </span>
                            <span className="text-xs font-mono font-semibold">
                              {b.pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="severity-bar">
                            <div
                              className="severity-bar-fill"
                              style={{
                                width: `${b.pct}%`,
                                backgroundColor: b.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ---- DELAY PROPAGATION EXPLANATION ---- */}
                  <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7B8D] mb-3 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" />
                      Delay Propagation Logic
                    </h3>
                    <div className="space-y-3 text-xs leading-relaxed text-[#3A4A5A]">
                      <p>
                        <span className="font-semibold text-[#0A1A3A]">How cascading delays work:</span>{" "}
                        When the inbound flight from{" "}
                        <span className="font-mono font-semibold text-[#0078D2]">{airportA}</span>{" "}
                        arrives late at DFW, the turnaround window shrinks. If the crew
                        can&apos;t turn the aircraft fast enough, the outbound flight to{" "}
                        <span className="font-mono font-semibold text-[#C8102E]">{airportB}</span>{" "}
                        departs late — the delay has <em>propagated</em>.
                      </p>
                      <div className="flex items-center gap-2 rounded-lg bg-[#E8ECF0] px-3 py-2 font-mono text-[11px]">
                        <span className="text-[#0078D2] font-bold">{airportA}</span>
                        <span className="text-[#6B7B8D]">→ late →</span>
                        <span className="font-bold text-[#C8102E]">DFW</span>
                        <span className="text-[#6B7B8D]">→ short turn →</span>
                        <span className="text-[#C8102E] font-bold">{airportB}</span>
                        <span className="text-[#6B7B8D]">= cascaded delay</span>
                      </div>
                      <p>
                        The model uses <span className="font-semibold">late_aircraft_delay</span> from
                        BTS data — measuring how often a late-arriving aircraft caused the
                        <em> next</em> departure to be delayed. The{" "}
                        <span className="font-semibold">combined_propagation</span> score (
                        <span className="font-mono font-semibold">
                          {result.cp.toFixed(1)}
                        </span>
                        ) sums both airports&apos; cascading tendencies. Higher values mean both
                        legs are historically prone to passing delays forward.
                      </p>
                      <p>
                        Combined with duty burden (
                        <span className="font-mono font-semibold">
                          {result.cd.toFixed(1)}
                        </span>{" "}
                        total delay minutes), the pilot risks hitting the FAA 14-hour duty
                        limit, making the sequence operationally dangerous.
                      </p>
                    </div>
                  </div>

                  {/* XGBoost reasoning */}
                  <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7B8D] mb-3">
                      Why This Sequence Is{" "}
                      <span style={{ color: riskInfo.color }}>
                        {result.r >= 0.7
                          ? "Flagged"
                          : result.r >= 0.4
                          ? "Cautioned"
                          : "Accepted"}
                      </span>
                    </h3>
                    <p className="text-sm leading-relaxed text-[#3A4A5A]">
                      The XGBoost model scored{" "}
                      <span className="font-mono font-semibold">
                        {airportA}→DFW→{airportB}
                      </span>{" "}
                      at{" "}
                      <span
                        className="font-mono font-semibold"
                        style={{ color: riskInfo.color }}
                      >
                        {(result.r * 100).toFixed(1)}%
                      </span>{" "}
                      risk probability. The primary driver is{" "}
                      <span className="font-semibold">
                        {breakdown.reduce((a, b) =>
                          a.pct > b.pct ? a : b
                        ).name.toLowerCase()}
                      </span>{" "}
                      (
                      {breakdown
                        .reduce((a, b) => (a.pct > b.pct ? a : b))
                        .pct.toFixed(0)}
                      % contribution).
                    </p>
                    <div
                      className="mt-3 rounded-lg p-3 text-xs leading-relaxed"
                      style={{
                        backgroundColor: riskInfo.bgColor,
                        color: riskInfo.color,
                      }}
                    >
                      {result.r >= 0.7
                        ? `⚠ This pair should NOT be included in pilot crew sequences. The combined duty burden and propagation risk make it dangerous for ${season.toLowerCase()} operations.`
                        : result.r >= 0.4
                        ? `⚡ This pair should be monitored closely. Consider adding turnaround buffer time during ${season.toLowerCase()} scheduling.`
                        : `✓ This pair is generally acceptable for crew scheduling. Historical data shows manageable risk levels during ${season.toLowerCase()}.`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#0A1A3A]/8 bg-white p-8 text-center">
                  <Plane className="h-10 w-10 mx-auto mb-3 text-[#6B7B8D]/20 -rotate-45" />
                  <h3 className="text-sm font-semibold mb-1">
                    Select a Crew Sequence
                  </h3>
                  <p className="text-xs text-[#6B7B8D] leading-relaxed max-w-[240px] mx-auto">
                    Click any airport on the map or use the dropdowns below to
                    choose the{" "}
                    <span className="text-[#0078D2] font-semibold">
                      inbound
                    </span>{" "}
                    and{" "}
                    <span className="text-[#C8102E] font-semibold">
                      outbound
                    </span>{" "}
                    legs of the sequence through DFW.
                  </p>
                </div>
              )}

              {/* Pair not found */}
              {bothSelected && !result && (
                <div
                  ref={resultsRef}
                  className="rounded-xl border border-[#D4880F]/30 bg-[#D4880F]/5 p-5 text-center"
                >
                  <p className="text-sm font-semibold text-[#D4880F]">
                    Pair Not Found
                  </p>
                  <p className="text-xs text-[#6B7B8D] mt-1">
                    {airportA}→DFW→{airportB} was not scored for {season}. Try a
                    different combination.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs text-[#6B7B8D]">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}
