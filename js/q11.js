/* ===================== js/q11.js ===================== */
(function () {
  const fmtInt = d3.format(","); 
  const nice0 = v => (v == null || isNaN(v) ? 0 : v);

  const pick = (row, keys) => {
    for (const k of keys) if (row[k] != null && String(row[k]).trim() !== "") return row[k];
    return "";
  };

  const COLS = {
    orderId: [
      "Số HĐ","So HD","Số hóa đơn","So hoa don","Mã đơn","Ma don",
      "Mã đơn hàng","Ma don hang","OrderID","Order Id","Invoice",
      "Số chứng từ","So chung tu","Số","So","Mã phiếu","Ma phieu"
    ],
    customerId: [
      "Mã KH","Ma KH","Mã khách","Ma khach","CustomerID","Customer Id",
      "Khách hàng","Khach hang","Mã khách hàng","Ma khach hang",
      "SĐT","SDT","Số điện thoại","So dien thoai","Phone","Điện thoại"
    ]
  };

  function bootQ11(containerSel = "#view", csvPath = "./data/sales.csv", maxBin = 22) {
    const root = d3.select(containerSel).html("");
    root.append("div").attr("class", "card").text("Đang tải Q11…");

    d3.csv(csvPath, row => {
      const order_id = String(pick(row, COLS.orderId) || "").trim();
      const cus_id   = String(pick(row, COLS.customerId) || "").trim();
      return { order_id, cus_id };
    }).then(rows => {
      rows = rows.filter(r => r.order_id && r.cus_id);

      const perCus = new Map();
      for (const r of rows) {
        if (!perCus.has(r.cus_id)) perCus.set(r.cus_id, new Set());
        perCus.get(r.cus_id).add(r.order_id);
      }

      const counts = Array.from(perCus.values(), s => s.size);

      const freq = new Map();
      for (const n of counts) {
        freq.set(n, (freq.get(n) || 0) + 1);
      }

      const maxObserved = d3.max(counts) || 1;
      const upper = Math.max(Math.min(maxObserved, maxBin), 1);

      const data = [];
      for (let i = 1; i <= upper; i++) {
        data.push({ times: i, customers: nice0(freq.get(i)) });
      }

      drawQ11(root, data);
    }).catch(err => {
      d3.select(containerSel).html(
        `<div class="card error">Không thể vẽ Q11: ${err.message}</div>`
      );
    });
  }

  function drawQ11(root, data) {
    root.html("");

    root.append("h2")
      .attr("class", "chart-title")
      .text("Phân phối Lượt mua hàng");

    const card = root.append("div").attr("class", "card");

    const W = 1200, H = 520;
    const M = { t: 40, r: 20, b: 40, l: 70 };
    const w = W - M.l - M.r, h = H - M.t - M.b;

    const svg = card.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g   = svg.append("g").attr("transform", `translate(${M.l},${M.t})`);

    const x = d3.scaleBand()
      .domain(data.map(d => d.times))
      .range([0, w])
      .padding(0.15);

    const y = d3.scaleLinear()
      .domain([0, 5000])
      .range([h, 0]);

    // gridline ngang
    g.append("g")
      .attr("class", "gridline")
      .call(
        d3.axisLeft(y)
          .tickValues(d3.range(0, 5000+1, 500))
          .tickSize(-w)
          .tickFormat("")
      )
      .select(".domain").remove();

    // trục X (ẩn tick mark, chỉ hiện nhãn)
    g.append("g")
      .attr("class","axis")
      .attr("transform",`translate(0,${h})`)
      .call(
        d3.axisBottom(x)
          .tickSize(0)   // bỏ tick mark
      )
      .select(".domain").remove();

    // trục Y
    const yAxis = g.append("g")
      .attr("class","axis")
      .call(
        d3.axisLeft(y)
          .tickValues(d3.range(0, 5000+1, 500))
          .tickFormat(fmtInt)
          .tickSize(0)
      );
    yAxis.select(".domain").remove();

    // nhãn trục Y giữa
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -h/2)
      .attr("y", -48)
      .attr("fill", "#555")
      .attr("text-anchor", "middle")
      .style("font-size","12px")
      .text("Số Khách hàng");

    // tooltip
    const tip = d3.select("body").append("div").attr("class","tooltip");

    // bars
    g.selectAll("rect.bar")
      .data(data)
      .join("rect")
      .attr("class","bar")
      .attr("x", d => x(d.times))
      .attr("y", d => y(d.customers))
      .attr("width", x.bandwidth())
      .attr("height", d => h - y(d.customers))
      .attr("fill", "#4f6f98")
      .on("mousemove", (ev, d) => {
        tip.style("left", (ev.clientX + 12) + "px")
           .style("top",  (ev.clientY - 12) + "px")
           .style("opacity", 1)
           .html(`
             <div class="tt-title"><b>Đã mua ${d.times} lần</b></div>
             <div class="tt-row"><span class="tt-key">Số lượng KH:</span>
               <span class="tt-val">${fmtInt(d.customers)}</span>
             </div>
           `);
      })
      .on("mouseleave", () => tip.style("opacity", 0));
  }

  window.bootQ11 = bootQ11;
})();
