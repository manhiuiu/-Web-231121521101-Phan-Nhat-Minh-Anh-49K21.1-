// js/q6.js
(function () {
  const tip = d3.select("body").append("div").attr("class", "tooltip");

  const fmtFull = d3.format(",.0f");  // ví dụ 877,765
  const fmtInt  = d3.format(",");     // ví dụ 6,025
  const fmtY    = v => (v === 0 ? "0K" : (v / 1000) + "K"); // tick Y (giữ K cho trục)

  // Màu (giống Q5)
  const COLORS = [
    "#5b74a3","#9ec1e6","#e18a2b","#f2c39a",
    "#6da86d","#b9e1a5","#bfa34a","#f2d37a",
    "#6d8b85","#8ec1c2","#cf6b79","#f29aa0",
    "#6f6a6d","#bfb1a7","#b8788f","#f4c4cf"
  ];
  const colorFor = i => COLORS[i % COLORS.length];

  function bootQ6(containerSel = "#view") {
    const view = d3.select(containerSel).html("");
    view.append("div").attr("class", "card").text("Đang tải Q6…");

    d3.csv("./data/sales.csv", row => {
      const dateStr = row["Thời gian tạo đơn"] || row["Date"] || "";
      const dt = dateStr ? new Date(dateStr) : null;
      const hour = dt ? dt.getHours() : null;

      return {
        dateKey: dt ? dt.toISOString().slice(0,10) : null, // YYYY-MM-DD
        hour,
        sales: +row["Thành tiền"] || +row["Sales"] || 0,
        qty  : +row["SL"]          || +row["Qty"]   || 0,
      };
    }).then(raw => {
      // 1) Tổng theo NGÀY + GIỜ
      const byDateHour = d3.rollups(
        raw.filter(d => d.dateKey && d.hour != null && d.hour >= 8 && d.hour <= 23),
        v => ({
          sales: d3.sum(v, d => d.sales),
          qty  : d3.sum(v, d => d.qty),
          hour : v[0].hour
        }),
        d => d.dateKey + "|" + d.hour
      ).map(([key, o]) => ({
        dateKey: key.split("|")[0],
        hour   : +key.split("|")[1],
        sales  : o.sales,
        qty    : o.qty
      }));

      // 2) Gộp theo GIỜ:
      //    - Doanh số: TRUNG BÌNH theo ngày
      //    - Số lượng: TỔNG toàn giai đoạn (để ra con số lớn đúng mong muốn)
      const rows = d3.rollups(
        byDateHour,
        v => ({
          sales: d3.mean(v, d => d.sales), // TB/ngày
          qty  : d3.sum(v,  d => d.qty)    // TỔNG toàn giai đoạn
        }),
        d => d.hour
      )
      .map(([h, o]) => ({
        hour : h,
        label: `${String(h).padStart(2,"0")}:00-${String(h).padStart(2,"0")}:59`,
        sales: o.sales,
        qty  : o.qty
      }))
      .sort((a,b) => a.hour - b.hour);

      drawQ6(rows, containerSel);
    }).catch(err => {
      d3.select(containerSel).html(
        `<div class="card error">Không thể vẽ Q6: ${err.message}</div>`
      );
    });
  }

  function drawQ6(rows, containerSel="#view") {
    const root = d3.select(containerSel).html("");
    root.append("h2").attr("class","chart-title")
      .text("Doanh số bán hàng trung bình theo Khung giờ");

    const card = root.append("div").attr("class","card");

    const W = 1200, H = 520, M = { t:20, r:30, b:60, l:100 };
    const w = W - M.l - M.r, h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    const x = d3.scaleBand()
      .domain(rows.map(d => d.label))
      .range([0, w]).padding(0.2);

    const yMax = Math.ceil((d3.max(rows, d => d.sales) || 1) / 100000) * 100000;
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // --- Axes (CHỮ NHỎ LẠI) ---
    const xAxis = g.append("g")
      .attr("class","axis")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSize(0));
    xAxis.select(".domain").remove();
    xAxis.selectAll("text").style("font-size","10px"); // nhỏ lại

    const yAxis = g.append("g")
      .attr("class","axis")
      .call(d3.axisLeft(y).ticks(10).tickFormat(fmtY).tickSize(0));
    yAxis.select(".domain").remove();
    yAxis.selectAll("text").style("font-size","10px"); // nhỏ lại

    // Nhãn trục Y
    g.append("text")
      .attr("class","y-label")
      .attr("x", -h/2)
      .attr("y", -70)
      .attr("transform","rotate(-90)")
      .attr("text-anchor","middle")
      .style("font-size","10px")
      .style("fill","#444")
      .text("Avg. [Fixed] Doanh số Theo Ngày-Giờ");

    // Grid
    const yTicks = y.ticks(10);
    g.append("g").attr("class","gridline")
      .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-w).tickFormat(""))
      .select(".domain").remove();

    // Bars + tooltip
    g.selectAll("rect.q6-bar")
      .data(rows)
      .join("rect")
      .attr("class","q6-bar")
      .attr("x", d => x(d.label))
      .attr("y", d => y(d.sales))
      .attr("width", x.bandwidth())
      .attr("height", d => h - y(d.sales))
      .attr("fill", (d,i) => colorFor(i))
      .on("mousemove", (ev, d) => {
        tip.style("left", (ev.clientX + 12) + "px")
           .style("top",  (ev.clientY - 12) + "px")
           .style("opacity", 1)
           .html(`
             <div class="tt-title"><b>Khung giờ: ${d.label}</b></div>
             <div class="tt-row">
               <span class="tt-key">Doanh số bán TB:</span>
               <span class="tt-val">${fmtFull(d.sales)} VND</span>
             </div>
             <div class="tt-row">
               <span class="tt-key">Số lượng bán TB:</span>
               <span class="tt-val">${fmtInt(d.qty)} SKUs</span>
             </div>
           `);
      })
      .on("mouseleave", () => tip.style("opacity", 0));

    // Data label TRÊN CỘT: KHÔNG “K” & KHÔNG LÀM TRÒN
    g.selectAll("text.q6-label")
      .data(rows)
      .join("text")
      .attr("class","label-top")
      .attr("x", d => x(d.label) + x.bandwidth() / 2)
      .attr("y", d => y(d.sales) - 8)
      .attr("text-anchor","middle")
      .style("font-size","9px")
      .style("font-weight","normal")
      .text(d => `${fmtFull(d.sales)} VND`);
  }

  window.bootQ6 = bootQ6;
})();
