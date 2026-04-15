import { NextRequest, NextResponse } from "next/server";

const AWC_BASE = "https://aviationweather.gov/api/data/metar";
const CACHE_SECONDS = 300; // 5 minutes — METARs update ~hourly

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json(
      { error: "Missing required 'ids' query parameter (comma-separated ICAO codes)" },
      { status: 400 }
    );
  }

  // Validate: only allow comma-separated 4-letter ICAO identifiers
  const codes = ids.split(",").map((c) => c.trim().toUpperCase());
  if (codes.some((c) => !/^[A-Z]{4}$/.test(c))) {
    return NextResponse.json(
      { error: "Each id must be a 4-letter ICAO code (e.g. KORD)" },
      { status: 400 }
    );
  }

  try {
    const url = `${AWC_BASE}?ids=${codes.join(",")}&format=json`;
    const upstream = await fetch(url, {
      headers: { "User-Agent": "CrewRisk-AA-Analytics/1.0" },
      next: { revalidate: CACHE_SECONDS },
    });

    if (!upstream.ok) {
      if (upstream.status === 204) {
        return NextResponse.json([]);
      }
      return NextResponse.json(
        { error: `AWC returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
      },
    });
  } catch (err) {
    console.error("AWC METAR proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch METAR data from AWC" },
      { status: 502 }
    );
  }
}
