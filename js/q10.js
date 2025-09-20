// js/q10.js
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

  const MONTHS = ["T07","T08","T09","T10","T11","T12"];

  function pick(row, keys) {
    for (const k of keys) if (row[k] != null && String(row[k]).trim() !== "") return row[k];
    return "";
  }
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

  // Y caps & ticks
  const Y_CAP = { ALL:[0.90,1.10], SET:[0.05,0.25], THO:[0.10,0.35], TMX:[0.30,0.50], TTC:[0.35,0.75] };
  const TICKS = {
    ALL:[0.90,1.00,1.10],
    SET:[0.10,0.15,0.20,0.25],
    THO:[0.15,0.20,0.25,0.30],
    TMX:[0.30,0.35,0.40,0.45,0.50],
    TTC:[0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70,0.75]
  };

  // Grid layout
  const POSITIONS = [
    { code:"ALL", col:1, row:1 },
    { code:"SET", col:2, row:1 },
    { code:"THO", col:3, row:1 },
    { code:"TMX", col:1, row:2 },
    { code:"TTC", col:2, row:2 }
  ];

  /* ====== Colors ====== */
  function colorFnForGroup(code, names) {
    const maps = {
      SET: {
        "[SET04] Set 10 gói trà gừng":"#4CAF50",
        "[SET03] Set 10 gói trà hoa cúc trắng":"#e8925aff",
        "[SET05] Set 10 gói trà dưỡng nhan":"#AED581",
        "[SET02] Set 10 gói trà hoa đậu biếc":"#eb6e2bff",
        "[SET01] Set 10 gói trà nụ hoa nhài trắng":"#90CAF9",
        "[SET06] Set 10 gói trà gạo lứt 8 vị":"#87703fff",
        "[SET07] Set 10 gói trà cam sả quế":"#FBC02D"
      },
      THO: {
        "[THO03] Trà hoa cúc trắng":"#D32F2F",
        "[THO01] Trà nụ hoa nhài trắng":"#F9A825",
        "[THO02] Trà hoa đậu biếc":"#80CBC4",
        "[THO06] Trà nhụy hoa nghệ tây":"#BDBDBD",
        "[THO05] Trà hoa Atiso":"#8D6E63",
        "[THO04] Trà nụ hoa hồng Tây Tạng":"#F48FB1"
      },
      TMX: {
        "[TMX01] Trà dưỡng nhan":"#C2185B",
        "[TMX03] Trà gạo lứt 8 vị":"#9C27B0",
        "[TMX02] Trà cam sả quế":"#F06292"
      },
      TTC: {
        "[TTC01] Trà gừng":"#CE93D8",
        "[TTC02] Cam lát":"#BF8F5F"
      },
      BOT: {
        "[BOT01] Bột cần tây":"#4f6f98"
      }
    };

    // Panel ALL: dùng bảng màu hợp nhất của tất cả nhóm
    if (code === "ALL") {
      return n => {
        for (const g in maps) if (maps[g][n]) return maps[g][n];
        return d3.schemeTableau10[(names.indexOf(n)) % 10];
      };
    }

    // Panel theo nhóm
    if (maps[code]) {
      const map = maps[code];
      return n => map[n] || d3.schemeTableau10[(names.indexOf(n)) % 10];
    }

    // fallback
    const scale = d3.scaleOrdinal(d3.schemeTableau10).domain(names);
    return n => scale(n);
  }

  /* ====== Legend prefixes (để giữ thứ tự cho panel nhóm) ====== */
  const LEGEND_ROWS = {
    ALL: [[ "[BOT01]" ]], // sẽ override khi vẽ ALL
    SET: [[ "[SET01]", "[SET02]", "[SET03]", "[SET04]", "[SET05]", "[SET06]", "[SET07]" ]],
    THO: [[ "[THO01]", "[THO03]", "[THO05]" ], [ "[THO02]", "[THO04]", "[THO06]" ]],
    TMX: [[ "[TMX01]", "[TMX03]" ], [ "[TMX02]" ]],
    TTC: [[ "[TTC01]" ], [ "[TTC02]" ]]
  };

  function shortLabel(str, maxLen){ if(!str) return ""; const s=String(str); return s.length>maxLen?(s.slice(0,maxLen-1)+"…"):s; }
  function pickByPrefix(names,prefix){ return names.find(n=>n.startsWith(prefix)); }

  /* ===== Legend vẽ 1 hàng + 1 cụm nút cuộn ===== */
  function drawLegendOneRow(svg, W, margin, items, fontSize=11) {
    const legendOffset = 22;
    const startY = +svg.attr("height") - margin.bottom + legendOffset;

    // đo rộng từng item
    const measurer = svg.append("g").attr("opacity", 0);
    items.forEach(it => {
      const t = measurer.append("text").attr("font-size", fontSize).text(it.label);
      const tw = t.node().getBBox().width;
      it.w = 12 + 4 + tw + 14; // rect 12 + 4 + text + padding 14
      t.remove();
    });
    measurer.remove();

    const btnArea = 34;
    const viewportW = Math.max(120, W - margin.right - margin.left - btnArea);
    const viewportX = margin.left;
    const viewportY = startY;
    const viewportH = 16;

    const totalW = items.reduce((s, it) => s + it.w, 0);
    const maxOffset = Math.max(0, totalW - viewportW);
    let offset = 0;
    const STEP = Math.round(viewportW * 0.6);

    const clipId = `clip_${Math.random().toString(36).slice(2)}`;
    svg.append("clipPath").attr("id", clipId)
      .append("rect")
      .attr("x", viewportX).attr("y", viewportY - 12)
      .attr("width", viewportW).attr("height", viewportH + 16);

    const track = svg.append("g").attr("clip-path", `url(#${clipId})`);

    let control = null;
    function render() {
      track.selectAll(".legend-row").remove();
      const g = track.append("g")
        .attr("class", "legend-row")
        .attr("transform", `translate(${viewportX - offset}, ${viewportY})`);
      let x = 0;
      items.forEach(it => {
        const itemG = g.append("g").attr("transform", `translate(${x},0)`);
        itemG.append("rect").attr("width", 12).attr("height", 12).attr("fill", it.fill);
        itemG.append("text").attr("x", 16).attr("y", 10).attr("font-size", fontSize).text(it.label);
        x += it.w;
      });
      if (control) {
        control.left.attr("opacity",  offset <= 0        ? 0.35 : 1);
        control.right.attr("opacity", offset >= maxOffset ? 0.35 : 1);
      }
    }

    if (maxOffset === 0) { render(); return; }

    const controlX = margin.left + viewportW + 4;
    const controlY = viewportY - 2;

    svg.append("rect")
      .attr("x", controlX - 2).attr("y", controlY - 2)
      .attr("width", btnArea).attr("height", 18)
      .attr("rx", 4).attr("ry", 4)
      .attr("fill", "#f3f4f6").attr("stroke", "#e5e7eb");

    const leftBtn = svg.append("g").style("cursor","pointer")
      .attr("transform", `translate(${controlX}, ${controlY})`)
      .on("click", () => { offset = Math.max(0, offset - STEP); render(); });
    leftBtn.append("rect").attr("width",14).attr("height",14).attr("fill","#fff")
      .attr("stroke","#d1d5db").attr("rx",3).attr("ry",3);
    leftBtn.append("text").attr("x",7).attr("y",10).attr("text-anchor","middle").attr("font-size",12).text("‹");

    const rightBtn = svg.append("g").style("cursor","pointer")
      .attr("transform", `translate(${controlX + 16}, ${controlY})`)
      .on("click", () => { offset = Math.min(maxOffset, offset + STEP); render(); });
    rightBtn.append("rect").attr("width",14).attr("height",14).attr("fill","#fff")
      .attr("stroke","#d1d5db").attr("rx",3).attr("ry",3);
    rightBtn.append("text").attr("x",7).attr("y",10).attr("text-anchor","middle").attr("font-size",12).text("›");

    control = { left:leftBtn, right:rightBtn };
    render();
  }

  // Legend cho panel nhóm (SET/THO/TMX/TTC): chọn theo prefix & vẽ 1 hàng
  function drawLegendRows(svg, allNames, code, W, margin, color) {
    const flatPrefixes = (LEGEND_ROWS[code] || [[]]).flat();
    const items = [];
    flatPrefixes.forEach(prefix => {
      const full = allNames.find(n => n.startsWith(prefix));
      if (!full) return;
      items.push({ full, label: shortLabel(full, code === "SET" ? 16 : 18), fill: color(full) });
    });
    if (!items.length) return;
    drawLegendOneRow(svg, W, margin, items);
  }

  /* ====== Thu thập danh sách item cho panel ALL theo THỨ TỰ mong muốn ====== */
  function allItemNamesOrdered(groupItemMonth) {
    const all = [];
    for (const [, itemMap] of groupItemMonth) {
      for (const itemName of itemMap.keys()) all.push(itemName);
    }
    const uniq = Array.from(new Set(all));

    const ORDER = [
      "[BOT01]",
      "[SET01]","[SET02]","[SET03]","[SET04]","[SET05]","[SET06]","[SET07]",
      "[THO01]","[THO02]","[THO03]","[THO04]","[THO05]","[THO06]",
      "[TMX01]","[TMX02]","[TMX03]",
      "[TTC01]","[TTC02]"
    ];

    const ordered = [];
    ORDER.forEach(pref => {
      const full = uniq.find(n => n.startsWith(pref));
      if (full) ordered.push(full);
    });
    return ordered;
  }

  /* ========== Boot ========== */
  function bootQ10(containerSel="#view") {
    const view = d3.select(containerSel).html("");

    d3.csv("./data/sales.csv").then(rows => {
      if (!rows || !rows.length) {
        view.append("div").attr("class","message").text("Không có dữ liệu.");
        return;
      }

      const groupItemMonth = new Map();
      const groupMonthTotals = new Map();

      rows.forEach(r => {
        const gCode = String(pick(r, COLS.groupCode)||"").trim();
        const gName = String(pick(r, COLS.groupName)||"").trim();
        const iCode = String(pick(r, COLS.itemCode)||"").trim();
        const iName = String(pick(r, COLS.itemName)||"").trim();
        const orderId = String(pick(r, COLS.orderId)||"").trim();
        const mNum = toMonth(pick(r, COLS.date));
        if (!gCode || !gName || !iCode || !iName || !orderId || !mNum) return;
        if (mNum < 7 || mNum > 12) return;

        const groupKey = `[${gCode}] ${gName}`;
        const itemKey  = `[${iCode}] ${iName}`;
        const monthKey = "T" + String(mNum).padStart(2,"0");

        if (!groupItemMonth.has(groupKey)) groupItemMonth.set(groupKey,new Map());
        const itemMap = groupItemMonth.get(groupKey);
        if (!itemMap.has(itemKey)) itemMap.set(itemKey,new Map());
        const monthMap = itemMap.get(itemKey);
        if (!monthMap.has(monthKey)) monthMap.set(monthKey,new Set());
        monthMap.get(monthKey).add(orderId);

        if (!groupMonthTotals.has(groupKey)) groupMonthTotals.set(groupKey,new Map());
        const gt = groupMonthTotals.get(groupKey);
        if (!gt.has(monthKey)) gt.set(monthKey,new Set());
        gt.get(monthKey).add(orderId);
      });

      // Title
      view.append("div")
        .style("background","#546d8d").style("color","#fff")
        .style("padding","10px 14px").style("border-radius","8px")
        .style("margin-bottom","14px").style("text-align","center")
        .style("font-weight","700")
        .text("Xác suất bán hàng của Mặt hàng theo Nhóm hàng trong từng Tháng");

      // Grid
      const grid = view.append("div")
        .style("display","grid")
        .style("grid-template-columns","1fr 1fr 1fr")
        .style("gap","16px");

      function makeCard(host, title) {
        const card = host.append("div")
          .style("padding","8px").style("background","#fff")
          .style("border-radius","10px").style("box-shadow","0 2px 6px rgba(0,0,0,0.08)");
        card.append("div")
          .style("margin","2px 0 8px 0").style("text-align","center")
          .style("color","#008080").style("font-weight","700").style("font-size","16px")
          .text(title);
        const id = "q10_" + title.replace(/[^a-zA-Z0-9]/g,"_");
        card.append("div").attr("id", id);
        return "#"+id;
      }

      function seriesFor(groupKey) {
        const itemMap = groupItemMonth.get(groupKey);
        const totals = groupMonthTotals.get(groupKey) || new Map();
        return Array.from(itemMap, ([itemName, monthMap]) => ({
          name: itemName,
          values: MONTHS.map(m => {
            const num = (monthMap.get(m) || new Set()).size;
            const den = (totals.get(m) || new Set()).size || 1;
            return { month:m, probability:num/den, num, den };
          })
        }));
      }

      function panelFor(code, host) {
        const groupKey = Array.from(groupItemMonth.keys()).find(k => k.startsWith(`[${code}]`));
        if (!groupKey) return;
        const chartId = makeCard(host, groupKey);
        drawLineChart(seriesFor(groupKey), chartId, code, groupKey, null);
      }

      function panelAll(host) {
        const botGroupKey = Array.from(groupItemMonth.keys()).find(k => k.startsWith("[BOT]"));
        if (!botGroupKey) return;
        const chartId = makeCard(host, "All");

        // LEGEND cho ALL: toàn bộ item theo THỨ TỰ mong muốn
        const legendNames = allItemNamesOrdered(groupItemMonth);

        // Dữ liệu đường vẽ vẫn dùng nhóm BOT (như cũ)
        drawLineChart(seriesFor(botGroupKey), chartId, "ALL", botGroupKey, legendNames);
      }

      POSITIONS.forEach(pos => {
        const cell = grid.append("div").style("grid-column", String(pos.col)).style("grid-row", String(pos.row));
        if (pos.code === "ALL") panelAll(cell); else panelFor(pos.code, cell);
      });
      grid.append("div").style("grid-column","3").style("grid-row","2");
    });
  }

  /* ========== Draw line chart ========== */
  function drawLineChart(data, chartSel, code, groupTitle, legendOverrideNames /* optional */) {
    d3.select(chartSel).selectAll("*").remove();

    const host = d3.select(chartSel).node();
    const hostW = Math.max(320, Math.floor(host.getBoundingClientRect().width));

    // Legend 1 hàng
    const baseBottom = 30;
    const legendSpace = 18 + 26;
    const margin = { top:12, right:10, bottom:baseBottom + legendSpace, left:56 };

    const W = hostW - 2, H = 240;

    const svg = d3.select(chartSel).append("svg").attr("width", W).attr("height", H);

    const cap = Y_CAP[code]; const yMin = cap?cap[0]:0; const yMax = cap?cap[1]:1;

    const x = d3.scalePoint().domain(MONTHS).range([margin.left, W - margin.right]);
    const y = d3.scaleLinear().domain([yMin, yMax]).range([H - margin.bottom, margin.top]).clamp(true);

    // vertical grid
    const plotHeight = H - margin.top - margin.bottom;
    svg.append("g").attr("class","x-grid").attr("transform",`translate(0,${H-margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(-plotHeight).tickFormat("")).selectAll("line").attr("stroke","#e6e6e6");
    svg.select(".x-grid .domain").remove();

    // axes
    svg.append("g").attr("transform",`translate(0,${H-margin.bottom})`).call(d3.axisBottom(x));
    let axisLeft = d3.axisLeft(y).tickFormat(d => `${(d*100).toFixed(0)}%`);
    const want = TICKS[code]; if (want) axisLeft = axisLeft.tickValues(want);
    svg.append("g").attr("transform",`translate(${margin.left},0)`).call(axisLeft);

    const names = data.map(d=>d.name);
    const legendNames = legendOverrideNames && legendOverrideNames.length ? legendOverrideNames : names;
    const color = colorFnForGroup(code, legendNames);

    const line = d3.line().x(d=>x(d.month)).y(d=>y(Math.max(yMin, Math.min(yMax, d.probability)))).curve(d3.curveLinear);

    svg.selectAll(".series").data(data).enter().append("path")
      .attr("fill","none").attr("stroke-width",2).attr("stroke",d=>color(d.name))
      .attr("d", d=>line(d.values));

    // tooltip
    let tip = d3.select("body").select("#q10-tooltip");
    if (tip.empty()) {
      tip = d3.select("body").append("div").attr("id","q10-tooltip")
        .style("position","absolute").style("pointer-events","none")
        .style("background","#fff").style("border","1px solid #ddd")
        .style("border-radius","6px").style("box-shadow","0 2px 8px rgba(0,0,0,0.15)")
        .style("padding","8px 10px").style("font-size","12px").style("color","#333")
        .style("opacity",0);
    }
    const fmtPct = d3.format(".1%"); const fmtInt = d3.format(",");

    const pts = data.flatMap(d => d.values.map(v => ({ name:d.name, ...v })));
    svg.selectAll(".dot").data(pts).enter().append("circle")
      .attr("r",3.5).attr("fill",d=>color(d.name))
      .attr("cx",d=>x(d.month)).attr("cy",d=>y(Math.max(yMin, Math.min(yMax, d.probability))))
      .on("mouseenter", () => tip.style("opacity",1))
      .on("mousemove", (event,d) => {
        tip.html(
          `<div><strong>${d.month} | Mặt hàng ${d.name}</strong></div>`+
          `<div>Nhóm hàng: ${groupTitle||""}</div>`+
          `<div>SL Đơn Bán: ${fmtInt(d.num||0)}</div>`+
          `<div>Xác suất Bán / Nhóm hàng: ${fmtPct(d.probability||0)}</div>`
        ).style("left",(event.pageX+12)+"px").style("top",(event.pageY+12)+"px");
      })
      .on("mouseleave", () => tip.style("opacity",0));

    // Legend
    if (legendOverrideNames && legendOverrideNames.length) {
      const items = legendOverrideNames.map(n => ({
        full: n, label: shortLabel(n, 18), fill: color(n)
      }));
      drawLegendOneRow(svg, W, margin, items);
    } else {
      drawLegendRows(svg, names, code, W, margin, color);
    }
  }

  // expose
  window.bootQ10 = bootQ10;
})();
