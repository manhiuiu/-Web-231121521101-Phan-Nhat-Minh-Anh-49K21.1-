// js/q4.js
(function () {
  // ===== Tooltip & formatter =====
  const tip = d3.select("body").append("div").attr("class", "tooltip");
  const fmtFull = d3.format(",.0f"); // 12,422,288
  const fmtInt  = d3.format(",");    // 240 (có dấu phẩy)

  // Thứ tự hiển thị: Thứ Hai → CN
  // JS getDay(): 0=CN, 1=Hai, ... 6=Bảy
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DOW_LABEL = {
    1: "Thứ Hai",
    2: "Thứ Ba",
    3: "Thứ Tư",
    4: "Thứ Năm",
    5: "Thứ Sáu",
    6: "Thứ Bảy",
    0: "Chủ Nhật",
  };

  // Màu cho 7 cột (đồng bộ tông Q3)
  const COLORS = [
    "#4f6f98", // Mon
    "#d98453", // Tue
    "#cf6b5b", // Wed
    "#84c5bf", // Thu
    "#7ab874", // Fri
    "#e0c55f", // Sat
    "#9b6b9b", // Sun
  ];
  const colorForDow = (dow) => COLORS[DOW_ORDER.indexOf(dow)];

  function bootQ4(containerSel = "#view") {
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class", "card").text("Đang tải Q4…");

    d3.csv("./data/sales.csv", (row) => {
      const dateStr =
        row["Thời gian tạo đơn"] ||
        row["Ngay tao don"] ||
        row["Date"] ||
        "";
      const dt = dateStr ? new Date(dateStr) : null;

      return {
        dateKey: dt ? dt.toISOString().slice(0, 10) : null, // YYYY-MM-DD
        dow: dt ? dt.getDay() : null,                        // 0..6
        sales: +row["Thành tiền"] || +row["Thanh tien"] || +row["Sales"] || 0,
        qty: +row["SL"] || +row["So luong"] || +row["Qty"] || 0,
      };
    })
      .then((rowsRaw) => {
        // 1) Cộng theo từng ngày (để mỗi ngày có tổng sales/qty)
        const byDate = d3
          .rollups(
            rowsRaw.filter((d) => d.dateKey && d.dow != null),
            (v) => ({
              sales: d3.sum(v, (d) => d.sales),
              qty: d3.sum(v, (d) => d.qty),
              dow: v[0].dow,
            }),
            (d) => d.dateKey
          )
          .map(([dateKey, o]) => ({
            dateKey,
            dow: o.dow,
            sales: o.sales,
            qty: o.qty,
          }));

        // 2) Lấy TRUNG BÌNH theo thứ trong tuần
        const rows = d3
          .rollups(
            byDate,
            (v) => ({
              sales: d3.mean(v, (d) => +d.sales),
              qty: d3.mean(v, (d) => +d.qty),
            }),
            (d) => d.dow
          )
          .map(([dow, o]) => ({
            dow,
            label: DOW_LABEL[dow],
            sales: o.sales,
            qty: o.qty,
          }))
          .sort(
            (a, b) => DOW_ORDER.indexOf(a.dow) - DOW_ORDER.indexOf(b.dow)
          );

        drawQ4(rows, containerSel);
      })
      .catch((err) => {
        d3.select(containerSel).html(
          `<div class="card error">Không thể vẽ Q4: ${err.message}</div>`
        );
      });
  }

  function drawQ4(rows, containerSel = "#view") {
    const root = d3.select(containerSel).html("");

    root
      .append("h2")
      .attr("class", "chart-title")
      .text("Doanh số bán hàng trung bình theo Ngày trong tuần");

    const card = root.append("div").attr("class", "card");

    const W = 1200,
      H = 520;
    const M = { t: 20, r: 30, b: 60, l: 100 };
    const w = W - M.l - M.r;
    const h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    // Scales
    const x = d3
      .scaleBand()
      .domain(rows.map((d) => d.label))
      .range([0, w])
      .padding(0.2);

    const yMax = 15e6; // cố định 15 triệu
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // Axes (bỏ baseline & tick-marks)
    const fmtY = (v) => (v === 0 ? "0M" : v / 1e6 + "M");

    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain")
      .remove();

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(15).tickFormat(fmtY).tickSize(0))
      .select(".domain")
      .remove();

    // Nhãn trục Y
    g.append("text")
      .attr("class", "y-label")
      .attr("x", -h / 2)
      .attr("y", -70)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .style("fill", "#444")
      .text("Avg. [Fixed] Doanh số Theo Ngày");

    // Grid ngang
    const yTicks = y.ticks(15);
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

    // Bars
    g.selectAll("rect.q4-bar")
      .data(rows)
      .join("rect")
      .attr("class", "q4-bar")
      .attr("x", (d) => x(d.label))
      .attr("y", (d) => y(d.sales))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - y(d.sales))
      .attr("fill", (d) => colorForDow(d.dow))
      .on("mousemove", (ev, d) => {
  tip
    .style("left", ev.clientX + 12 + "px")
    .style("top", ev.clientY - 12 + "px")
    .style("opacity", 1)
    .html(`
      <div class="tt-title"><b>Ngày ${d.label}</b></div>
      <div class="tt-row">
        <span class="tt-key">Doanh số bán TB:</span>
        <span class="tt-val">${fmtFull(d.sales)} VND</span>
      </div>
      <div class="tt-row">
        <span class="tt-key">Số lượng bán TB:</span>
        <span class="tt-val">${fmtInt(Math.round(d.qty))} SKUs</span>
      </div>
    `);
})

      .on("mouseleave", () => tip.style("opacity", 0));

    // Data labels (không làm tròn)
    g.selectAll("text.q4-label")
      .data(rows)
      .join("text")
      .attr("class", "label-top")
      .attr("x", (d) => x(d.label) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.sales) - 8)
      .style("font-size","12px")
  .style("font-weight","normal")
      .text((d) => fmtFull(d.sales) + " VND");
  }

  // export
  window.bootQ4 = bootQ4;
})();
