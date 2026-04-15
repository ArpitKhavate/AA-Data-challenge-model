"""Regenerate frontend JSON files from ranked_airport_pairs.csv."""
import pandas as pd
import json
import os
import networkx as nx

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(SCRIPT_DIR, 'outputs')
FRONTEND_DATA = os.path.join(os.path.dirname(SCRIPT_DIR), 'frontend', 'public', 'data')

df = pd.read_csv(os.path.join(OUTPUTS_DIR, 'ranked_airport_pairs.csv'))
print(f"Loaded {len(df):,} pairs")

# --- all_pairs.json (slim format) ---
slim = []
for _, r in df.iterrows():
    slim.append({
        "a": r['airport_A'],
        "b": r['airport_B'],
        "s": r['season'],
        "r": round(r['risk_probability'], 6),
        "d": round(r['duty_violation_prob'], 4),
        "c": round(r['confidence_pct'], 2),
        "cp": round(r['combined_propagation'], 4),
        "cd": round(r['combined_duty_burden'], 4),
        "mt": round(r.get('max_turnaround_risk', r.get('turn_A', 0)), 4),
        "wa": round(r['weather_A'], 4),
        "wb": round(r['weather_B'], 4),
        "h": int(r['high_risk']),
    })

with open(os.path.join(FRONTEND_DATA, 'all_pairs.json'), 'w') as f:
    json.dump(slim, f, separators=(',', ':'))
print(f"Wrote all_pairs.json ({len(slim):,} pairs)")

# --- top_pairs.json (top 50 by risk) ---
top = df.nlargest(50, 'risk_probability')
top_list = []
for _, r in top.iterrows():
    top_list.append({
        "airport_A": r['airport_A'],
        "airport_B": r['airport_B'],
        "season": r['season'],
        "risk_probability": round(r['risk_probability'], 6),
        "duty_violation_prob": round(r['duty_violation_prob'], 4),
        "confidence_pct": round(r['confidence_pct'], 2),
        "combined_propagation": round(r['combined_propagation'], 4),
        "combined_duty_burden": round(r['combined_duty_burden'], 4),
        "max_turnaround_risk": round(r.get('max_turnaround_risk', r.get('turn_A', 0)), 4),
        "weather_A": round(r['weather_A'], 4),
        "weather_B": round(r['weather_B'], 4),
        "high_risk": int(r['high_risk']),
    })
with open(os.path.join(FRONTEND_DATA, 'top_pairs.json'), 'w') as f:
    json.dump(top_list, f, separators=(',', ':'))
print(f"Wrote top_pairs.json ({len(top_list)} pairs)")

# --- season_stats.json ---
stats = []
for season in ['Spring', 'Summer', 'Fall', 'Winter']:
    s = df[df['season'] == season]
    if len(s) == 0:
        continue
    high = (s['risk_probability'] >= 0.7).sum()
    stats.append({
        "season": season,
        "avgRisk": round(s['risk_probability'].mean(), 4),
        "pairCount": len(s),
        "highRiskCount": int(high),
        "highRiskPct": round(high / len(s) * 100, 1),
    })
with open(os.path.join(FRONTEND_DATA, 'season_stats.json'), 'w') as f:
    json.dump(stats, f, separators=(',', ':'))
print(f"Wrote season_stats.json")

# --- network_summary.json ---
gexf_path = os.path.join(OUTPUTS_DIR, 'airport_risk_network.gexf')
graphml_path = os.path.join(OUTPUTS_DIR, 'airport_risk_network.graphml')
if os.path.exists(gexf_path):
    G = nx.read_gexf(gexf_path)
elif os.path.exists(graphml_path):
    G = nx.read_graphml(graphml_path)
else:
    G = nx.Graph()

high_edges = sum(1 for _, _, d in G.edges(data=True) if float(d.get('weight', 0)) >= 0.7)
summary = {
    "nodes": G.number_of_nodes(),
    "edges": G.number_of_edges(),
    "highEdges": high_edges,
}
with open(os.path.join(FRONTEND_DATA, 'network_summary.json'), 'w') as f:
    json.dump(summary, f, separators=(',', ':'))
print(f"Wrote network_summary.json: {summary}")

# --- Confidence stats for sanity check ---
print(f"\nConfidence stats:")
print(f"  Mean:   {df['confidence_pct'].mean():.1f}%")
print(f"  Median: {df['confidence_pct'].median():.1f}%")
print(f"  Min:    {df['confidence_pct'].min():.1f}%")
print(f"  Max:    {df['confidence_pct'].max():.1f}%")
print(f"  <50%:   {(df['confidence_pct'] < 50).sum():,}")
print(f"  >90%:   {(df['confidence_pct'] > 90).sum():,}")

print("\nRisk probability stats:")
print(f"  Mean:   {df['risk_probability'].mean():.4f}")
print(f"  =0:     {(df['risk_probability'] == 0).sum():,}")
print(f"  =1:     {(df['risk_probability'] == 1).sum():,}")
print(f"  0<x<1:  {((df['risk_probability'] > 0) & (df['risk_probability'] < 1)).sum():,}")

print("\nDone!")
