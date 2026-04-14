import os

import networkx as nx
import pandas as pd
import streamlit as st


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(SCRIPT_DIR, "outputs")
RANKED_CSV = os.path.join(OUTPUTS_DIR, "ranked_airport_pairs.csv")
GEXF_PATH = os.path.join(OUTPUTS_DIR, "airport_risk_network.gexf")
GRAPHML_PATH = os.path.join(OUTPUTS_DIR, "airport_risk_network.graphml")


@st.cache_data
def load_ranked_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    for col in [
        "risk_probability",
        "combined_propagation",
        "combined_duty_burden",
        "max_turnaround_risk",
        "weather_A",
        "weather_B",
    ]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df


@st.cache_data
def load_network_summary() -> dict:
    graph = None
    if os.path.exists(GEXF_PATH):
        graph = nx.read_gexf(GEXF_PATH)
    elif os.path.exists(GRAPHML_PATH):
        graph = nx.read_graphml(GRAPHML_PATH)

    if graph is None:
        return {"nodes": 0, "edges": 0, "high_edges": 0}

    high_edges = sum(1 for _, _, d in graph.edges(data=True)
                     if float(d.get("weight", 0)) >= 0.7)
    return {
        "nodes": graph.number_of_nodes(),
        "edges": graph.number_of_edges(),
        "high_edges": high_edges,
    }


def pair_lookup(df: pd.DataFrame, airport_a: str, airport_b: str, season: str) -> pd.Series | None:
    mask = (
        (
            ((df["airport_A"] == airport_a) & (df["airport_B"] == airport_b))
            | ((df["airport_A"] == airport_b) & (df["airport_B"] == airport_a))
        )
        & (df["season"] == season)
    )
    matches = df.loc[mask]
    if matches.empty:
        return None
    return matches.iloc[0]


def classify_risk(probability: float, q70: float, q40: float) -> tuple[str, str]:
    if probability >= q70:
        return "HIGH RISK", "Avoid this sequence in roster planning."
    if probability >= q40:
        return "MEDIUM RISK", "Use caution and monitor turnaround margins."
    return "LOW RISK", "Generally acceptable sequence under historical patterns."


def risk_breakdown(row: pd.Series) -> pd.DataFrame:
    raw = {
        "Delay Propagation": float(row.get("combined_propagation", 0.0)),
        "Duty Time": float(row.get("combined_duty_burden", 0.0)),
        "Turnaround": float(row.get("max_turnaround_risk", 0.0)),
        "Weather/Systemic": float(row.get("weather_A", 0.0)) + float(row.get("weather_B", 0.0)),
    }
    total = sum(raw.values())
    if total <= 0:
        return pd.DataFrame({"risk_type": list(raw.keys()), "percent": [0.0] * len(raw)})
    return pd.DataFrame({
        "risk_type": list(raw.keys()),
        "percent": [v / total * 100 for v in raw.values()],
    }).sort_values("percent", ascending=False)


st.set_page_config(page_title="Airline Crew Sequencing Risk",
                   page_icon="✈", layout="wide")
st.title("Airline Crew Sequencing Risk System")
st.caption("Challenge framing: inbound airport A -> DFW hub -> outbound airport B")

if not os.path.exists(RANKED_CSV):
    st.error("Missing outputs/ranked_airport_pairs.csv. Run analysis.py first.")
    st.stop()

ranked = load_ranked_data(RANKED_CSV)
if ranked.empty:
    st.error("ranked_airport_pairs.csv is empty. Re-run analysis.py.")
    st.stop()

net = load_network_summary()

col_a, col_b, col_c = st.columns(3)
with col_a:
    st.metric("Airport Nodes", net["nodes"])
with col_b:
    st.metric("Pair Edges", net["edges"])
with col_c:
    st.metric("High-Risk Edges", net["high_edges"])

airports = sorted(set(ranked["airport_A"]).union(set(ranked["airport_B"])))
seasons = ["Spring", "Summer", "Fall", "Winter"]

st.subheader("Query A -> DFW -> B Sequence")
st.write(
    "Choose airport A as the inbound leg to DFW, airport B as the outbound leg from DFW, and a season. "
    "The model also treats A/B as a pair, so swapping them gives the same risk score."
)
sel1, sel2, sel3 = st.columns(3)
with sel1:
    airport_a = st.selectbox("Airport A (inbound to DFW)", airports, index=airports.index(
        "ORD") if "ORD" in airports else 0)
with sel2:
    default_b = airports.index(
        "MIA") if "MIA" in airports else min(1, len(airports) - 1)
    airport_b = st.selectbox("Airport B (outbound from DFW)", airports, index=default_b)
with sel3:
    season = st.selectbox("Season", seasons, index=0)

if airport_a == airport_b:
    st.warning("Select two different airports.")
    st.stop()

row = pair_lookup(ranked, airport_a, airport_b, season)
if row is None:
    st.error("Pair not found in ranked output for this season.")
    st.stop()

sequence_label = f"{airport_a} -> DFW -> {airport_b}"
st.info(f"Sequence being scored: {sequence_label}")

q70 = float(ranked["risk_probability"].quantile(0.70))
q40 = float(ranked["risk_probability"].quantile(0.40))
risk_prob = float(row["risk_probability"])
risk_label, risk_note = classify_risk(risk_prob, q70, q40)

# Display core risk metrics
score_col, label_col, conf_col = st.columns([1.2, 2, 1])
with score_col:
    st.metric("Risk Probability", f"{risk_prob:.3f}")
with label_col:
    st.markdown(f"### {risk_label}")
    st.write(risk_note)
with conf_col:
    conf = float(row.get("confidence_pct", 0))
    st.metric("Confidence", f"{conf:.0f}%")

st.progress(min(max(risk_prob, 0.0), 1.0))

# FAA Duty Hour Violation — New concrete metric
st.subheader("FAA Duty Hour Violation Risk")
duty_viol = float(row.get("duty_violation_prob", 0))
duty_col1, duty_col2 = st.columns(2)
with duty_col1:
    st.metric("Violation Probability", f"{duty_viol:.1%}")
with duty_col2:
    st.write(
        "**FAA Limit:** 14-hour duty day + 10-hour rest. "
        "High values = pilot likely exhausts legal hours."
    )

st.divider()

st.subheader("Risk Breakdown")
breakdown_df = risk_breakdown(row)
st.bar_chart(breakdown_df.set_index("risk_type"))

top_driver = breakdown_df.iloc[0]
st.write(
    f"Primary driver: {top_driver['risk_type']} ({top_driver['percent']:.1f}%)")

st.subheader("Top 20 Highest-Risk Pairs")
show_cols = ["airport_A", "airport_B", "season", "risk_probability", 
             "duty_violation_prob", "confidence_pct"]
top_20 = ranked.sort_values("risk_probability", ascending=False).head(20)[show_cols].copy()
top_20.insert(0, "Sequence", top_20["airport_A"] + " -> DFW -> " + top_20["airport_B"])
top_20.columns = ["Sequence", "Airport A", "Airport B", "Season", "Risk Score", "Duty Violation", "Confidence"]
top_20["Risk Score"] = top_20["Risk Score"].apply(lambda x: f"{x:.3f}")
top_20["Duty Violation"] = top_20["Duty Violation"].apply(lambda x: f"{x*100:.0f}%")
top_20["Confidence"] = top_20["Confidence"].apply(lambda x: f"{x:.0f}%")
st.dataframe(top_20, hide_index=True, use_container_width=True)
