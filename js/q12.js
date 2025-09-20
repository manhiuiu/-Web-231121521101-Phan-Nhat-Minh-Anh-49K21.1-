// js/q12.js
(function () {
  /* ---------- Tooltip & helpers ---------- */
  const tip = d3.select("body").append("div").attr("class", "tooltip");
  const fmtInt = d3.format(",");

  const toVND = v => Number(v).toLocaleString("vi-VN");

  // cột khả dĩ trong dữ liệu
  const CUST_KEYS = [
    "Mã KH","Ma KH","Mã khách hàng","Ma khach hang","CustomerID","Customer Id",
    "KH","Khach hang","Mã khách","Ma khach"
  ];
  const AMT_KEYS = [
    "Doanh thu","Doanh thu (đ)","Doanh thu (VND)","Thành tiền","Thanh tien",
    "Tổng tiền","Tong tien","Amount","Revenue","Net","Subtotal","Tổng cộng","Tong cong"
  ];
  const getFirstKey = (row, cands) =>
    cands.find(k => Object.prototype.hasOwnProperty.call(row, k)) || null;

  /* ---------- Boot ---------- */
  function bootQ12(containerSel = "#view") {
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class", "card").text("Đang tải Q12…");

    d3.csv("./data/sales.csv").then(rows => {
      if (!rows.length) throw new Error("Không thấy dữ liệu.");

      const sample = rows[0];
      const custKey = getFirstKey(sample, CUST_KEYS);
      const amtKey  = getFirstKey(sample, AMT_KEYS);
      if (!custKey) throw new Error("Không nhận diện được cột Mã KH.");
      if (!amtKey)  throw new Error("Không nhận diện được cột Số tiền/Doanh thu.");

      // Tổng chi tiêu theo KH
      const spend = new Map();
      for (const r of rows) {
        const id = String(r[custKey] || "").trim();
        if (!id) continue;
        let v = +String(r[amtKey]).replace(/[^\d.-]/g, "");
        if (!isFinite(v)) v = 0;
        spend.set(id, (spend.get(id) || 0) + v);
      }
      const totals = Array.from(spend.values()).filter(v => v > 0);
      if (!totals.length) throw new Error("Không có bản ghi chi tiêu hợp lệ.");

      drawQ12(totals, containerSel);
    }).catch(err => {
      d3.select(containerSel).html(
        `<div class="card error">Không thể vẽ Q12: ${err.message}</div>`
      );
    });
  }

  /* ---------- Draw ---------- */
  function drawQ12(totals, containerSel = "#view") {
    const root = d3.select(containerSel).html("");
    root.append("h2")
      .attr("class","chart-title")
      .text("Phân phối Mức chi trả của Khách hàng");

    const card = root.append("div").attr("class","card");
    const W = 1200, H = 540;
    const M = { t: 28, r: 20, b: 110, l: 80 };
    const w = W - M.l - M.r, h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g   = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    // ----- bins 50.000 -----
    const BIN_SIZE = 50_000;
    const maxVal = d3.max(totals);
    const maxUp  = Math.ceil(maxVal / BIN_SIZE) * BIN_SIZE;

    const thresholds = d3.range(0, maxUp + BIN_SIZE, BIN_SIZE);
    const binner = d3.bin().domain([0, maxUp]).thresholds(thresholds);
    const bins = binner(totals);

    // ----- scales -----
    const x = d3.scaleLinear().domain([0, maxUp]).range([0, w]);
    const y = d3.scaleLinear().domain([0, 1600]).range([h, 0]); // 0 → 1600

    // ----- GRID ngang theo Y -----
    g.append("g")
      .attr("class", "gridline")
      .call(
        d3.axisLeft(y)
          .tickValues(d3.range(0, 1600 + 1, 100))
          .tickSize(-w)
          .tickFormat("")
      )
      .select(".domain").remove();

    // ----- AXIS Y (font 10px) -----
    const yAxis = g.append("g")
      .attr("class", "axis")
      .call(
        d3.axisLeft(y)
          .tickValues(d3.range(0, 1600 + 1, 100))
          .tickFormat(d3.format(","))
          .tickSize(0)
      );
    yAxis.select(".domain").remove();
    yAxis.selectAll("text").style("font-size","10px");

    // Nhãn trục Y (ở giữa)
    g.append("text")
      .attr("transform","rotate(-90)")
      .attr("x", -h/2)
      .attr("y", -46)
      .attr("text-anchor","middle")
      .attr("fill","#555")
      .style("font-size","9px")
      .text("Số Khách hàng");

    // ----- AXIS X: 0K, 50K, 100K, … (xoay -90°, font 10px) -----
    const xTicks = d3.range(0, maxUp + 1, 50_000);
    const xAxis = g.append("g")
      .attr("class","axis")
      .attr("transform", `translate(0,${h})`)
      .call(
        d3.axisBottom(x)
          .tickValues(xTicks)
          .tickFormat(d => (d/1000) + "K")
          .tickSize(0)
      );
    xAxis.select(".domain").remove();
    xAxis.selectAll("text")
      .attr("transform", "rotate(-90)")
      .style("text-anchor", "end")
      .attr("dx", "-0.6em")
      .attr("dy", "0.2em")
      .style("font-size","9px");

    // ----- BARS + tooltip -----
    g.selectAll("rect.bin")
      .data(bins)
      .join("rect")
      .attr("class","bin")
      .attr("x", d => x(d.x0))
      .attr("y", d => y(Math.min(d.length, 1600))) // clamp nếu vượt trần
      .attr("width", d => Math.max(1, x(d.x1) - x(d.x0) - 3))
      .attr("height", d => h - y(Math.min(d.length, 1600)))
      .attr("fill", "#4f6f98")
      .on("mousemove", (ev, d) => {
        tip.style("left", (ev.clientX + 10) + "px")
           .style("top",  (ev.clientY - 10) + "px")
           .style("opacity", 1)
           .html(`
             <div class="tt-title"><b>Từ ${toVND(d.x0)} đến ${toVND(d.x1)} VND</b></div>
             <div class="tt-row"><span class="tt-key">Số lượng KH:</span>
               <span class="tt-val">${fmtInt(d.length)}</span></div>
           `);
      })
      .on("mouseleave", () => tip.style("opacity", 0));
  }

  // expose
  window.bootQ12 = bootQ12;
})();
