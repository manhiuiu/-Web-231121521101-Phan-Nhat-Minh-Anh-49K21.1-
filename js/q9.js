// js/q9.js
(function () {
  /* ========== Aliases & helpers ========== */
  const COLS = {
    date: ["Thời gian tạo đơn", "Ngày", "Order Date", "Invoice Date", "Date"],
    orderId: ["Mã đơn hàng", "Ma don hang", "Số HĐ", "So HD", "Invoice", "Số chứng từ", "So chung tu", "Số", "So"],
    groupCode: ["Mã nhóm", "Ma nhom", "Mã nhóm hàng", "Ma nhom hang", "Mã nhóm h", "Ma nhom h"],
    groupName: ["Tên nhóm hàng", "Ten nhom hang", "Tên nhóm", "Ten nhom", "Group", "Nhóm", "Nhom"],
    itemCode: ["Mã mặt hàng", "Ma mat hang", "Code", "SKU", "Mã hàng", "Ma hang"],
    itemName: ["Tên mặt hàng", "Ten mat hang", "Item", "Tên hàng", "Ten hang"]
  };

  function pick(row, keys) {
    for (const k of keys) if (row[k] != null && String(row[k]).trim() !== "") return row[k];
    return "";
  }

  // Parse date -> month (1..12)
  function toMonth(s) {
    if (!s) return null;
    const t = String(s).trim();
    let d = new Date(t);
    if (!isFinite(d)) {
      const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) d = new Date(+m[3], (+m[1]) - 1, +m[2]);
    }
    return isFinite(d) ? d.getMonth() + 1 : null;
  }

  // X-max theo từng nhóm (giống ảnh)
  const X_CAP = { BOT: 1.00, SET: 0.15, THO: 0.20, TMX: 0.30, TTC: 0.50 };

  // Vị trí mong muốn trên lưới 3 cột, 2 hàng
  const POSITIONS = [
    { code: "BOT", col: 1, row: 1 },
    { code: "SET", col: 2, row: 1 },
    { code: "THO", col: 3, row: 1 },
    { code: "TMX", col: 1, row: 2 }, // dưới BOT
    { code: "TTC", col: 2, row: 2 }  // dưới SET
    // ô (3,2) bỏ trống cho cân bố cục
  ];

  /* ========== Boot ========== */
  function bootQ9(containerSel = "#view") {
    const view = d3.select(containerSel).html("");

    d3.csv("./data/sales.csv").then(rows => {
      if (!rows || !rows.length) {
        view.append("div").attr("class", "message").text("Không có dữ liệu.");
        return;
      }

      // Tổng số đơn theo NHÓM (12 tháng)
      const totalOrdersByGroup = new Map(); // groupKey -> Set(orderId)

      // Đơn theo MẶT HÀNG trong NHÓM chỉ trong T7..T12
      const productOrders_Q3_Q4 = new Map(); // groupKey -> Map(itemKey -> Set(orderId))

      for (const r of rows) {
        const groupCode = String(pick(r, COLS.groupCode) || "").trim();
        const groupName = String(pick(r, COLS.groupName) || "").trim();
        const itemCode  = String(pick(r, COLS.itemCode)  || "").trim();
        const itemName  = String(pick(r, COLS.itemName)  || "").trim();
        const orderId   = String(pick(r, COLS.orderId)   || "").trim();
        const month     = toMonth(pick(r, COLS.date));

        if (!groupCode || !groupName || !itemCode || !itemName || !orderId || !month) continue;

        const groupKey = `[${groupCode}] ${groupName}`;
        const itemKey  = `[${itemCode}] ${itemName}`;

        // tổng đơn 12 tháng theo NHÓM
        if (!totalOrdersByGroup.has(groupKey)) totalOrdersByGroup.set(groupKey, new Set());
        totalOrdersByGroup.get(groupKey).add(orderId);

        // đơn trong T7..T12 theo MẶT HÀNG trong NHÓM
        if (month >= 7 && month <= 12) {
          if (!productOrders_Q3_Q4.has(groupKey)) productOrders_Q3_Q4.set(groupKey, new Map());
          const mp = productOrders_Q3_Q4.get(groupKey);
          if (!mp.has(itemKey)) mp.set(itemKey, new Set());
          mp.get(itemKey).add(orderId);
        }
      }

      // Map code -> full groupKey
      const groupKeyByCode = {};
      for (const k of totalOrdersByGroup.keys()) {
        const m = k.match(/^\[([A-Z]{3})]/);
        if (m) groupKeyByCode[m[1]] = k;
      }

      // Tiêu đề lớn (bar xanh)
      view.append("div")
        .style("background", "#546d8d")
        .style("color", "#fff")
        .style("padding", "10px 14px")
        .style("border-radius", "8px")
        .style("margin-bottom", "14px")
        .style("text-align", "center")
        .style("font-weight", "700")
        .style("letter-spacing", "0.2px")
        .text("Xác suất bán hàng của Mặt hàng theo Nhóm hàng");

      // Lưới 3 cột cho 2 hàng
      const grid = view.append("div")
        .style("display", "grid")
        .style("grid-template-columns", "1fr 1fr 1fr")
        .style("gap", "16px");

      function renderGroup(groupKey, host) {
        const totalOrders = totalOrdersByGroup.get(groupKey);
        if (!totalOrders || totalOrders.size === 0) return;

        const byItem = productOrders_Q3_Q4.get(groupKey) || new Map();
        const data = Array.from(byItem, ([name, set]) => {
          const num = set.size;                 // SL đơn bán T7..T12 của mặt hàng
          const den = totalOrders.size;         // Tổng đơn theo nhóm cả 12 tháng
          return { name, p: num / den, num, den };
        }).sort((a, b) => d3.descending(a.p, b.p));

        const card = host.append("div")
          .style("padding", "10px 10px 8px 10px")
          .style("background", "#fff")
          .style("border-radius", "10px")
          .style("box-shadow", "0 2px 6px rgba(0,0,0,0.08)");

        card.append("div")
          .style("margin", "2px 0 8px 0")
          .style("text-align", "center")
          .style("color", "#008080")
          .style("font-weight", "700")
          .style("font-size", "16px")
          .text(groupKey);

        const chartId = "q9_" + groupKey.replace(/[^a-zA-Z0-9]/g, "_");
        card.append("div").attr("id", chartId);

        drawBar(chartId, data, groupKey);
      }

      // Vẽ theo vị trí đã định
      POSITIONS.forEach(pos => {
        const full = groupKeyByCode[pos.code];
        const cell = grid.append("div")
          .style("grid-column", String(pos.col))
          .style("grid-row", String(pos.row));
        if (full) renderGroup(full, cell);
      });

      // Ô trống (dưới THO) để bố cục cân đối
      grid.append("div").style("grid-column", "3").style("grid-row", "2");
    }).catch(err => {
      console.error(err);
      d3.select(containerSel).html("<div class='message'>Không thể đọc dữ liệu.</div>");
    });
  }

  /* ========== Color Palettes theo nhóm ========== */
  function getColorForGroup(mCode, data) {
    if (mCode === "SET") {
      const map = {
        "[SET04] Set 10 gói trà gừng":       "#4CAF50",
        "[SET03] Set 10 gói trà hoa cúc trắng": "#FFCC80",
        "[SET05] Set 10 gói trà dưỡng nhan": "#AED581",
        "[SET02] Set 10 gói trà hoa đậu biếc": "#FFB74D",
        "[SET01] Set 10 gói trà nụ hoa nhài trắng": "#90CAF9",
        "[SET06] Set 10 gói trà gạo lứt 8 vị": "#A1887F",
        "[SET07] Set 10 gói trà cam sả quế": "#FFF176"
      };
      return d => map[d.name] || "#9E9E9E";
    }

    if (mCode === "THO") {
      const map = {
        "[THO03] Trà hoa cúc trắng":       "#D32F2F",
        "[THO01] Trà nụ hoa nhài trắng":   "#F9A825",
        "[THO02] Trà hoa đậu biếc":        "#80CBC4",
        "[THO06] Trà nhụy hoa nghệ tây":   "#BDBDBD",
        "[THO05] Trà hoa Atiso":           "#8D6E63",
        "[THO04] Trà nụ hoa hồng Tây Tạng":"#F48FB1"
      };
      return d => map[d.name] || "#9E9E9E";
    }

    if (mCode === "TMX") {
      const map = {
        "[TMX01] Trà dưỡng nhan": "#C2185B",
        "[TMX03] Trà gạo lứt 8 vị": "#9C27B0",
        "[TMX02] Trà cam sả quế":  "#F06292"
      };
      return d => map[d.name] || "#9E9E9E";
    }

    if (mCode === "TTC") {
      const map = {
        "[TTC01] Trà gừng": "#CE93D8",
        "[TTC02] Cam lát":  "#BF8F5F"
      };
      return d => map[d.name] || "#9E9E9E";
    }

    if (mCode === "BOT") {
      const map = { "[BOT01] Bột cần tây": "#4f6f98" };
      return d => map[d.name] || "#607D8B";
    }

    // mặc định: Tableau10
    const scale = d3.scaleOrdinal(d3.schemeTableau10)
      .domain((data || []).map(d => d.name));
    return d => scale(d.name);
  }

  /* ========== Draw one group (with TOOLTIP) ========== */
  function drawBar(containerId, data, groupKey) {
    const host = d3.select(`#${containerId}`).node();
    const W = (host && host.getBoundingClientRect().width) ? host.getBoundingClientRect().width : 560;
    const H = 220; // đồng đều

    // đo nhãn Y để set left margin
    const tmp = d3.select(`#${containerId}`)
      .append("svg").attr("width", 10).attr("height", 10)
      .style("position", "absolute").style("left", "-9999px").style("top", "-9999px");
    let maxLabelW = 0;
    tmp.selectAll("text._m")
      .data((data || []).map(d => d.name))
      .enter().append("text").attr("class", "_m")
      .style("font-size", "12px").style("font-family", "sans-serif")
      .text(d => d)
      .each(function () { maxLabelW = Math.max(maxLabelW, this.getBBox().width); });
    tmp.remove();

    const mCode = (groupKey.match(/^\[([A-Z]{3})]/) || [])[1];
    const xMax = X_CAP[mCode] ?? Math.min(1, Math.ceil((d3.max(data, d => d.p) || 0.1) * 20) / 20);

    // margin động — tăng lề phải cho TMX/TTC để label không bị cắt
    let extraRight = 8;
    if (mCode === "TMX" || mCode === "TTC") extraRight = 32;

    const M = { t: 18, r: extraRight, b: 42, l: Math.min(230, Math.max(90, Math.round(maxLabelW + 16))) };

    const svg = d3.select(`#${containerId}`).append("svg")
      .attr("width", W).attr("height", H);

    const x = d3.scaleLinear().domain([0, xMax]).range([M.l, W - M.r]);
    const y = d3.scaleBand().domain((data || []).map(d => d.name))
      .range([M.t, H - M.b]).padding(0.18);

    // ticks cố định theo nhóm
    let tickVals;
    if (mCode === "BOT") tickVals = d3.range(0, 1.001, 0.20);
    else if (mCode === "SET") tickVals = [0, 0.05, 0.10, 0.15];
    else if (mCode === "THO") tickVals = [0, 0.05, 0.10, 0.15, 0.20];
    else if (mCode === "TMX") tickVals = [0, 0.10, 0.20, 0.30];
    else if (mCode === "TTC") tickVals = [0, 0.10, 0.20, 0.30, 0.40, 0.50];

    // grid
    svg.append("g").attr("class", "gridline")
      .attr("transform", `translate(0,${H - M.b})`)
      .call(d3.axisBottom(x).tickValues(tickVals).tickSize(-(H - M.t - M.b)).tickFormat(""))
      .select(".domain").remove();

    // trục X
    svg.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${H - M.b})`)
      .call(d3.axisBottom(x).tickValues(tickVals).tickFormat(v => `${Math.round(v * 100)}%`))
      .select(".domain").remove();

    // trục Y
    svg.append("g").attr("class", "axis")
      .attr("transform", `translate(${M.l},0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .select(".domain").remove();

    // ==== MÀU THEO NHÓM ====
    const color = getColorForGroup(mCode, data);

    // --- Tooltip (singleton) ---
    let tip = d3.select("body").select("#q9-tooltip");
    if (tip.empty()) {
      tip = d3.select("body").append("div").attr("id", "q9-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "#fff")
        .style("border", "1px solid #ddd")
        .style("border-radius", "6px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
        .style("padding", "8px 10px")
        .style("font-size", "12px")
        .style("color", "#333")
        .style("opacity", 0);
    }
    const fmtPct = d3.format(".0%"); // 71%
    const fmtInt = d3.format(",");

    // bars
    svg.selectAll("rect.bar").data(data).enter().append("rect")
      .attr("class", "bar")
      .attr("x", x(0))
      .attr("y", d => y(d.name))
      .attr("width", d => Math.max(1, x(Math.min(d.p, xMax)) - x(0)))
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d))
      .on("mouseenter", function () {
        tip.style("opacity", 1);
      })
      .on("mousemove", function (event, d) {
  const html =
    `<div style="font-weight:700">Mặt hàng: ${d.name}</div>` +           // chỉ dòng này in đậm
    `<div>Nhóm hàng: ${groupKey}</div>` +
    `<div>SL Đơn Bán: ${fmtInt(d.num || 0)}</div>` +
    `<div>Xác suất Bán / Nhóm hàng: ${fmtPct(d.p || 0)}</div>`;

  tip.html(html)
     .style("left", (event.pageX + 12) + "px")
     .style("top", (event.pageY + 12) + "px");
})

      
      .on("mouseleave", function () {
        tip.style("opacity", 0);
      });

    // Data labels: luôn ngoài thanh (bên phải)
    svg.selectAll("text.label").data(data).enter().append("text")
      .attr("class", "label")
      .attr("x", d => x(Math.min(d.p, xMax)) + 6)
      .attr("y", d => y(d.name) + y.bandwidth() / 2 + 1)
      .attr("text-anchor", "start")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .text(d => `${(d.p * 100).toFixed(1)}%`);
  }

  // expose
  window.bootQ9 = bootQ9;
})();
