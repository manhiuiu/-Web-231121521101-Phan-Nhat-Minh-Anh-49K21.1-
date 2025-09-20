// js/q1.js
(function(){
/* ===================== PALETTE & LEGEND ===================== */ 
const GROUP_ORDER = [
  "[BOT] Bột",
  "[SET] Set trà",
  "[THO] Trà hoa",
  "[TMX] Trà mix",
  "[TTC] Trà củ, quả sấy"
];
const GROUP_COLORS = {
  "[BOT] Bột"             : "#4f6f98",
  "[SET] Set trà"         : "#d98453",
  "[THO] Trà hoa"         : "#cf6b5b",
  "[TMX] Trà mix"         : "#84c5bf",
  "[TTC] Trà củ, quả sấy" : "#7ab874"
};

/* ===================== CHUẨN HOÁ NHÓM ===================== */
const CANONICAL = new Map([
  ["BOT","[BOT] Bột"],["Bột","[BOT] Bột"],["[BOT] Bột","[BOT] Bột"],
  ["SET","[SET] Set trà"],["Set trà","[SET] Set trà"],["Set tra","[SET] Set trà"],["[SET] Set trà","[SET] Set trà"],
  ["THO","[THO] Trà hoa"],["Trà hoa","[THO] Trà hoa"],["[THO] Trà hoa","[THO] Trà hoa"],
  ["TMX","[TMX] Trà mix"],["Trà mix","[TMX] Trà mix"],["[TMX] Trà mix","[TMX] Trà mix"],
  ["TTC","[TTC] Trà củ, quả sấy"],["Trà củ, quả sấy","[TTC] Trà củ, quả sấy"],["[TTC] Trà củ, quả sấy","[TTC] Trà củ, quả sấy"]
]);
function normalizeGroup(g){
  const s=(g||"").trim();
  if(CANONICAL.has(s)) return CANONICAL.get(s);
  const m=s.match(/\[?([A-Z]{3})\]?/);
  if(m && CANONICAL.has(m[1])) return CANONICAL.get(m[1]);
  for (const k of CANONICAL.keys()){
    if(s.toLowerCase()===k.toLowerCase()) return CANONICAL.get(k);
  }
  return s;
}
const colorFor = g => GROUP_COLORS[normalizeGroup(g)] || "#6b7280";

/* ===================== FORMAT & TOOLTIP ===================== */
const tip = d3.select("body").append("div").attr("class","tooltip");
const fmtMoney = v => `${d3.format(",.0f")(v/1e6)} triệu VND`;
const fmtInt    = v => d3.format(",")(Math.round(v||0));

/* ===================== BOOT ===================== */
function bootQ1(containerSel = '#view'){
  const view = d3.select(containerSel).html("");
  view.append("div").attr("class","card").text("Đang tải Q1…");

  d3.csv("./data/sales.csv", row => {
    const groupRaw = row["Tên nhóm hàng"] || row["Nhom hang"] || row["Group"] || "";
    const codeRaw  = row["Mã mặt hàng"]   || row["Ma mat hang"] || row["Code"] || row["SKU"] || "";
    const nameRaw  = row["Tên mặt hàng"]  || row["Ten mat hang"] || row["Item"] || "";

    const item_code = String(codeRaw||"").trim();
    const item_name = String(nameRaw||"").trim();
    const label = item_code ? `[${item_code}] ${item_name}` : item_name;

    return {
      group_name: normalizeGroup(groupRaw),
      item_code,
      item_name,
      label,
      sales: +row["Thành tiền"] || +row["Thanh tien"] || +row["Sales"] || 0,
      qty  : +row["SL"] || +row["So luong"] || +row["Qty"] || 0
    };
  }).then(raw => {
    const data = raw.filter(d => d.group_name && d.label);

    const rows = d3.rollups(
      data,
      v => ({
        sales     : d3.sum(v, d => d.sales),
        qty       : d3.sum(v, d => d.qty),
        group_name: v[0].group_name,
        label     : v[0].label
      }),
      d => d.item_code || d.item_name
    ).map(([key, o]) => ({
      key,
      label      : o.label,
      sales      : o.sales,
      qty        : o.qty,
      group_name : o.group_name
    }))
    .sort((a,b) => d3.descending(a.sales, b.sales));

    drawQ1(rows, containerSel);
  }).catch(err=>{
    d3.select(containerSel).html(`<div class="card error">Không thể vẽ Q1: ${err.message}</div>`);
  });
}

/* ===================== DRAW ===================== */
function drawQ1(rows, containerSel = '#view'){
  const root = d3.select(containerSel).html("");

  const wrap = root.append("div").attr("class","chart-wrap");
  wrap.append("h2").attr("class","chart-title").text("Doanh số bán hàng theo Mặt hàng");

  // Legend
  const legendCol = wrap.append("div").attr("class","legend-side");
  const legend = legendCol.append("div").attr("class","legend-vert");
  legend.append("div").attr("class","legend-title").text("Nhóm hàng");
  const lg = legend.selectAll(".legend-item").data(GROUP_ORDER).join("div").attr("class","legend-item");
  lg.append("span").attr("class","legend-swatch").style("background", d => GROUP_COLORS[d]);
  lg.append("span").text(d => d);

  // Chart
  const card = wrap.append("div").attr("class","card chart-panel");

  const W = 1200;
  const H = Math.max(520, rows.length*28 + 120);
  const M = { t:10, r:30, b:44, l:270 };
  const w = W - M.l - M.r;
  const h = H - M.t - M.b;

  const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g   = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

  const y = d3.scaleBand().domain(rows.map(d => d.label)).range([0, h]).padding(0.18);
  const minMax = 700e6, step = 50e6;
  const dataMax = d3.max(rows, d => d.sales) || 1;
  const xMax = Math.max(minMax, Math.ceil(dataMax/step)*step);
  const x = d3.scaleLinear().domain([0, xMax]).range([0, w]);
  const ticks = d3.range(0, xMax + step, step);
  const tickFmt = v => (v === 0 ? "0M" : (v/1e6)+"M");

  // ==== Axes (no baseline, no tick mark dưới) ====
  g.append("g").attr("transform", `translate(0,${h})`).attr("class","axis")
    .call(d3.axisBottom(x).tickValues(ticks).tickFormat(tickFmt).tickSize(0)) // <-- xoá tick vàng
    .select(".domain").remove();

  g.append("g").attr("class","axis")
    .call(d3.axisLeft(y).tickSizeInner(0))
    .select(".domain").remove();

  // ==== Grid vertical: bỏ tick 0, giữ tick max ====
  const innerTicks = ticks.slice(1);
  const grid = g.append("g").attr("class","gridline").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(innerTicks).tickSize(-h).tickFormat(""));
  grid.select(".domain").remove();

  // Bars + tooltip
  g.selectAll("rect.bar").data(rows).join("rect")
    .attr("class","bar")
    .attr("x",0).attr("y",d=>y(d.label))
    .attr("width",d=>x(d.sales)).attr("height",y.bandwidth())
    .attr("fill",d=>colorFor(d.group_name))
    .on("mousemove",(ev,d)=>{
      tip.style("left",(ev.clientX+12)+"px")
         .style("top",(ev.clientY-12)+"px")
         .style("opacity",1)
         .html(
           `<div class="tt-row first"><div class="tt-key">Mặt hàng:</div><div class="tt-val">${d.label}</div></div>
            <div class="tt-row"><div class="tt-key">Nhóm hàng:</div><div class="tt-val">${normalizeGroup(d.group_name)}</div></div>
            <div class="tt-row"><div class="tt-key">Doanh số bán:</div><div class="tt-val">${fmtMoney(d.sales)}</div></div>
            <div class="tt-row"><div class="tt-key">Số lượng bán:</div><div class="tt-val">${fmtInt(d.qty)} SKUs</div></div>`
         );
    })
    .on("mouseleave",()=> tip.style("opacity",0));

  // Data labels
  g.selectAll("text.label").data(rows).join("text")
    .attr("class","label label-outside")
    .attr("x", d => x(d.sales) + 6)
    .attr("y", d => y(d.label) + y.bandwidth()/2 + 4)
    .style("font-size","10px")
    .text(d => fmtMoney(d.sales));
}

// Export
window.bootQ1 = bootQ1;
})();
