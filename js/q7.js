// js/q7.js
(function () {
  /* =============== PALETTE & GROUP NORMALIZE =============== */
  const GROUP_COLORS = {
    "[BOT] Bột"             : "#4f6f98",
    "[SET] Set trà"         : "#d98453",
    "[THO] Trà hoa"         : "#cf6b5b",
    "[TMX] Trà mix"         : "#84c5bf",
    "[TTC] Trà củ, quả sấy" : "#7ab874"
  };
  const CANONICAL = new Map([
    ["BOT","[BOT] Bột"],["Bột","[BOT] Bột"],["[BOT] Bột","[BOT] Bột"],
    ["SET","[SET] Set trà"],["Set trà","[SET] Set trà"],["Set tra","[SET] Set trà"],["[SET] Set trà","[SET] Set trà"],
    ["THO","[THO] Trà hoa"],["Trà hoa","[THO] Trà hoa"],["[THO] Trà hoa","[THO] Trà hoa"],
    ["TMX","[TMX] Trà mix"],["Trà mix","[TMX] Trà mix"],["[TMX] Trà mix","[TMX] Trà mix"],
    ["TTC","[TTC] Trà củ, quả sấy"],["Trà củ, quả sấy","[TTC] Trà củ, quả sấy"],["[TTC] Trà củ, quả sấy","[TTC] Trà củ, quả sấy"]
  ]);
  const normalizeGroup = (g) => {
    const s = (g || "").trim();
    if (CANONICAL.has(s)) return CANONICAL.get(s);
    const m = s.match(/\[?([A-Z]{3})\]?/);
    if (m && CANONICAL.has(m[1])) return CANONICAL.get(m[1]);
    for (const k of CANONICAL.keys()) {
      if (s.toLowerCase() === k.toLowerCase()) return CANONICAL.get(k);
    }
    return s || "(khác)";
  };
  const colorFor = g => GROUP_COLORS[normalizeGroup(g)] || "#6b7280";

  /* =================== Tooltip & format =================== */
  const tip     = d3.select("body").append("div").attr("class","tooltip");
  const fmtPct1 = d3.format(".1%");
  const fmtInt  = d3.format(",");

  /* =================== Boot =================== */
  function bootQ7(containerSel = "#view"){
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class","card").text("Đang tải Q7…");

    d3.csv("./data/sales.csv", row => {
      const orderId =
        row["Số HĐ"] || row["So HD"] ||
        row["Số hóa đơn"] || row["So hoa don"] ||
        row["Mã đơn"] || row["Ma don"] ||
        row["Mã đơn hàng"] || row["Ma don hang"] ||
        row["OrderID"] || row["Order Id"] || row["Invoice"] ||
        row["Số chứng từ"] || row["So chung tu"] ||
        row["Số"] || row["So"] || "";

      return {
        order_key : String(orderId || "").trim(),
        group_name: normalizeGroup(row["Tên nhóm hàng"] || row["Nhom hang"] || row["Group"] || "")
      };
    }).then(raw => {
      const rows = raw.filter(d => d.order_key && d.group_name);

      // Tổng số đơn (unique)
      const allOrders   = new Set(rows.map(d => d.order_key));
      const totalOrders = allOrders.size || 1;

      // Nhóm → Set(order)
      const groupOrderSet = new Map();
      for (const r of rows) {
        if (!groupOrderSet.has(r.group_name)) groupOrderSet.set(r.group_name, new Set());
        groupOrderSet.get(r.group_name).add(r.order_key);
      }

      const data = Array.from(groupOrderSet, ([group_name, set]) => ({
        group_name,
        count: set.size,
        p    : set.size / totalOrders
      })).sort((a,b)=> d3.descending(a.p, b.p));

      drawQ7(data, containerSel);
    }).catch(err=>{
      d3.select(containerSel).html(`<div class="card error">Không thể vẽ Q7: ${err.message}</div>`);
    });
  }

  /* =================== Draw =================== */
  function drawQ7(data, containerSel = "#view"){
    const root = d3.select(containerSel).html("");

    root.append("h2")
      .attr("class","chart-title")
      .text("Xác suất bán hàng theo Nhóm hàng");

    const card = root.append("div").attr("class","card");

    const W = 1200;
    const barH = 64;
    const H = Math.max(360, data.length*barH + 120);
    const M = { t: 20, r: 160, b: 64, l: 230 };
    const w = W - M.l - M.r;
    const h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g   = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    // Domain X theo dữ liệu (để bar có thể vươn tới 5x%)
    const maxP  = d3.max(data, d => d.p) || 0;
    const xMax  = Math.min(1, Math.ceil(maxP*10)/10);    // 0.5/0.6/0.7...
    const x     = d3.scaleLinear().domain([0, xMax]).range([0, w]);

    // ❗ Trục & lưới chỉ hiển thị tới 50%
    const axisTicks = d3.range(0, 0.5 + 0.0001, 0.1);

    const y = d3.scaleBand()
      .domain(data.map(d=>d.group_name))
      .range([0, h])
      .paddingInner(0.12)
      .paddingOuter(0.06);

    // Trục Y
    g.append("g").attr("class","axis")
      .call(d3.axisLeft(y).tickSizeInner(0))
      .select(".domain").remove();

    // Grid dọc (tới 50%)
    g.append("g")
      .attr("class","gridline")
      .attr("transform", `translate(0,${h})`)
      .call(
        d3.axisBottom(x)
          .tickValues(axisTicks)
          .tickSize(-h)
          .tickFormat("")
      )
      .select(".domain").remove();

    // Trục X (tới 50%, KHÔNG vẽ tick mark)
    g.append("g")
      .attr("class","axis")
      .attr("transform",`translate(0,${h})`)
      .call(
        d3.axisBottom(x)
          .tickValues(axisTicks)
          .tickFormat(v => Math.round(v*100) + "%")
          .tickSize(0)   // tắt vạch tick
      )
      .select(".domain").remove();

    // Bars (vẫn dài theo p thật)
    g.selectAll("rect.q7-bar")
      .data(data)
      .join("rect")
      .attr("class","q7-bar")
      .attr("x",0)
      .attr("y",d=>y(d.group_name))
      .attr("width",d=>x(Math.min(d.p, xMax)))
      .attr("height",y.bandwidth())
      .attr("fill",d=>colorFor(d.group_name))
      .on("mousemove",(ev,d)=>{
        tip.style("left",(ev.clientX+12)+"px")
           .style("top",(ev.clientY-12)+"px")
           .style("opacity",1)
           .html(`
             <div class="tt-row first">
               <div class="tt-key">Nhóm hàng:</div>
               <div class="tt-val"><b>${d.group_name}</b></div>
             </div>
             <div class="tt-row">
               <div class="tt-key">SL Đơn Bán:</div>
               <div class="tt-val">${fmtInt(d.count)}</div>
             </div>
             <div class="tt-row">
               <div class="tt-key">Xác suất Bán:</div>
               <div class="tt-val">${fmtPct1(d.p)}</div>
             </div>
           `);
      })
      .on("mouseleave",()=> tip.style("opacity",0));

    // Data label ngoài thanh: gap hẹp hơn
    const labelGap = 8;   // <-- điều chỉnh khoảng cách sát cột hơn
    g.selectAll("text.q7-label")
      .data(data)
      .join("text")
      .attr("class","q7-label")
      .attr("x", d => Math.min(x(d.p) + labelGap, w + 5))
      .attr("y", d => y(d.group_name) + y.bandwidth()/2 + 4)
      .attr("text-anchor","start")
      .style("font-size","12px")
      .text(d => fmtPct1(d.p));
  }

  // export
  window.bootQ7 = bootQ7;
})();
