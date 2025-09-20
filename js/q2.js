// js/q2.js
(function () {
  /* ========= PALETTE & CANONICAL ========= */
  const GROUP_COLORS = {
    "[BOT] Bột": "#4f6f98",
    "[SET] Set trà": "#d98453",
    "[THO] Trà hoa": "#cf6b5b",
    "[TMX] Trà mix": "#84c5bf",
    "[TTC] Trà củ, quả sấy": "#7ab874",
  };
  const CANONICAL = new Map([
    ["BOT","[BOT] Bột"],["Bột","[BOT] Bột"],["[BOT] Bột","[BOT] Bột"],
    ["SET","[SET] Set trà"],["Set trà","[SET] Set trà"],["Set tra","[SET] Set trà"],["[SET] Set trà","[SET] Set trà"],
    ["THO","[THO] Trà hoa"],["Trà hoa","[THO] Trà hoa"],["[THO] Trà hoa","[THO] Trà hoa"],
    ["TMX","[TMX] Trà mix"],["Trà mix","[TMX] Trà mix"],["[TMX] Trà mix","[TMX] Trà mix"],
    ["TTC","[TTC] Trà củ, quả sấy"],["Trà củ, quả sấy","[TTC] Trà củ, quả sấy"],["[TTC] Trà củ, quả sấy","[TTC] Trà củ, quả sấy"]
  ]);
  const normalizeGroup = g => {
    const s=(g||"").trim();
    if (CANONICAL.has(s)) return CANONICAL.get(s);
    const m=s.match(/\[?([A-Z]{3})\]?/);
    if (m && CANONICAL.has(m[1])) return CANONICAL.get(m[1]);
    for (const k of CANONICAL.keys())
      if (s.toLowerCase()===k.toLowerCase()) return CANONICAL.get(k);
    return s;
  };
  const colorFor = g => GROUP_COLORS[normalizeGroup(g)] || "#6b7280";

  /* ========= Utils ========= */
  const tip      = d3.select("body").append("div").attr("class","tooltip");
  const fmtMoney = v => `${d3.format(",.0f")(v/1e6)} triệu VND`;
  const fmtInt   = v => d3.format(",")(Math.round(v||0));
  const num      = x => (+String(x ?? "").replace(/[^\d.-]/g, "")) || 0;

  // Chuẩn hoá tiêu đề cột: bỏ BOM, bỏ dấu, lower, bỏ ký tự lạ
  const stripBOM = s => String(s||"").replace(/^\uFEFF/, "");
  const slug = s => stripBOM(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");

  // Tìm cột "SL" một cách cứng trước, sau đó mới dò theo từ khoá
  function detectQtyColumn(headers) {
    // map slug -> original
    const map = {};
    headers.forEach(h => { map[slug(h)] = h; });

    // ƯU TIÊN: đúng "sl" (kể cả có BOM/khoảng trắng ẩn)
    for (const h of headers) {
      const s = slug(h);
      if (s === "sl") return h; // trả về tên cột gốc
    }

    // fallback: dò theo các từ khoá liên quan số lượng
    const candidates = [
      "soluong","soluongban","qty","quantity","slsanpham","sosp","sochiet"
    ];
    for (const key of candidates) {
      for (const s in map) {
        if (s === key || s.includes(key)) return map[s];
      }
    }
    return null;
  }

  /* ========= Boot Q2 ========= */
  function bootQ2(containerSel = "#view") {
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class","card").text("Đang tải Q2…");

    d3.csv("./data/sales.csv").then(raw => {
      if (!raw || !raw.length) throw new Error("CSV rỗng");

      const headers = Object.keys(raw[0] || {});
      const qtyCol  = detectQtyColumn(headers);

      console.log("[Q2] Headers:", headers);
      if (qtyCol) {
        console.log("[Q2] Dùng cột số lượng:", JSON.stringify(qtyCol));
        // in thử 5 giá trị đầu xem parse ra gì
        console.log("[Q2] Mẫu giá trị SL:", raw.slice(0,5).map(r => r[qtyCol]));
      } else {
        console.warn("[Q2] KHÔNG tìm thấy cột số lượng (SL). Tooltip sẽ là 0.");
      }

      const data = raw.map(row => {
        const group_name = normalizeGroup(row["Tên nhóm hàng"] || row["Nhom hang"] || row["Group"] || "");
        const sales = num(row["Thành tiền"] || row["Thanh tien"] || row["Sales"]);
        const qty   = qtyCol ? num(row[qtyCol]) : 0;
        return { group_name, sales, qty };
      }).filter(d => d.group_name);

      // Tổng hợp theo nhóm
      const rows = d3.rollups(
        data,
        v => ({ sales: d3.sum(v, d => d.sales), qty: d3.sum(v, d => d.qty) }),
        d => d.group_name
      )
      .map(([group_name, o]) => ({ group_name, sales: o.sales, qty: o.qty }))
      .sort((a,b) => d3.descending(a.sales, b.sales));

      drawQ2(rows, containerSel, !qtyCol);
    })
    .catch(err => {
      d3.select(containerSel).html(`<div class="card error">Không thể vẽ Q2: ${err.message}</div>`);
      console.error(err);
    });
  }

  /* ========= Draw Q2 ========= */
  function drawQ2(rows, containerSel = "#view", warnNoQty = false) {
    const root = d3.select(containerSel).html("");

    root.append("h2").attr("class","chart-title")
      .text("Doanh số bán hàng theo Nhóm hàng");

    if (warnNoQty) {
      root.append("div")
        .attr("class","card")
        .style("border","1px solid #fde68a")
        .style("background","#fffbeb")
        .style("color","#92400e")
        .style("padding","8px")
        .style("border-radius","8px")
        .text("Không tìm thấy cột số lượng (SL). Tooltip dòng 'Số lượng bán' sẽ = 0. Kiểm tra lại tiêu đề cột trong CSV.");
    }

    const card = root.append("div").attr("class","card");

    const W = 1200;
    const H = Math.max(420, rows.length * 48 + 110);
    const M = { t: 16, r: 36, b: 46, l: 200 };
    const w = W - M.l - M.r;
    const h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g   = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    // Scale
    const y = d3.scaleBand().domain(rows.map(d => d.group_name)).range([0,h]).padding(0.22);
    const step  = 100e6;           // 100M
    const xMax  = 2000e6;          // 2000M
    const x     = d3.scaleLinear().domain([0, xMax]).range([0, w]);
    const ticks = d3.range(0, xMax + step, step);
    const tickFmt = v => (v === 0 ? "0M" : (v/1e6)+"M");

    // Axes (bỏ tick mark ngắn)
    g.append("g").attr("class","axis").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(tickFmt).tickSize(0).tickPadding(8));
    g.append("g").attr("class","axis")
      .call(d3.axisLeft(y).tickSize(0).tickPadding(6));

    // Grid dọc
    g.append("g").attr("class","gridline").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickSize(-h).tickFormat(""))
      .select(".domain").remove();

    // Bars
    g.selectAll("rect.q2-bar")
      .data(rows)
      .join("rect")
      .attr("class","q2-bar")
      .attr("x",0)
      .attr("y",d=>y(d.group_name))
      .attr("width",d=>x(Math.min(d.sales, xMax)))
      .attr("height",y.bandwidth())
      .attr("fill",d=>colorFor(d.group_name))
      .on("mousemove",(ev,d)=>{
        tip.style("left",(ev.clientX+12)+"px")
           .style("top",(ev.clientY-12)+"px")
           .style("opacity",1)
           .html(`
             <div class="tt-row first"><div class="tt-key">Nhóm hàng:</div><div class="tt-val">${d.group_name}</div></div>
             <div class="tt-row"><div class="tt-key">Doanh số bán:</div><div class="tt-val">${fmtMoney(d.sales)}</div></div>
             <div class="tt-row"><div class="tt-key">Số lượng bán:</div><div class="tt-val">${fmtInt(d.qty)} SKUs</div></div>
           `);
      })
      .on("mouseleave",()=>tip.style("opacity",0));

    // Data labels ngoài cột
    g.selectAll("text.q2-label")
      .data(rows)
      .join("text")
      .attr("class","label label-outside")
      .attr("x", d => x(Math.min(d.sales, xMax)) + 6)
      .attr("y", d => y(d.group_name) + y.bandwidth()/2 + 4)
      .style("font-size","10px")
      .style("font-weight","normal")
      .text(d => fmtMoney(d.sales));
  }

  window.bootQ2 = bootQ2;
})();
