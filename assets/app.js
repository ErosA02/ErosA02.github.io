const state = {
  phase: "full",
  showUp: true,
  showDown: true,
  showSoc: true,
  focusEF: false,
  mirrorDos: true,
};

let results = null;

const COLORS = {
  up: "#c2410c",
  down: "#2563eb",
  soc: "#047857",
  navy: "#102a43",
  grid: "#d8e0e8",
  muted: "#52606d",
  co: "#1d4ed8",
  fe: "#f2a900",
  sn: "#8b7aa6",
};

const phaseReadings = {
  full:
    "La fase full-Heusler conserva carácter metálico con y sin SOC: las bandas siguen cruzando el nivel de Fermi. En la DOS sí se observa una redistribución fuerte de estados cerca de EF al pasar de SP a SOC.",
  half:
    "La fase half-Heusler es la lectura más delicada: en SP un canal mantiene estados metálicos en EF y el otro queda prácticamente anulado. Esto apunta a alta polarización de espín cerca del nivel de Fermi; con SOC la separación ideal de canales se mezcla.",
  inversa:
    "La fase inversa calculada en SP es metálica en ambos canales y tiene la mayor energía de formación entre las fases convergidas. El cálculo SOC no convergió, así que la tendencia SOC debe tratarse como trabajo pendiente.",
};

const plotConfig = {
  responsive: true,
  displaylogo: false,
  scrollZoom: true,
  doubleClick: "reset+autosize",
  modeBarButtonsToRemove: ["toImage", "zoom2d", "lasso2d", "select2d"],
};

function sub(text) {
  return text.replaceAll("₂", "<sub>2</sub>");
}

function fmt(value, digits = 3, fallback = "--") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback;
  return Number(value).toFixed(digits);
}

function phaseData() {
  return results.phases[state.phase];
}

function activeModeLabel() {
  const bits = [];
  if (state.showUp || state.showDown) bits.push("SP");
  if (state.showSoc) bits.push("SOC");
  return bits.join(" + ") || "sin trazas";
}

function bandTraces(calc, kind) {
  const traces = [];
  if (!calc || !calc.bands) return traces;
  if (kind === "SP") {
    if (state.showUp && calc.bands.up) {
      calc.bands.up.forEach((block, idx) => {
        traces.push({
          x: block.x,
          y: block.y,
          type: "scatter",
          mode: "lines",
          line: { color: COLORS.up, width: 1.25 },
          name: idx === 0 ? "SP up" : "SP up",
          legendgroup: "spup",
          showlegend: idx === 0,
          hovertemplate: "SP up<br>k=%{x:.3f}<br>E-EF=%{y:.3f} eV<extra></extra>",
        });
      });
    }
    if (state.showDown && calc.bands.down) {
      calc.bands.down.forEach((block, idx) => {
        traces.push({
          x: block.x,
          y: block.y,
          type: "scatter",
          mode: "lines",
          line: { color: COLORS.down, width: 1.15, dash: "dot" },
          name: "SP down",
          legendgroup: "spdown",
          showlegend: idx === 0,
          hovertemplate: "SP down<br>k=%{x:.3f}<br>E-EF=%{y:.3f} eV<extra></extra>",
        });
      });
    }
  }
  if (kind === "SOC" && state.showSoc && calc.bands?.total) {
    calc.bands.total.forEach((block, idx) => {
      traces.push({
        x: block.x,
        y: block.y,
        type: "scatter",
        mode: "lines",
        line: { color: COLORS.soc, width: 1.25 },
        name: "SOC",
        legendgroup: "soc",
        showlegend: idx === 0,
        hovertemplate: "SOC<br>k=%{x:.3f}<br>E-EF=%{y:.3f} eV<extra></extra>",
      });
    });
  }
  return traces;
}

function kpathLayout(kpath) {
  const shapes = [
    {
      type: "line",
      x0: 0,
      x1: 1,
      xref: "paper",
      y0: 0,
      y1: 0,
      line: { color: "#111827", width: 1, dash: "dash" },
    },
  ];
  (kpath?.x || []).forEach((x) => {
    shapes.push({
      type: "line",
      x0: x,
      x1: x,
      y0: 0,
      y1: 1,
      yref: "paper",
      line: { color: COLORS.grid, width: 1 },
    });
  });
  return {
    shapes,
    tickvals: kpath?.x || [],
    ticktext: (kpath?.labels || []).map((label) => (label === "Γ" ? "Γ" : label)),
  };
}

function renderBands() {
  const phase = phaseData();
  const sp = phase.SP;
  const soc = phase.SOC;
  const traces = [...bandTraces(sp, "SP"), ...bandTraces(soc, "SOC")];
  if (!traces.length) {
    traces.push({
      x: [0],
      y: [0],
      mode: "text",
      text: ["Sin trazas activas"],
      textfont: { size: 18, color: COLORS.muted },
      showlegend: false,
    });
  }
  const kpath = sp?.bands?.kpath || soc?.bands?.kpath || { x: [], labels: [] };
  const k = kpathLayout(kpath);
  const yRange = state.focusEF ? [-1.2, 1.2] : [-6, 4];
  const layout = {
    margin: { l: 66, r: 22, t: 18, b: 46 },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    dragmode: "pan",
    hovermode: "closest",
    legend: { orientation: "h", x: 0, y: 1.08 },
    xaxis: {
      title: "Ruta k",
      tickvals: k.tickvals,
      ticktext: k.ticktext,
      showgrid: false,
      zeroline: false,
    },
    yaxis: {
      title: "E - EF (eV)",
      range: yRange,
      gridcolor: "#e8eef4",
      zeroline: false,
    },
    shapes: k.shapes,
    annotations:
      soc?.status === "no_converged"
        ? [
            {
              text: "SOC no convergió para la fase inversa",
              xref: "paper",
              yref: "paper",
              x: 0.99,
              y: 0.03,
              showarrow: false,
              font: { color: COLORS.up, size: 13 },
            },
          ]
        : [],
  };
  Plotly.react("bands-chart", traces, layout, plotConfig);
}

function dosTraces(calc, kind) {
  const traces = [];
  if (!calc?.dos) return traces;
  const e = calc.dos.energy;
  if (kind === "SP") {
    if (state.showUp && calc.dos.up) {
      traces.push({
        x: calc.dos.up,
        y: e,
        type: "scatter",
        mode: "lines",
        fill: "tozerox",
        line: { color: COLORS.up, width: 2 },
        fillcolor: "rgba(194,65,12,0.12)",
        name: "SP up",
        hovertemplate: "SP up<br>DOS=%{x:.3f}<br>E-EF=%{y:.3f} eV<extra></extra>",
      });
    }
    if (state.showDown && calc.dos.down) {
      const x = state.mirrorDos ? calc.dos.down.map((v) => -v) : calc.dos.down;
      traces.push({
        x,
        y: e,
        type: "scatter",
        mode: "lines",
        fill: "tozerox",
        line: { color: COLORS.down, width: 2 },
        fillcolor: "rgba(37,99,235,0.12)",
        name: state.mirrorDos ? "SP down (-)" : "SP down",
        hovertemplate: "SP down<br>DOS=%{x:.3f}<br>E-EF=%{y:.3f} eV<extra></extra>",
      });
    }
  }
  if (kind === "SOC" && state.showSoc && calc.dos.total) {
    traces.push({
      x: calc.dos.total,
      y: e,
      type: "scatter",
      mode: "lines",
      line: { color: COLORS.soc, width: 2.2 },
      name: "SOC total",
      hovertemplate: "SOC total<br>DOS=%{x:.3f}<br>E-EF=%{y:.3f} eV<extra></extra>",
    });
  }
  return traces;
}

function renderDos() {
  const phase = phaseData();
  const traces = [...dosTraces(phase.SP, "SP"), ...dosTraces(phase.SOC, "SOC")];
  const yRange = state.focusEF ? [-1.2, 1.2] : [-6, 4];
  const visibleAbs = [];
  traces.forEach((trace) => {
    (trace.x || []).forEach((x, i) => {
      const y = trace.y?.[i];
      if (y >= yRange[0] && y <= yRange[1] && Number.isFinite(x)) visibleAbs.push(Math.abs(x));
    });
  });
  visibleAbs.sort((a, b) => a - b);
  const robustMax = visibleAbs.length ? visibleAbs[Math.min(visibleAbs.length - 1, Math.floor(visibleAbs.length * 0.985))] : 1;
  const xMax = Math.max(1, robustMax * 1.18);
  const xRange = state.mirrorDos ? [-xMax, xMax] : [0, xMax];
  const layout = {
    margin: { l: 66, r: 20, t: 18, b: 52 },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    dragmode: "pan",
    hovermode: "closest",
    legend: { orientation: "h", x: 0, y: 1.08 },
    xaxis: {
      title: state.mirrorDos ? "DOS; down espejado" : "DOS",
      range: xRange,
      gridcolor: "#e8eef4",
      zeroline: true,
      zerolinecolor: "#111827",
      zerolinewidth: 1,
    },
    yaxis: {
      title: "E - EF (eV)",
      range: yRange,
      gridcolor: "#e8eef4",
      zeroline: false,
    },
    shapes: [
      {
        type: "line",
        x0: 0,
        x1: 1,
        xref: "paper",
        y0: 0,
        y1: 0,
        line: { color: "#111827", width: 1, dash: "dash" },
      },
    ],
  };
  Plotly.react("dos-chart", traces, layout, plotConfig);
}

function renderFormation() {
  const valid = results.formation.filter((item) => item.status === "ok");
  const labels = valid.map((item) => `${phaseName(item.phase)} ${item.mode}`);
  const values = valid.map((item) => item.eform_ev_atom);
  const colors = valid.map((item) => results.phases[item.phase].color);
  const maxValue = Math.max(...values, 0.02);
  const traces = [
    {
      x: values,
      y: labels,
      type: "bar",
      orientation: "h",
      marker: { color: colors },
      text: values.map((value) => `${value >= 0 ? "+" : ""}${value.toFixed(3)}`),
      textposition: "outside",
      cliponaxis: false,
      hovertemplate: "%{y}<br>Eform=%{x:.4f} eV/át<extra></extra>",
    },
  ];
  const layout = {
    margin: { l: 110, r: 42, t: 8, b: 48 },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    dragmode: "pan",
    xaxis: { title: "Eform (eV/átomo)", range: [0, maxValue * 1.28], gridcolor: "#e8eef4", zerolinecolor: "#111827" },
    yaxis: { automargin: true },
    showlegend: false,
  };
  Plotly.react("formation-chart", traces, layout, plotConfig);
}

function addVectors(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVector(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function fracToCart(frac, vectors) {
  return addVectors(addVectors(scaleVector(vectors[0], frac[0]), scaleVector(vectors[1], frac[1])), scaleVector(vectors[2], frac[2]));
}

function cellEdges(vectors) {
  const o = [0, 0, 0];
  const a = vectors[0];
  const b = vectors[1];
  const c = vectors[2];
  const ab = addVectors(a, b);
  const ac = addVectors(a, c);
  const bc = addVectors(b, c);
  const abc = addVectors(ab, c);
  return [
    [o, a],
    [o, b],
    [o, c],
    [a, ab],
    [a, ac],
    [b, ab],
    [b, bc],
    [c, ac],
    [c, bc],
    [ab, abc],
    [ac, abc],
    [bc, abc],
  ];
}

function renderStructure() {
  const structure = phaseData().structure;
  const vectors = structure.lattice_vectors_ang;
  const byElement = {};
  structure.atoms.forEach((atom) => {
    const cart = fracToCart(atom.fractional, vectors);
    byElement[atom.element] ||= { x: [], y: [], z: [], text: [] };
    byElement[atom.element].x.push(cart[0]);
    byElement[atom.element].y.push(cart[1]);
    byElement[atom.element].z.push(cart[2]);
    byElement[atom.element].text.push(`${atom.element} (${atom.fractional.join(", ")})`);
  });
  const traces = Object.entries(byElement).map(([el, pos]) => ({
    ...pos,
    type: "scatter3d",
    mode: "markers+text",
    name: el,
    textposition: "top center",
    marker: { size: el === "Sn" ? 8 : 7, color: COLORS[el.toLowerCase()] || "#64748b", line: { color: "white", width: 1 } },
    hovertemplate: "%{text}<extra></extra>",
  }));
  cellEdges(vectors).forEach((edge, idx) => {
    traces.push({
      x: [edge[0][0], edge[1][0]],
      y: [edge[0][1], edge[1][1]],
      z: [edge[0][2], edge[1][2]],
      type: "scatter3d",
      mode: "lines",
      showlegend: idx === 0,
      name: idx === 0 ? "Celda" : "Celda",
      legendgroup: "cell",
      line: { color: "#64748b", width: 3 },
      hoverinfo: "skip",
    });
  });
  const layout = {
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: "white",
    scene: {
      xaxis: { title: "x (Å)", backgroundcolor: "white", gridcolor: "#e8eef4" },
      yaxis: { title: "y (Å)", backgroundcolor: "white", gridcolor: "#e8eef4" },
      zaxis: { title: "z (Å)", backgroundcolor: "white", gridcolor: "#e8eef4" },
      aspectmode: "data",
    },
    legend: { x: 0, y: 1 },
  };
  Plotly.react("structure-chart", traces, layout, plotConfig);
}

function phaseName(key) {
  return results?.phases?.[key]?.label || key;
}

function renderMetrics() {
  const phase = phaseData();
  const spDos = phase.SP?.dos?.dos_at_ef;
  const socDos = phase.SOC?.dos?.dos_at_ef;
  const formations = [phase.SP?.formation, phase.SOC?.formation].filter(Boolean);
  const best = formations.sort((a, b) => a.eform_ev_atom - b.eform_ev_atom)[0];
  const mag = phase.SP?.magnetization?.total_muB_cell;
  document.getElementById("metric-phase").textContent = phase.label;
  document.getElementById("metric-formula").innerHTML = sub(phase.formula);
  document.getElementById("metric-eform").textContent = best ? `${best.eform_ev_atom >= 0 ? "+" : ""}${fmt(best.eform_ev_atom, 3)} eV/át` : "--";
  document.getElementById("metric-dos-sp").textContent = spDos ? fmt(spDos.total, 2) : "--";
  document.getElementById("metric-mag").textContent = mag !== undefined ? `${fmt(mag, 2)} μB` : "SOC/no col.";
  const socStatus = phase.SOC?.status === "no_converged" ? "SOC pendiente" : activeModeLabel();
  document.getElementById("bands-pill").textContent = socStatus;
  document.getElementById("phase-reading").textContent = phaseReadings[state.phase];
  if (socDos?.total !== undefined) {
    document.getElementById("metric-dos-sp").nextElementSibling.textContent = `SP total; SOC ${fmt(socDos.total, 2)}`;
  } else {
    document.getElementById("metric-dos-sp").nextElementSibling.textContent = "estados/eV; SOC no conv.";
  }
}

function renderParams() {
  const phase = phaseData();
  const params = phase.SP.parameters;
  const list = document.getElementById("param-list");
  const entries = [
    ["ecutwfc", params.ecutwfc],
    ["ecutrho", params.ecutrho],
    ["smearing", params.smearing],
    ["degauss", params.degauss],
    ["nspin", params.nspin],
    ["EF SP", `${fmt(phase.SP.fermi_ev, 4)} eV`],
    ["EF SOC", phase.SOC?.fermi_ev ? `${fmt(phase.SOC.fermi_ev, 4)} eV` : "no convergido"],
  ];
  list.innerHTML = entries.map(([k, v]) => `<dt>${k}</dt><dd>${v ?? "--"}</dd>`).join("");
}

function renderAll() {
  renderMetrics();
  renderBands();
  renderDos();
  renderFormation();
  renderStructure();
  renderParams();
}

function bindControls() {
  document.querySelectorAll(".phase-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.phase = button.dataset.phase;
      document.querySelectorAll(".phase-tab").forEach((b) => b.classList.toggle("active", b === button));
      renderAll();
    });
  });
  const bindings = [
    ["toggle-up", "showUp"],
    ["toggle-down", "showDown"],
    ["toggle-soc", "showSoc"],
    ["toggle-focus", "focusEF"],
  ];
  bindings.forEach(([id, key]) => {
    document.getElementById(id).addEventListener("change", (event) => {
      state[key] = event.target.checked;
      renderAll();
    });
  });
  document.getElementById("mirror-dos").addEventListener("click", (event) => {
    state.mirrorDos = !state.mirrorDos;
    event.currentTarget.setAttribute("aria-pressed", String(state.mirrorDos));
    renderDos();
  });
}

async function main() {
  const response = await fetch("data/results.json");
  results = await response.json();
  bindControls();
  renderAll();
  if (window.lucide) lucide.createIcons();
}

main().catch((error) => {
  document.body.innerHTML = `<main class="app-shell"><section class="panel"><h1>No se pudo cargar el dashboard</h1><p>${error}</p></section></main>`;
});
