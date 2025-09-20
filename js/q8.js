// js/q8.js
(function () {
  const GROUP_COLORS = {
    "[BOT] Bột":             "#4f6f98",
    "[SET] Set trà":         "#d98453",
    "[THO] Trà hoa":         "#cf6b5b",
    "[TTC] Trà củ, quả sấy": "#7ab874",
    "[TMX] Trà mix":         "#84c5bf",
  };

  const CANONICAL = new Map([
    ["BOT","[BOT] Bột"],["Bột","[BOT] Bột"],["[BOT] Bột","[BOT] Bột"],
    ["SET","[SET] Set trà"],["Set trà","[SET] Set trà"],["Set tra","[SET] Set trà"],["[SET] Set trà","[SET] Set trà"],
    ["THO","[THO] Trà hoa"],["Trà hoa","[THO] Trà hoa"],["[THO] Trà hoa","[THO] Trà hoa"],
    ["TMX","[TMX] Trà mix"],["Trà mix","[TMX] Trà mix"],["[TMX] Trà mix","[TMX] Trà mix"],
    ["TTC","[TTC] Trà củ, quả sấy"],["Trà củ, quả sấy","[TTC] Trà củ, quả sấy"],["[TTC] Trà củ, quả sấy","[TTC] Trà củ, quả sấy"],
  ]);
  const normalizeGroup = g => {
    const s = (g||"").trim();
    if (CANONICAL.has(s)) return CANONICAL.get(s);
    const m = s.match(/\[?([A-Z]{3})\]?/);
    if (m && CANONICAL.has(m[1])) return CANONICAL.get(m[1]);
    for (const k of CANONICAL.keys()) if (s.toLowerCase() === k.toLowerCase()) return CANONICAL.get(k);
    return s || "(khác)";
  };
  const colorFor = g => GROUP_COLORS[normalizeGroup(g)] || "#6b7280";

  const tip = d3.select("body").append("div").attr("class","tooltip");
  const fmtPct1 = d3.format(".1%");
  const fmtInt  = d3.format(",");

  const MONTH_LABELS = Array.from({length:12}, (_,i)=> `Tháng ${String(i+1).padStart(2,"0")}`);

  function bootQ8(containerSel = "#view") {
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class","card").text("Đang tải Q8…");

    d3.csv("./data/sales.csv", row => {
      const dateStr =
        row["Thời gian tạo đơn"] || row["Ngay tao don"] || row["Date"] || row["CreatedAt"] || "";
      const dt   = dateStr ? new Date(dateStr) : null;

      const orderId =
        row["Số HĐ"] || row["So HD"] ||
        row["Số hóa đơn"] || row["So hoa don"] ||
        row["Mã đơn"] || row["Ma don"] ||
        row["Mã đơn hàng"] || row["Ma don hang"] ||
        row["OrderID"] || row["Order Id"] || row["Invoice"] ||
        row["Số chứng từ"] || row["So chung tu"] ||
        row["Số"] || row["So"] || "";

      return {
        monthIdx  : dt ? (dt.getMonth()+1) : null, // 1..12
        order_key : String(orderId||"").trim(),
        group_name: normalizeGroup(row["Tên nhóm hàng"] || row["Nhom hang"] || row["Group"] || "")
      };
    }).then(rowsRaw => {
      const rows = rowsRaw.filter(r => r.monthIdx && r.order_key && r.group_name);

      // Tập đơn theo tháng
      const monthOrders = new Map();
      for (const r of rows) {
        if (!monthOrders.has(r.monthIdx)) monthOrders.set(r.monthIdx, new Set());
        monthOrders.get(r.monthIdx).add(r.order_key);
      }

      // Tập đơn theo (tháng, nhóm)
      const monthGroupOrders = new Map();
      for (const r of rows) {
        const key = `${r.monthIdx}||${r.group_name}`;
        if (!monthGroupOrders.has(key)) monthGroupOrders.set(key, new Set());
        monthGroupOrders.get(key).add(r.order_key);
      }

      // Series cho từng nhóm
      const groups = Array.from(new Set(rows.map(r => r.group_name)));
      const series = groups.map(g => {
        const points = [];
        for (let m=1; m<=12; m++) {
          const all = monthOrders.get(m) || new Set();
          const set = monthGroupOrders.get(`${m}||${g}`) || new Set();
          const p   = all.size ? (set.size / all.size) : null;
          points.push({
            monthIdx: m,
            label   : MONTH_LABELS[m-1],
            count   : set.size,
            p
          });
        }
        return { group: g, color: colorFor(g), points };
      });

      drawQ8(series, containerSel);
    }).catch(err => {
      d3.select(containerSel).html(`<div class="card error">Không thể vẽ Q8: ${err.message}</div>`);
    });
  }

  function drawQ8(series, containerSel="#view") {
    const root = d3.select(containerSel).html("");

    root.append("h2").attr("class","chart-title")
      .text("Xác suất bán hàng của Nhóm hàng theo Tháng");

    const card = root.append("div").attr("class","card");

    const W = 1200, H = 520;
    const M = { t: 28, r: 260, b: 50, l: 80 };
    const w = W - M.l - M.r, h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g   = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    // Scales
    const x = d3.scaleBand().domain(MONTH_LABELS).range([0, w]).padding(0.1);
    const yTicks = d3.range(0.20, 0.701, 0.05);
    const y = d3.scaleLinear().domain([0.20, 0.70]).range([h, 0]);

    // ===== Gridline dọc: 1 vạch cho mỗi ranh giới tháng =====
    // chỉ lấy MÉP TRÁI của từng band + mép phải cuối cùng
    const edgeXs = new Set();
    x.domain().forEach(d => edgeXs.add(x(d)));
    edgeXs.add(w);

    g.append("g").attr("class","gridline-x")
      .selectAll("line")
      .data(Array.from(edgeXs).sort((a,b)=>a-b))
      .join("line")
      .attr("x1", d => d)
      .attr("x2", d => d)
      .attr("y1", 0)
      .attr("y2", h)
      .attr("stroke", "#e8ecf4")
      .attr("stroke-width", 1)
      .attr("shape-rendering", "crispEdges");

    // Axes
    g.append("g")
      .attr("class","axis")
      .attr("transform",`translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain").remove();

    g.append("g")
      .attr("class","axis")
      .call(
        d3.axisLeft(y)
          .tickValues(yTicks)
          .tickFormat(d => Math.round(d*100) + "%")
          .tickSize(0)               // <-- KHÔNG vẽ vạch tick nhỏ (bỏ “mấy tick vàng”)
      )
      .select(".domain").remove();

    // Line generator (thẳng)
    const line = d3.line()
      .defined(d => d.p != null)
      .x(d => x(d.label) + x.bandwidth()/2)
      .y(d => y(d.p))
      .curve(d3.curveLinear);

    // Lines
    g.append("g").selectAll("path.q8-line")
      .data(series)
      .join("path")
      .attr("class","q8-line")
      .attr("fill","none")
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2)
      .attr("d", d => line(d.points));

    // Points + tooltip
    g.append("g").selectAll("g.series-pts")
      .data(series)
      .join("g")
      .attr("class","series-pts")
      .attr("fill", d => d.color)
      .selectAll("circle")
      .data(d => d.points.filter(p => p.p != null))
      .join("circle")
      .attr("cx", d => x(d.label) + x.bandwidth()/2)
      .attr("cy", d => y(d.p))
      .attr("r", 3)
      .on("mousemove", function (ev, d) {
        const group = d3.select(this.parentNode).datum().group;
        tip.style("left", (ev.clientX + 12) + "px")
           .style("top",  (ev.clientY - 12) + "px")
           .style("opacity", 1)
           .html(`
             <div class="tt-title"><b>${d.label} | Nhóm hàng ${group}</b></div>
             <div class="tt-row"><span class="tt-key">SL Đơn Bán:</span> <span class="tt-val">${fmtInt(d.count)}</span></div>
             <div class="tt-row"><span class="tt-key">Xác suất Bán:</span> <span class="tt-val">${fmtPct1(d.p)}</span></div>
           `);
      })
      .on("mouseleave", () => tip.style("opacity", 0));

    // Legend nhỏ (10px)
    const legend = svg.append("g").attr("transform", `translate(${W - M.r + 20}, ${M.t})`);
    legend.append("text")
      .text("Nhóm hàng")
      .attr("x", 0).attr("y", 0)
      .attr("dy", "0.8em")
      .style("font-weight", 700)
      .style("font-size", "12px"); // tiêu đề có thể 12px cho dễ đọc

    const lg = legend.append("g").attr("transform","translate(0, 16)");
    const item = lg.selectAll("g.l-item")
      .data(series)
      .join("g").attr("class","l-item")
      .attr("transform", (_,i)=>`translate(0, ${i*18})`);
    item.append("rect")
      .attr("width", 12).attr("height", 12).attr("rx", 2).attr("ry", 2)
      .attr("fill", d => d.color);
    item.append("text")
      .attr("x", 18).attr("y", 6).attr("dy", "0.35em")
      .style("font-size","10px")   // <-- cỡ chữ legend 10px
      .text(d => d.group);
  }

  window.bootQ8 = bootQ8;
})();
