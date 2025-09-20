// js/q5.js
(function () {
  // ---------- Tooltip & format ----------
  const tip = d3.select("body").append("div").attr("class", "tooltip");
  const fmtMil1 = d3.format(".1f");      // 12.6
  const fmtInt  = d3.format(",");        // 1,234

  // Nhãn ngày 01..31
  const DAY_LABEL = d => "Ngày " + String(d).padStart(2, "0");

  // Bảng màu dịu mắt (31 màu lặp)
  // Thay thế mảng COLORS hiện tại bằng mảng dưới:
const COLORS = [
  "#5b74a3", // steel blue
  "#c9e3f6", // light blue
  "#e18a2b", // orange
  "#f2c39a", // peach
  "#93b96b", // green
  "#b9e1a5", // light green
  "#bfa34a", // mustard
  "#f2d37a", // gold
  "#6d7a8b", // blue gray
  "#69aeb0", // sea green
  "#cf6b79", // coral
  "#f29aa0", // salmon
  "#6f6a6d", // gray
  "#d3c7bb", // beige
  "#bfb1a7", // taupe
  "#b8788f", // rose
  "#f4c4cf", // pink
  "#b08aa9", // mauve
  "#d7c0e6", // lavender
  "#8c6b4f", // brown
  "#d9b89c", // tan
  "#7699c7", // dusty blue
  "#b2d0e8", // sky blue
  "#d6882e", // orange 2
  "#efbf8a", // peach 2
  "#6fa65a", // green 2
  "#b5df9a", // mint
  "#e2c86a", // gold 2
  "#6aa2a0", // teal 2
  "#a8cfd0", // light teal 2
  "#d96868"  // red
];

// Hàm lấy màu giữ nguyên:
const colorFor = i => COLORS[i % COLORS.length];


  // ---------- Boot ----------
  function bootQ5(containerSel = "#view") {
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class", "card").text("Đang tải Q5…");

    d3.csv("./data/sales.csv", row => {
      const dateStr =
        row["Thời gian tạo đơn"] || row["Thoi gian tao don"] ||
        row["Ngay tao don"]      || row["Date"]              || "";
      const dt = dateStr ? new Date(dateStr) : null;

      return {
        dateKey: dt ? dt.toISOString().slice(0, 10) : null, // YYYY-MM-DD
        dom    : dt ? dt.getDate() : null,                  // 1..31
        sales  : +row["Thành tiền"] || +row["Thanh tien"] || +row["Sales"] || 0,
        qty    : +row["SL"] || +row["So luong"] || +row["Qty"] || 0
      };
    })
    .then(raw => {
      // 1) Tổng theo từng ngày thực tế (mỗi YYYY-MM-DD)
      const dailyTotals = d3.rollups(
        raw.filter(d => d.dateKey && d.dom != null),
        v => ({
          sales: d3.sum(v, d => d.sales),
          qty  : d3.sum(v, d => d.qty),
          dom  : v[0].dom
        }),
        d => d.dateKey
      ).map(([dateKey, o]) => ({ dateKey, dom: o.dom, sales: o.sales, qty: o.qty }));

      // 2) Lấy trung bình theo "ngày trong tháng" (1..31)
      const rows = d3.rollups(
        dailyTotals,
        v => ({
          sales: d3.mean(v, d => d.sales),
          qty  : d3.mean(v, d => d.qty)
        }),
        d => d.dom
      )
      .map(([dom, o]) => ({
        dom,
        dayLabel: DAY_LABEL(dom),
        sales: o.sales || 0,
        qty  : o.qty   || 0
      }))
      .sort((a, b) => a.dom - b.dom);

      drawQ5(rows, containerSel);
    })
    .catch(err => {
      d3.select(containerSel).html(
        `<div class="card error">Không thể vẽ Q5: ${err.message}</div>`
      );
    });
  }

  // ---------- Draw ----------
  function drawQ5(rows, containerSel = "#view") {
    const root = d3.select(containerSel).html("");

    root.append("h2")
      .attr("class", "chart-title")
      .text("Doanh số bán hàng trung bình theo Ngày trong tháng");

    const card = root.append("div").attr("class", "card");

    const W = 1400, H = 580;
    const M = { t: 30, r: 20, b: 120, l: 20 };  // l:20 để ẩn Y nhưng vẫn có padding trái
    const w = W - M.l - M.r;
    const h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    // Scales
    const x = d3.scaleBand()
      .domain(rows.map(d => d.dayLabel))
      .range([0, w])
      .padding(0.15);

    const yMax = Math.ceil((d3.max(rows, d => d.sales) || 1) / 1e6) * 1e6;
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // --- Trục X (xoay 90°, chữ dọc) ---
    const xAxis = g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0));
    xAxis.select(".domain").remove();

    xAxis.selectAll("text")
      .attr("transform", "rotate(-90)")
      .style("text-anchor", "end")
      .attr("dx", "-0.6em")
      .attr("dy", "-0.35em")
      .style("font-size", "11px");

    // --- Ẩn hoàn toàn trục Y ---
    // (Không append y-axis)

    // --- Cột ---
    const bars = g.selectAll("rect.q5-bar")
      .data(rows)
      .join("rect")
      .attr("class", "q5-bar")
      .attr("x", d => x(d.dayLabel))
      .attr("y", d => y(d.sales))
      .attr("width", x.bandwidth())
      .attr("height", d => h - y(d.sales))
      .attr("fill", (d, i) => colorFor(i))
      .on("mousemove", (ev, d) => {
        tip.style("left", (ev.clientX + 12) + "px")
           .style("top",  (ev.clientY - 12) + "px")
           .style("opacity", 1)
           .html(`
             <div class="tt-title"><b>${d.dayLabel}</b></div>
             <div class="tt-row">
               <span class="tt-key">Doanh số bán TB:</span>
               <span class="tt-val">${fmtMil1(d.sales/1e6)} triệu VND</span>
             </div>
             <div class="tt-row">
               <span class="tt-key">Số lượng bán TB:</span>
               <span class="tt-val">${fmtInt(Math.round(d.qty || 0))} SKUs</span>
             </div>
           `);
      })
      .on("mouseleave", () => tip.style("opacity", 0));

    // --- Data labels (nhỏ, không in đậm): 12.6tr ---
    g.selectAll("text.q5-label")
      .data(rows)
      .join("text")
      .attr("class", "q5-label")
      .attr("x", d => x(d.dayLabel) + x.bandwidth() / 2)
      .attr("y", d => y(d.sales) - 6)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("font-weight", "400")
      .style("fill", "#111")
      .text(d => `${fmtMil1(d.sales/1e6)}tr`);
  }

  // export
  window.bootQ5 = bootQ5;
})();
