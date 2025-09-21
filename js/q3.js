// js/q3.js
(function () {
  // ---------- Tooltip + formatters ----------
  const tip = d3.select("body").append("div").attr("class", "tooltip");
  const fmtMoney = v => `${d3.format(",.0f")(v / 1e6)} triệu VND`;
  const fmtInt   = v => d3.format(",")(Math.round(+v || 0));

  // ---------- Palette for 12 months ----------
  const COLORS = [
    "#6b7280", "#b8b0a9", "#cf6b8a", "#f2b6c1",
    "#9b6b9b", "#c9a3c9", "#8c6b4f", "#d9b89c",
    "#84c5bf", "#7ab874", "#cf6b5b", "#f29c9c"
  ];
  function colorForMonth(m) {
    // m: 1..12
    return COLORS[(m - 1) % COLORS.length];
  }

  // ---------- Boot (load CSV -> group -> draw) ----------
  function bootQ3(containerSel = "#view") {
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class", "card").text("Đang tải Q3…");

    d3.csv("./data/sales.csv", row => {
      // Aliases you might have in your CSV
      const dtStr = row["Thời gian tạo đơn"] || row["Ngay"] || row["Date"] || row["Created"];
      const sales =
        +row["Thành tiền"] || +row["Thanh tien"] || +row["Sales"] || 0;
      const qty =
        +row["SL"] || +row["So luong"] || +row["Qty"] || 0;

      const date = dtStr ? new Date(dtStr) : null;
      const month = date ? date.getMonth() + 1 : null;

      return { month, sales, qty };
    })
      .then(raw => {
        const data = raw.filter(d => d.month);

        // Group by month (1..12), sum sales & qty
        const rows = d3
          .rollups(
            data,
            v => ({
              sales: d3.sum(v, d => +d.sales),
              qty  : d3.sum(v, d => +d.qty)
            }),
            d => d.month
          )
          .map(([m, o]) => ({
            month     : m,
            monthLabel: "Tháng " + String(m).padStart(2, "0"),
            sales     : o.sales,
            qty       : o.qty
          }))
          .sort((a, b) => d3.ascending(a.month, b.month));

        drawQ3(rows, containerSel);
      })
      .catch(err => {
        d3.select(containerSel).html(
          `<div class="card error">Không thể vẽ Q3: ${err.message}</div>`
        );
      });
  }

  // ---------- Draw ----------
  function drawQ3(rows, containerSel = "#view") {
    const root = d3.select(containerSel).html("");

    // Title
    root
      .append("h2")
      .attr("class", "chart-title")
      .text("Doanh số bán hàng theo Tháng");

    // Card + SVG
    const card = root.append("div").attr("class", "card");
    const W = 1200,
      H = 500,
      M = { t: 20, r: 30, b: 60, l: 60 };
    const w = W - M.l - M.r,
      h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    // Scales
    const x = d3
      .scaleBand()
      .domain(rows.map(d => d.monthLabel))
      .range([0, w])
      .padding(0.2);

    const step = 50e6; // 50M
    const dataMax = d3.max(rows, d => d.sales) || 1;
    const yMax = Math.ceil(dataMax / step) * step;
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // ---- Axes (no tick marks, no baselines) ----
    const fmtY = v => (v === 0 ? "0M" : v / 1e6 + "M");

    // X axis
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0)) // no tick marks
      .select(".domain")
      .remove(); // remove baseline

    // Y axis
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(8).tickFormat(fmtY).tickSize(0)) // no tick marks
      .select(".domain")
      .remove(); // remove baseline

    // ---- Horizontal grid lines ----
    const yTicks = y.ticks(8);
    g.append("g")
      .attr("class", "gridline")
      .call(
        d3
          .axisLeft(y)
          .tickValues(yTicks)
          .tickSize(-w)
          .tickFormat("")
      )
      .select(".domain")
      .remove();

    // ---- Bars + tooltip ----
    g.selectAll("rect.q3-bar")
      .data(rows)
      .join("rect")
      .attr("class", "q3-bar")
      .attr("x", d => x(d.monthLabel))
      .attr("y", d => y(d.sales))
      .attr("width", x.bandwidth())
      .attr("height", d => h - y(d.sales))
      .attr("fill", d => colorForMonth(d.month))
      .on("mousemove", (ev, d) => {
        tip
          .style("left", ev.clientX + 12 + "px")
          .style("top", ev.clientY - 12 + "px")
          .style("opacity", 1)
          .html(`
            <div class="tt-title"><b>${d.monthLabel}</b></div>
            <div class="tt-row">
                <span class="tt-key">Doanh số bán:</span>
                <span class="tt-val">${fmtMoney(d.sales)}</span>
            </div>
            <div class="tt-row">
                <span class="tt-key">Số lượng bán:</span>
                <span class="tt-val">${fmtInt(d.qty)} SKUs</span>
            </div>
            `);

      })
      .on("mouseleave", () => tip.style("opacity", 0));

    // ---- Value labels (centered above each bar) ----
    g.selectAll("text.q3-label")
      .data(rows)
      .join("text")
      .attr("class", "label-top")
      .attr("x", d => x(d.monthLabel) + x.bandwidth() / 2)
      .attr("y", d => Math.min(y(d.sales) - 8, h - 8)) // stay inside viewbox
      .attr("text-anchor", "middle")
      .text(d => fmtMoney(d.sales))
      .style("font-size","10px")
  .style("font-weight","normal");
  }

  // Expose
  window.bootQ3 = bootQ3;
})();
