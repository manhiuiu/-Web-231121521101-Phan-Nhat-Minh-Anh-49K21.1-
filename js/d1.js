// js/d1.js
(function () {
/* ===================== Aliases & helpers ===================== */
const COLS = {
  date:      ["Thời gian tạo đơn","Ngày","Order Date","Invoice Date","Date"],
  orderId:   ["Mã đơn hàng","Ma don hang","Số HĐ","So HD","Invoice","Số chứng từ","So chung tu","Số","So"],
  groupCode: ["Mã nhóm","Ma nhom","Mã nhóm hàng","Ma nhom hang","Mã nhóm h","Ma nhom h"],
  groupName: ["Tên nhóm hàng","Ten nhom hang","Tên nhóm","Ten nhom","Group","Nhóm","Nhom"],
  itemCode:  ["Mã mặt hàng","Ma mat hang","Code","SKU","Mã hàng","Ma hang"],
  itemName:  ["Tên mặt hàng","Ten mat hang","Item","Tên hàng","Ten hang"]
};
function pick(row, keys) { for (const k of keys) if (row[k]!=null && String(row[k]).trim()!=="") return row[k]; return ""; }
function parseDateToParts(s){
  if(!s) return null; const t=String(s).trim(); let d=new Date(t);
  if(!isFinite(d)){ const m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) d=new Date(+m[3],(+m[1])-1,+m[2]); }
  if(!isFinite(d)) return null;
  const mNum=d.getMonth()+1, monthKey="T"+String(mNum).padStart(2,"0");
  const dom=d.getDate(), DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return {monthKey, dom, dow: DOW[d.getDay()]};
}

/* ===================== Scales & ticks (line) ===================== */
const Y_CAP={ALL:[0.90,1.10], SET:[0.05,0.25], THO:[0.10,0.35], TMX:[0.30,0.50], TTC:[0.35,0.75]};
const TICKS={
  ALL:[0.90,1.00,1.10], SET:[0.10,0.15,0.20,0.25], THO:[0.15,0.20,0.25,0.30],
  TMX:[0.30,0.35,0.40,0.45,0.50], TTC:[0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70,0.75]
};

/* ===================== Colors ===================== */
function colorFnForGroup(code,names){
  if(code==="SET"){const map={
    "[SET04] Set 10 gói trà gừng":"#4CAF50","[SET03] Set 10 gói trà hoa cúc trắng":"#FFCC80",
    "[SET05] Set 10 gói trà dưỡng nhan":"#AED581","[SET02] Set 10 gói trà hoa đậu biếc":"#FFD180",
    "[SET01] Set 10 gói trà nụ hoa nhài trắng":"#90CAF9","[SET06] Set 10 gói trà gạo lứt 8 vị":"#A1887F",
    "[SET07] Set 10 gói trà cam sả quế":"#FBC02D"}; return n=>map[n]||d3.schemeTableau10[(names.indexOf(n))%10];}
  if(code==="THO"){const map={
    "[THO03] Trà hoa cúc trắng":"#D32F2F","[THO01] Trà nụ hoa nhài trắng":"#F9A825","[THO02] Trà hoa đậu biếc":"#80CBC4",
    "[THO06] Trà nhụy hoa nghệ tây":"#BDBDBD","[THO05] Trà hoa Atiso":"#8D6E63","[THO04] Trà nụ hoa hồng Tây Tạng":"#F48FB1"};
    return n=>map[n]||d3.schemeTableau10[(names.indexOf(n))%10];}
  if(code==="TMX"){const map={"[TMX01] Trà dưỡng nhan":"#C2185B","[TMX03] Trà gạo lứt 8 vị":"#9C27B0","[TMX02] Trà cam sả quế":"#F06292"};
    return n=>map[n]||d3.schemeTableau10[(names.indexOf(n))%10];}
  if(code==="TTC"){const map={"[TTC01] Trà gừng":"#CE93D8","[TTC02] Cam lát":"#BF8F5F"}; return n=>map[n]||d3.schemeTableau10[(names.indexOf(n))%10];}
  if(code==="ALL") return n=>({ "[BOT01] Bột cần tây":"#4f6f98" }[n]||"#607D8B");
  const scale=d3.scaleOrdinal(d3.schemeTableau10).domain(names); return n=>scale(n);
}

/* ===================== Tooltip (floating div) ===================== */
function getTooltip(){
  let tip=d3.select("#d1_tooltip");
  if(tip.empty()){
    tip=d3.select("body").append("div")
      .attr("id","d1_tooltip")
      .style("position","fixed")
      .style("pointer-events","none")
      .style("z-index","99999")
      .style("background","#fff")
      .style("border","1px solid #d0d7de")
      .style("box-shadow","0 6px 18px rgba(0,0,0,.15)")
      .style("border-radius","8px")
      .style("padding","8px 10px")
      .style("font","12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial")
      .style("color","#1f2328")
      .style("white-space","nowrap")
      .style("opacity",0);
  }
  return tip;
}
const fmtPct = v => (v*100).toFixed(1).replace(".0","") + "%";
const fmtNum = d3.format(",");

/* ===================== LEGEND PAGER ===================== */
function drawLegendPager(containerSel, names, color, onToggle){
  const host = d3.select(containerSel);
  const shellSel = host.selectAll(".legend-pager").data([null]);
  const shell = shellSel.enter().append("div").attr("class","legend-pager").merge(shellSel);
  shell.selectAll("*").remove();

  const viewport = shell.append("div").attr("class","legend-viewport");
  const rail = viewport.append("div").attr("class","legend-rail");
  const btnWrap = shell.append("div").attr("class","legend-navwrap");
  const btnPrev = btnWrap.append("button").attr("type","button").attr("class","legend-nav prev").attr("aria-label","Prev").text("◀");
  const btnNext = btnWrap.append("button").attr("type","button").attr("class","legend-nav next").attr("aria-label","Next").text("▶");

  const items = rail.selectAll(".legend-item").data(names, d=>d).enter()
    .append("div").attr("class","legend-item").attr("data-name",d=>d);

  items.append("span").attr("class","legend-swatch").style("background", d=>color(d));
  items.append("span").attr("class","legend-text").text(d=>d);

  items.on("click", function(_, name){
    const el = d3.select(this);
    const nowOff = !el.classed("off");
    el.classed("off", nowOff);
    if(onToggle) onToggle(name, !nowOff);
  });

  function paginate(){
    const vpW = viewport.node().getBoundingClientRect().width;
    const widths = Array.from(rail.node().children).map(ch => ch.getBoundingClientRect().width);
    const pages = []; let cur=[], sum=0;
    widths.forEach((w,idx)=>{
      const add = (cur.length?8:0) + w;
      if(sum + add <= vpW) { cur.push(idx); sum += add; }
      else { pages.push(cur); cur=[idx]; sum=w; }
    });
    if(cur.length) pages.push(cur);

    let page = 0;
    function renderPage(){
      const children = rail.selectAll(".legend-item");
      children.style("display","none");
      if(pages.length===0) return;
      d3.selectAll(btnPrev.node()).property("disabled", page<=0);
      d3.selectAll(btnNext.node()).property("disabled", page>=pages.length-1);
      pages[page].forEach(i => children.filter((_,j)=>j===i).style("display",null));
    }
    btnPrev.on("click",()=>{ if(page>0){ page--; renderPage(); }});
    btnNext.on("click",()=>{ if(page<pages.length-1){ page++; renderPage(); }});
    renderPage();

    window.addEventListener("resize", debounce(()=> { paginate(); }, 120), { once:true });
  }
  function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,a),ms); }; }
  paginate();
}

/* ===================== LINE (Q10) – with unified tooltip ===================== */
function drawLineChart(data, chartSel, code, monthsDomain, groupLabel){
  const root = d3.select(chartSel);
  root.selectAll("*").remove();

  const host = root.node();
  const hostBox = host.getBoundingClientRect();
  const hostW = Math.max(320, Math.floor(hostBox.width));
  const hostH = Math.max(220, Math.floor(hostBox.height));
  const margin = { top:10, right:8, bottom:26, left:56 };
  const W = hostW, H = hostH;

  const svg = root.append("svg")
    .attr("width","100%").attr("height",H)
    .attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMinYMin meet");

  const cap = Y_CAP[code], yMin = cap ? cap[0] : 0, yMax = cap ? cap[1] : 1;
  const x = d3.scalePoint().domain(monthsDomain).range([margin.left, W - margin.right]);
  const y = d3.scaleLinear().domain([yMin, yMax]).range([H - margin.bottom, margin.top]).clamp(true);

  // grid
  svg.append("g").attr("class","gridline")
    .attr("transform",`translate(0,${H - margin.bottom})`)
    .call(d3.axisBottom(x).tickSize(-(H - margin.top - margin.bottom)).tickFormat(""))
    .select(".domain").remove();

  // axes
  svg.append("g").attr("transform",`translate(0,${H - margin.bottom})`).call(d3.axisBottom(x));
  let axisLeft = d3.axisLeft(y).tickFormat(d=>`${(d*100).toFixed(0)}%`);
  const want = TICKS[code]; if (want) axisLeft = axisLeft.tickValues(want);
  svg.append("g").attr("transform",`translate(${margin.left},0)`).call(axisLeft);

  const names = data.map(d=>d.name);
  const color = colorFnForGroup(code, names);

  const line = d3.line()
    .x(d=>x(d.month))
    .y(d=>y(Math.max(yMin, Math.min(yMax, d.probability))))
    .curve(d3.curveLinear);

  svg.selectAll(".series").data(data, d=>d.name).enter()
    .append("path")
    .attr("class","series")
    .attr("fill","none").attr("stroke-width",2)
    .attr("stroke",d=>color(d.name))
    .attr("data-name", d=>d.name)
    .attr("d", d=>line(d.values));

  // dots + tooltip
  const tip = getTooltip();
  const pts = data.flatMap(d=>d.values.map(v=>({ name:d.name, ...v })));
  svg.selectAll(".dot").data(pts).enter().append("circle")
    .attr("class","dot")
    .attr("r",3.5).attr("fill",d=>color(d.name))
    .attr("data-name", d=>d.name)
    .attr("cx",d=>x(d.month))
    .attr("cy",d=>y(Math.max(yMin, Math.min(yMax, d.probability))))
    .on("mouseenter", function(){ tip.style("opacity",1); d3.select(this).attr("r",5); })
    .on("mouseleave", function(){ tip.style("opacity",0); d3.select(this).attr("r",3.5); })
    .on("mousemove", function(e,d){
      const html =
        `<div><span style="opacity:.7">Tháng:</span> ${d.month}</div>
         <div><span style="opacity:.7">Mặt hàng:</span> ${d.name}</div>
         <div><span style="opacity:.7">Nhóm hàng:</span> ${groupLabel}</div>
         <div><span style="opacity:.7">SL Đơn Bán:</span> ${d.num!=null ? fmtNum(d.num) : "—"}</div>
         <div><span style="opacity:.7">Xác suất Bán / Nhóm hàng:</span> ${fmtPct(d.probability)}</div>`;
      tip.html(html)
         .style("left",(e.clientX+14)+"px")
         .style("top",(e.clientY+14)+"px");
    });

  function toggleSeries(name, visible){
    const safe = name.replace(/'/g,"\\'");
    const disp = visible ? null : "none";
    svg.selectAll(`.series[data-name='${safe}']`).style("display", disp);
    svg.selectAll(`.dot[data-name='${safe}']`).style("display", disp);
  }
  drawLegendPager(chartSel, names, color, toggleSeries);
}

/* ===================== BAR (Q9) – tooltip theo mẫu ===================== */
function drawBarChart(chartSel, data, groupKey){
  d3.select(chartSel).selectAll("*").remove();

  const LABEL_MAX_CHARS = 26;
  const shorten = s => { s = String(s||""); return s.length>LABEL_MAX_CHARS ? (s.slice(0,LABEL_MAX_CHARS-1)+"…") : s; };

  const hostSel=d3.select(chartSel);
  const host=hostSel.node();
  const hostBox = host.getBoundingClientRect();
  const W=Math.max(320,Math.floor(hostBox.width));
  const Hmin = 220;
  const H = Math.max(Hmin, Math.floor(hostBox.height));

  // đo nhãn Y
  const meas=hostSel.append("svg").attr("width",10).attr("height",10)
    .style("position","absolute").style("left","-9999px").style("top","-9999px");
  let maxLabelW=0;
  meas.selectAll("text._y").data((data||[]).map(d=>shorten(d.name))).enter().append("text")
    .attr("class","_y").style("font-size","12px").style("font-family","sans-serif")
    .text(d=>d).each(function(){ maxLabelW=Math.max(maxLabelW,this.getBBox().width); });
  meas.remove();

  const mCode=(groupKey.match(/^\[([A-Z]{3})]/)||[])[1] || (groupKey==="ALL"?"BOT":"");
  const X_CAP={BOT:1.00, SET:0.15, THO:0.20, TMX:0.30, TTC:0.50};
  const xMax = X_CAP[mCode] ?? Math.min(1, Math.ceil((d3.max(data,d=>d.p)||0.1)*20)/20);

  const M={ t:14, r:(mCode==="TMX"||mCode==="TTC")?32:10, b:36, l:Math.min(220,Math.max(80,Math.round(maxLabelW+14))) };

  const svg=hostSel.append("svg")
    .attr("width","100%").attr("height",H)
    .attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMinYMin meet");

  const x=d3.scaleLinear().domain([0,xMax]).range([M.l,W-M.r]);
  const y=d3.scaleBand().domain((data||[]).map(d=>d.name)).range([M.t,H-M.b]).padding(0.18);

  // ticks cố định theo nhóm
  let tickVals;
  if(mCode==="BOT") tickVals=d3.range(0,1.001,0.20);
  else if(mCode==="SET") tickVals=[0,0.05,0.10,0.15];
  else if(mCode==="THO") tickVals=[0,0.05,0.10,0.15,0.20];
  else if(mCode==="TMX") tickVals=[0,0.10,0.20,0.30];
  else if(mCode==="TTC") tickVals=[0,0.10,0.20,0.30,0.40,0.50];

  // grid
  svg.append("g").attr("class","gridline")
    .attr("transform",`translate(0,${H-M.b})`)
    .call(d3.axisBottom(x).tickValues(tickVals).tickSize(-(H-M.t-M.b)).tickFormat(""))
    .select(".domain").remove();

  // axis
  svg.append("g").attr("transform",`translate(0,${H-M.b})`)
    .call(d3.axisBottom(x).tickValues(tickVals).tickFormat(v=>`${Math.round(v*100)}%`))
    .select(".domain").remove();

  const yAxis = svg.append("g").attr("transform",`translate(${M.l},0)`)
    .call(d3.axisLeft(y).tickSize(0).tickFormat(s=>shorten(s)));
  yAxis.select(".domain").remove();
  yAxis.selectAll(".tick text").append("title").text(d=>d);

  const color=colorFnForGroup(mCode==="BOT"?"ALL":mCode, data.map(d=>d.name));
  const tip = getTooltip();

  // bars + tooltip
  svg.selectAll("rect.bar").data(data).enter().append("rect")
    .attr("class","bar")
    .attr("x",x(0))
    .attr("y",d=>y(d.name))
    .attr("width",d=>Math.max(1, x(Math.min(d.p,xMax)) - x(0)))
    .attr("height",y.bandwidth())
    .attr("fill",d=>color(d.name))
    .on("mouseenter", function(){ tip.style("opacity",1); d3.select(this).attr("opacity",0.9); })
    .on("mouseleave", function(){ tip.style("opacity",0); d3.select(this).attr("opacity",1); })
    .on("mousemove", function(e,d){
      const html =
        `<div><span style="opacity:.7">Mặt hàng:</span> ${d.name}</div>
         <div><span style="opacity:.7">Nhóm hàng:</span> ${groupKey}</div>
         <div><span style="opacity:.7">SL Đơn Bán:</span> ${d.num!=null ? fmtNum(d.num) : "—"}</div>
         <div><span style="opacity:.7">Xác suất Bán / Nhóm hàng:</span> ${fmtPct(d.p)}</div>`;
      tip.html(html)
         .style("left",(e.clientX+14)+"px")
         .style("top",(e.clientY+14)+"px");
    });

  // value labels
  svg.selectAll("text.label").data(data).enter().append("text")
    .attr("class","label")
    .attr("x",d=>x(Math.min(d.p,xMax))+6)
    .attr("y",d=>y(d.name)+y.bandwidth()/2+1)
    .attr("text-anchor","start")
    .attr("font-size","12px")
    .attr("fill","#333")
    .text(d=>`${(d.p*100).toFixed(1)}%`);

  // Cho phép cuộn nếu nhiều item
  d3.select(chartSel).style("overflow","auto");
}

/* ===================== CSS ===================== */
const D1_CSS=`
  :root{ --cellH: 300px; }
  .d1-wrap{max-width:1400px;margin:0 auto;}
  .d1-title{background:#546d8d;color:#fff;padding:10px 14px;border-radius:8px;margin-bottom:14px;text-align:center;font-weight:700;letter-spacing:.2px}
  .d1-grid{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:auto auto;gap:16px;align-items:start}
  .d1-cell,.d1-controls{height:var(--cellH);padding:8px;background:#fff;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.08);position:relative;overflow:hidden}
  .d1-cell .d1-hdr{margin:2px 0 8px 0;text-align:center;color:#008080;font-weight:700;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .d1-controls{border:1px solid #e0d2d6;box-shadow:0 2px 6px rgba(0,0,0,.05)}
  .d1-controls .d1-panel-title{color:#008080;font-weight:700;margin:2px 0 10px 0;font-size:16px}
  .d1-controls .radio-row{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
  .d1-controls .inline{display:grid;grid-template-columns:1fr 1fr;gap:12px;overflow:auto}

  .dd{position:relative}
  .dd-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer;font-size:13px}
  .dd-panel{position:absolute;left:0;top:calc(100% + 6px);z-index:2000;width:100%;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:8px;max-height:240px;overflow:auto}
  .dd-row{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px}
  .dd-chk{display:flex;align-items:center;gap:8px}
  .dd-actions{display:flex;gap:8px;margin-bottom:6px}

  .gridline line{ stroke:#cfd4dc; stroke-width:1; stroke-opacity:1; shape-rendering:crispEdges; stroke-dasharray:2 3; }
  .legend-pager{ display:flex; align-items:center; gap:8px; margin-top:8px; }
  .legend-viewport{ position:relative; flex:1 1 auto; overflow:hidden; }
  .legend-rail{ display:flex; align-items:center; gap:8px; }
  .legend-item{ display:flex; align-items:center; gap:8px; padding:2px 4px; border-radius:6px; font-size:12px; white-space:nowrap; cursor:pointer; user-select:none; background:#fff; }
  .legend-item.off{ opacity:.35; }
  .legend-swatch{ width:12px; height:12px; border-radius:3px; flex:0 0 12px; }
  .legend-navwrap{ display:flex; gap:6px; }
  .legend-nav{ width:26px; height:22px; border:1px solid #e0e0e0; background:#fff; border-radius:6px; cursor:pointer; }
  .legend-nav:disabled{ opacity:.45; cursor:not-allowed; }
`;

/* ===================== Dropdown multi ===================== */
function makeDropdownMulti(parent,title,options,{idPrefix,columns=2,defaultChecked=[],allChecked=false,onChange}={}){
  const blk=parent.append("div").attr("class","blk");
  blk.append("label").text(title);
  const dd=blk.append("div").attr("class","dd");
  const btn=dd.append("button").attr("type","button").attr("class","dd-btn");
  const btnText=btn.append("span").text("(Tất cả)"); btn.append("span").text("▾");

  const panel=dd.append("div").attr("class","dd-panel").style("display","none");
  const actions=panel.append("div").attr("class","dd-actions");
  const bAll=actions.append("button").attr("type","button").text("Tất cả");
  const bNone=actions.append("button").attr("type","button").text("Bỏ chọn");

  const rows=panel.append("div").attr("class","dd-row").style("grid-template-columns",`repeat(${columns}, minmax(80px,1fr))`);

  const allId=`${idPrefix}_ALL`;
  const allWrap=rows.append("label").attr("class","dd-chk").style("grid-column",`span ${columns}`);
  allWrap.append("input").attr("type","checkbox").attr("id",allId).property("checked",allChecked);
  allWrap.append("span").text("(Tất cả)");

  const its=rows.selectAll(null).data(options).enter().append("label").attr("class","dd-chk");
  its.append("input").attr("type","checkbox").attr("name",idPrefix).attr("value",d=>d.value)
    .property("checked",d=>defaultChecked.includes(d.value)||allChecked).on("change",syncAll);
  its.append("span").text(d=>d.label);

  function open(){panel.style("display","block");} function close(){panel.style("display","none");}
  btn.on("click",()=>{panel.style("display")==="none"?open():close();});
  document.addEventListener("click",(e)=>{ if(!dd.node().contains(e.target)) close(); });

  function syncAll(){const all=rows.selectAll(`input[name='${idPrefix}']`).nodes(); const every=all.every(inp=>inp.checked);
    d3.select(`#${allId}`).property("checked",every); refreshBtnText(); if(onChange) onChange();}
  d3.select(`#${allId}`).on("change",()=>{const isAll=d3.select(`#${allId}`).property("checked");
    rows.selectAll(`input[name='${idPrefix}']`).property("checked",isAll); refreshBtnText(); if(onChange) onChange();});
  bAll.on("click",()=>{d3.select(`#${allId}`).property("checked",true).dispatch("change");});
  bNone.on("click",()=>{d3.select(`#${allId}`).property("checked",false);
    rows.selectAll(`input[name='${idPrefix}']`).property("checked",false); refreshBtnText(); if(onChange) onChange();});

  function getSelected(){ if(d3.select(`#${allId}`).property("checked")) return [];
    return rows.selectAll(`input[name='${idPrefix}']:checked`).nodes().map(n=>n.value);}
  function refreshBtnText(){
    const sel=getSelected();
    if(sel.length===0) btnText.text("(Tất cả)");
    else if(sel.length<=3){
      const labels=rows.selectAll(`input[name='${idPrefix}']:checked`).nodes().map(n=>n.parentElement.querySelector("span")?.textContent||n.value);
      btnText.text(labels.join(", "));
    } else btnText.text(`${sel.length} đã chọn`);
  }
  refreshBtnText();
  return { getSelected, refreshBtnText };
}

/* ===================== Boot ===================== */
function bootD1(containerSel="#view"){
  const root=d3.select(containerSel).html("");

  if(!document.getElementById("d1_css")){const st=document.createElement("style"); st.id="d1_css"; st.innerHTML=D1_CSS; document.head.appendChild(st);}

  const wrap=root.append("div").attr("class","d1-wrap");
  const titleEl=wrap.append("div").attr("class","d1-title").text("Xác suất bán hàng của Mặt hàng theo Nhóm hàng");
  const grid=wrap.append("div").attr("class","d1-grid");

  const cellAll=grid.append("div").attr("class","d1-cell").style("grid-column","1").style("grid-row","1");
  cellAll.append("div").attr("class","d1-hdr").text("[BOT] Bột");
  const idAll="d1_ALL"; cellAll.append("div").attr("id",idAll);

  const cellSET=grid.append("div").attr("class","d1-cell").style("grid-column","2").style("grid-row","1");
  cellSET.append("div").attr("class","d1-hdr").text("[SET] Set trà");
  const idSET="d1_SET"; cellSET.append("div").attr("id",idSET);

  const cellTHO=grid.append("div").attr("class","d1-cell").style("grid-column","3").style("grid-row","1");
  cellTHO.append("div").attr("class","d1-hdr").text("[THO] Trà hoa");
  const idTHO="d1_THO"; cellTHO.append("div").attr("id",idTHO);

  const cellTMX=grid.append("div").attr("class","d1-cell").style("grid-column","1").style("grid-row","2");
  cellTMX.append("div").attr("class","d1-hdr").text("[TMX] Trà mix");
  const idTMX="d1_TMX"; cellTMX.append("div").attr("id",idTMX);

  const cellTTC=grid.append("div").attr("class","d1-cell").style("grid-column","2").style("grid-row","2");
  cellTTC.append("div").attr("class","d1-hdr").text("[TTC] Trà củ, quả sấy");
  const idTTC="d1_TTC"; cellTTC.append("div").attr("id",idTTC);

  // Ô controls
  const controls=grid.append("div").attr("class","d1-controls").style("grid-column","3").style("grid-row","2");
  controls.append("div").attr("class","d1-panel-title").text("Biểu đồ");

  const rr=controls.append("div").attr("class","radio-row");
  const r1=rr.append("label"); r1.append("input").attr("type","radio").attr("name","mode").attr("value","m1").property("checked",true);
  r1.append("span").text("Xác suất bán hàng của Mặt hàng theo Nhóm hàng");
  const r2=rr.append("label"); r2.append("input").attr("type","radio").attr("name","mode").attr("value","m2");
  r2.append("span").text("Xác suất bán hàng của Mặt hàng theo Nhóm hàng trong từng Tháng");

  const area=controls.append("div").attr("class","inline");
  const blkLeft=area.append("div"); const blkRight=area.append("div");

  function updateTopTitle(mode){ titleEl.text(mode==="m2" ? "Xác suất bán hàng của Mặt hàng theo Nhóm hàng trong từng Tháng" : "Xác suất bán hàng của Mặt hàng theo Nhóm hàng"); }

  d3.csv("./data/sales.csv").then(rows=>{
    if(!rows||!rows.length){[idAll,idSET,idTHO,idTMX,idTTC].forEach(id=>d3.select("#"+id).append("div").style("padding","12px").text("Không có dữ liệu.")); return;}

    const parsed=rows.map(r=>{const parts=parseDateToParts(pick(r,COLS.date)); return {
      parts, groupCode:String(pick(r,COLS.groupCode)||"").trim(), groupName:String(pick(r,COLS.groupName)||"").trim(),
      itemCode:String(pick(r,COLS.itemCode)||"").trim(), itemName:String(pick(r,COLS.itemName)||"").trim(),
      orderId:String(pick(r,COLS.orderId)||"").trim()
    };}).filter(x=>x.parts&&x.groupCode&&x.groupName&&x.itemCode&&x.itemName&&x.orderId);

    const allMonths=Array.from(new Set(parsed.map(d=>d.parts.monthKey))).sort((a,b)=>(+a.slice(1))-(+b.slice(1)));
    const monthOptions=allMonths.map(m=>({value:m,label:m}));
    const defaultMonths=allMonths.filter(m=>+m.slice(1)>=7&&+m.slice(1)<=12);
    const monthsDD=makeDropdownMulti(blkLeft,"Tháng",monthOptions,{idPrefix:"ddM",columns:3,defaultChecked:(defaultMonths.length?defaultMonths:allMonths),onChange:render});
    const domOptions=Array.from({length:31},(_,i)=>({value:String(i+1),label:String(i+1)}));
    const domDD=makeDropdownMulti(blkLeft,"Ngày trong Tháng",domOptions,{idPrefix:"ddDOM",columns:5,allChecked:true,onChange:render});
    const dowVals=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const dowDD=makeDropdownMulti(blkRight,"Ngày trong Tuần",dowVals.map(d=>({value:d,label:d})),{idPrefix:"ddDOW",columns:3,allChecked:true,onChange:render});

    controls.selectAll("input[name=mode]").on("change",render);

    // Mẫu số nội bộ (không hiển thị)
    const totalByGroupYear = new Map();
    parsed.forEach(r=>{
      const gk=`[${r.groupCode}] ${r.groupName}`;
      if(!totalByGroupYear.has(gk)) totalByGroupYear.set(gk,new Set());
      totalByGroupYear.get(gk).add(r.orderId);
    });

    function currentMonths(){ const m=monthsDD.getSelected(); return (m.length?m:allMonths).slice().sort((a,b)=>(+a.slice(1))-(+b.slice(1))); }
    function filterData(monthsPicked){
      const domPicked=domDD.getSelected().map(Number), dowPicked=dowDD.getSelected();
      return parsed.filter(d=>{
        const okM=monthsPicked.includes(d.parts.monthKey);
        const okDom=(domPicked.length===0)?true:domPicked.includes(+d.parts.dom);
        const okDow=(dowPicked.length===0)?true:dowPicked.includes(d.parts.dow);
        return okM&&okDom&&okDow;
      });
    }

    render();

    function render(){
      const mode=(controls.select("input[name=mode]:checked").node().value);
      const monthsDomain=currentMonths(); const filtered=filterData(monthsDomain);
      updateTopTitle(mode);

      if(mode==="m2"){
        // theo Tháng (line)
        const groupItemMonth=new Map(), groupMonthTotals=new Map();
        filtered.forEach(r=>{
          const gk=`[${r.groupCode}] ${r.groupName}`, ik=`[${r.itemCode}] ${r.itemName}`, mk=r.parts.monthKey;
          if(!groupItemMonth.has(gk)) groupItemMonth.set(gk,new Map());
          const itemMap=groupItemMonth.get(gk); if(!itemMap.has(ik)) itemMap.set(ik,new Map());
          const monthMap=itemMap.get(ik); if(!monthMap.has(mk)) monthMap.set(mk,new Set()); monthMap.get(mk).add(r.orderId);
          if(!groupMonthTotals.has(gk)) groupMonthTotals.set(gk,new Map());
          const gt=groupMonthTotals.get(gk); if(!gt.has(mk)) gt.set(mk,new Set()); gt.get(mk).add(r.orderId);
        });
        function drawPanel(code,prefix,chartId){
          const gk=Array.from(groupItemMonth.keys()).find(k=>k.startsWith(`[${prefix}]`))||(prefix==="BOT"?Array.from(groupItemMonth.keys()).find(k=>k.startsWith("[BOT]")):null);
          if(!gk){ d3.select("#"+chartId).html("<div style='padding:8px'>Không có dữ liệu.</div>"); return; }
          const itemMap=groupItemMonth.get(gk)||new Map(), groupTotal=groupMonthTotals.get(gk)||new Map();
          const series=Array.from(itemMap,([name,monthMap])=>({name, values: monthsDomain.map(m=>{
            const num=(monthMap.get(m)||new Set()).size, den=(groupTotal.get(m)||new Set()).size||1;
            return {month:m, probability:num/den, num}; // không hiển thị den
          })}));
          drawLineChart(series,"#"+chartId,code,monthsDomain,gk);
        }
        drawPanel("ALL","BOT",idAll); drawPanel("SET","SET",idSET); drawPanel("THO","THO",idTHO); drawPanel("TMX","TMX",idTMX); drawPanel("TTC","TTC",idTTC);
      }else{
        // theo Nhóm hàng (bar)
        const byItemFiltered=new Map();
        filtered.forEach(r=>{
          const gk=`[${r.groupCode}] ${r.groupName}`, name=`[${r.itemCode}] ${r.itemName}`;
          if(!byItemFiltered.has(gk)) byItemFiltered.set(gk,new Map());
          const mp=byItemFiltered.get(gk); if(!mp.has(name)) mp.set(name,new Set()); mp.get(name).add(r.orderId);
        });

        function drawGroup(prefix,id){
          const allGroups = Array.from(new Set([...totalByGroupYear.keys(), ...byItemFiltered.keys()]));
          const gk=allGroups.find(k=>k.startsWith(`[${prefix}]`))||(prefix==="BOT"?allGroups.find(k=>k.startsWith("[BOT]")):null);
          if(!gk){ d3.select("#"+id).html("<div style='padding:8px'>Không có dữ liệu.</div>"); return; }

          const den=(totalByGroupYear.get(gk)||new Set()).size || 1;
          const mp=byItemFiltered.get(gk)||new Map();
          const data=Array.from(mp,([name,set])=>({name,p:set.size/den,num:set.size}))
                          .sort((a,b)=>d3.descending(a.p,b.p));
          drawBarChart("#"+id,data,gk);
        }
        drawGroup("BOT",idAll); drawGroup("SET",idSET); drawGroup("THO",idTHO); drawGroup("TMX",idTMX); drawGroup("TTC",idTTC);
      }
    } // render
  }); // csv
}

/* ===================== Expose & auto boot ===================== */
window.bootD1=bootD1;
document.addEventListener("DOMContentLoaded",()=>{ if(document.querySelector("#view")) bootD1("#view"); });
})();
