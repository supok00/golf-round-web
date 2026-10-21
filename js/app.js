/* 골프 라운드 분석 웹앱 — 화면 렌더링과 데이터 저장.
 * GitHub Pages는 서버가 없으므로 입력한 라운드는 이 브라우저(localStorage)에 저장한다.
 * 처음 열 때는 data/rounds.json(엑셀 v2에서 옮긴 기록)을 불러온다.
 */
(() => {
  const S = GolfStats;
  const KEY_ROUNDS = "golf.rounds.v1";
  const KEY_SETTINGS = "golf.settings.v1";
  const app = document.getElementById("app");
  let rounds = [];
  let settings = structuredClone(S.DEFAULT_SETTINGS);
  let charts = [];

  // ───────────── 저장 ─────────────
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 사파리 사생활 보호 모드 등 */ } },
  };
  function saveRounds() {
    if (!store.set(KEY_ROUNDS, rounds)) toast("브라우저 저장소에 저장하지 못했습니다. 내보내기로 백업하세요.");
  }
  function saveSettings() { store.set(KEY_SETTINGS, settings); }
  async function loadOriginal() {
    const res = await fetch("data/rounds.json", { cache: "no-store" });
    return res.json();
  }
  async function init() {
    const saved = store.get(KEY_ROUNDS);
    rounds = Array.isArray(saved) ? saved : await loadOriginal();
    if (!Array.isArray(saved)) saveRounds();
    const st = store.get(KEY_SETTINGS);
    if (st) settings = deepMerge(structuredClone(S.DEFAULT_SETTINGS), st);
    window.addEventListener("hashchange", route);
    route();
  }
  function deepMerge(a, b) {
    for (const k of Object.keys(b || {})) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) a[k] = deepMerge(a[k] || {}, b[k]);
      else a[k] = b[k];
    }
    return a;
  }

  // ───────────── 유틸 ─────────────
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNum = S.isNum;
  const f1 = (v) => (isNum(v) ? v.toFixed(1) : "-");
  const f2 = (v) => (isNum(v) ? v.toFixed(2) : "-");
  const pct = (v) => (isNum(v) ? Math.round(v * 100) + "%" : "-");
  const sgn = (v, d = 2) => (isNum(v) ? (v > 0 ? "+" : "") + v.toFixed(d) : "-");
  const fmtT = (v, t) => (t === "%" ? pct(v) : f1(v));
  const dot = (d) => String(d).replaceAll("-", ".");
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }
  function chart(id, cfg) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    charts.push(new Chart(el, cfg));
  }
  // 차트 데이터 레이블: 값만 표시 (계열·항목 이름 없음)
  const valueLabels = (fmt) => ({
    id: "valueLabels",
    afterDatasetsDraw(c) {
      const { ctx } = c;
      ctx.save();
      ctx.font = "600 11px Pretendard, sans-serif";
      ctx.fillStyle = "#333";
      ctx.textAlign = "center";
      c.data.datasets.forEach((ds, i) => {
        if (ds.noLabels) return;
        const meta = c.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach((el, j) => {
          const v = ds.data[j];
          if (!isNum(v)) return;
          const horizontal = c.options.indexAxis === "y";
          const x = horizontal ? el.x + 18 : el.x;
          const y = horizontal ? el.y + 4 : el.y - 6;
          ctx.fillText(fmt(v), x, y);
        });
      });
      ctx.restore();
    },
  });
  const baseOpts = (extra = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    ...extra,
  });

  // ───────────── 라우팅 ─────────────
  function route() {
    charts.forEach((c) => c.destroy());
    charts = [];
    const [, tab = "dashboard", arg] = location.hash.split("/");
    document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === (tab === "round" || tab === "edit" ? "rounds" : tab)));
    const views = { dashboard, input: () => inputView(null), edit: () => inputView(arg), rounds: roundsView, round: () => roundView(arg), stats: statsView, holes: holesView, settings: settingsView };
    (views[tab] || dashboard)();
    window.scrollTo(0, 0);
  }

  // ───────────── 대시보드 ─────────────
  function dashboard() {
    const A = S.analyze(rounds, settings);
    const r5 = A.fulls.slice(0, 5).map((r) => r.strokes);
    const rows = Object.entries(settings.targets).map(([k, t]) => {
      const m = A.metric(k);
      const ok = isNum(m.r5) ? (t.low ? m.r5 <= t.v : m.r5 >= t.v) : null;
      return { k, t, m, ok };
    });
    const okList = rows.filter((r) => r.ok === true).map((r) => r.t.label);
    const ngList = rows.filter((r) => r.ok === false).map((r) => r.t.label);
    const lossTop = A.loss.filter((l) => isNum(l.r5)).sort((a, b) => b.r5 - a.r5)[0];
    const H = S.holeLevel(rounds);
    const parSorted = [3, 4, 5].filter((p) => isNum(H.byPar[p].over)).sort((a, b) => H.byPar[a].over - H.byPar[b].over);
    const tl = A.teeTotals || A.rs.reduce((o, r) => ({ L: o.L + r.teeL, R: o.R + r.teeR }), { L: 0, R: 0 });
    const frontAvg = S.avg(A.fulls.map((r) => r.front));
    const backAvg = S.avg(A.fulls.map((r) => r.back));
    app.innerHTML = `
      <h2>요약</h2>
      <div class="kpis">
        ${kpi("등록 라운드", A.rs.length, `18홀 ${A.fulls.length}회`)}
        ${kpi("베스트 스코어", A.best ? A.best.strokes : "-", A.best ? `${dot(A.best.date)} ${esc(A.best.course)}` : "", "best")}
        ${kpi("평균 타수", f1(S.avg(A.fulls.map((r) => r.strokes))), "18홀 평균")}
        ${kpi("최근 5R 평균", f1(S.avg(r5)), "최근 18홀 5라운드")}
        ${kpi("방문 골프장", A.courses, "서로 다른 골프장")}
      </div>

      <h2>실력 진단 <span class="muted">최근 5라운드 vs 목표</span></h2>
      <div class="tbl-wrap"><table>
        <thead><tr><th class="l">지표</th><th>전체 평균</th><th>최근 5R</th><th>직전 라운드</th><th>목표</th><th>판정</th></tr></thead>
        <tbody>${rows.map(({ t, m, ok }) => `<tr><td class="l"><b>${t.label}</b></td><td>${fmtT(m.all, t.fmt)}</td><td><b>${fmtT(m.r5, t.fmt)}</b></td><td>${fmtT(m.last, t.fmt)}</td><td class="muted">${fmtT(t.v, t.fmt)}</td><td>${ok === null ? "-" : `<span class="pill ${ok ? "ok" : "ng"}">${ok ? "달성" : "미달"}</span>`}</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="legend-note">타수 지표는 18홀 라운드(${A.fulls.length}회), 퍼트/GIR/FW/스크램블/벌타는 퍼트를 기록한 상세 라운드(${A.dets.length}회) 기준입니다. 목표는 설정에서 바꿀 수 있습니다.</p>

      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h3 style="margin-top:0">6영역 육각형 <span class="muted">최근 상세 5R</span></h3><div class="chart-box tall"><canvas id="cRadar"></canvas></div></div>
        <div class="card"><h3 style="margin-top:0">라운드당 타수 손실 <span class="muted">최근 상세 5R</span></h3><div class="chart-box tall"><canvas id="cLoss"></canvas></div>
          <p class="legend-note">항목끼리 일부 겹칩니다(벌타 홀은 더블+가 되기 쉬움). 크기 비교로 연습 순서를 정하는 용도입니다.</p></div>
      </div>

      <h2>강점 · 약점</h2>
      <div class="card"><ul class="sw">
        <li><span class="ok">강점</span> ${okList.length ? "목표 달성: " + okList.join(", ") : "목표를 달성한 지표가 아직 없습니다"}</li>
        <li><span class="ng">약점</span> ${ngList.length ? "목표 미달: " + ngList.join(", ") : "모든 지표가 목표를 달성했습니다"}</li>
        ${lossTop ? `<li><span class="ng">1순위</span> 가장 많이 잃는 곳: ${lossTop.label} (최근 5R 라운드당 ${f1(lossTop.r5)}타)</li>` : ""}
        ${parSorted.length ? `<li><b>파 유형</b> 파${parSorted[0]} 가장 안정(${sgn(H.byPar[parSorted[0]].over)}) / 파${parSorted.at(-1)} 가장 약함(${sgn(H.byPar[parSorted.at(-1)].over)}, 더블+ ${pct(H.byPar[parSorted.at(-1)].dbl)})</li>` : ""}
        ${tl.L + tl.R ? `<li><b>티샷 미스</b> 왼쪽 ${tl.L}회 / 오른쪽 ${tl.R}회${tl.R >= 2 * tl.L ? " → 오른쪽 쏠림(슬라이스 계열) 점검" : tl.L >= 2 * tl.R ? " → 왼쪽 쏠림(훅 계열) 점검" : ""}</li>` : ""}
        ${isNum(frontAvg) ? `<li><b>전·후반</b> 전반 평균 ${f1(frontAvg)} / 후반 평균 ${f1(backAvg)}</li>` : ""}
      </ul></div>

      <h2>타수 추이 <span class="muted">최근 18홀 30라운드</span></h2>
      <div class="card"><div class="chart-box tall"><canvas id="cTrend"></canvas></div></div>
    `;
    const rk = Object.keys(settings.radar);
    chart("cRadar", {
      type: "radar",
      data: {
        labels: rk.map((k) => settings.radar[k].label),
        datasets: [
          { label: "최근 5R", data: rk.map((k) => A.radar[k]), backgroundColor: "rgba(30,94,59,.25)", borderColor: "#1e5e3b", pointBackgroundColor: "#1e5e3b" },
          { label: "목표", data: rk.map(() => settings.radarTarget), borderColor: "#f28c28", borderDash: [6, 4], backgroundColor: "transparent", pointRadius: 0, noLabels: true },
        ],
      },
      options: baseOpts({ plugins: { legend: { display: true, position: "bottom" } }, scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, display: false }, pointLabels: { font: { size: 13, weight: "600" } } } } }),
      plugins: [{
        id: "radarVals",
        afterDatasetsDraw(c) {
          const meta = c.getDatasetMeta(0), ctx = c.ctx;
          ctx.save(); ctx.font = "700 12px Pretendard, sans-serif"; ctx.fillStyle = "#1e5e3b"; ctx.textAlign = "center";
          meta.data.forEach((p, i) => { const v = c.data.datasets[0].data[i]; if (isNum(v)) ctx.fillText(v, p.x, p.y - 8); });
          ctx.restore();
        },
      }],
    });
    chart("cLoss", {
      type: "bar",
      data: { labels: A.loss.map((l) => l.label), datasets: [{ data: A.loss.map((l) => l.r5), backgroundColor: "#e5352b" }] },
      options: baseOpts({ indexAxis: "y", scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } } }),
      plugins: [valueLabels(f1)],
    });
    trendChart("cTrend", A);
  }
  function kpi(lbl, val, sub, cls = "") {
    return `<div class="kpi"><div class="lbl">${lbl}</div><div class="val ${cls}">${val}</div><div class="sub">${sub || "&nbsp;"}</div></div>`;
  }
  function trendChart(id, A) {
    const list = A.fulls.slice(0, 30).reverse();
    const all = A.fulls.slice().reverse();
    const ma = list.map((r) => {
      const idx = all.indexOf(r);
      const w = all.slice(Math.max(0, idx - 4), idx + 1).map((x) => x.strokes);
      return S.avg(w);
    });
    chart(id, {
      type: "line",
      data: {
        labels: list.map((r) => r.date.slice(2).replaceAll("-", ".")),
        datasets: [
          { label: "총타수", data: list.map((r) => r.strokes), borderColor: "#e5352b", backgroundColor: "#e5352b", borderDash: [6, 4], pointRadius: 4, tension: 0 },
          { label: "5R 이동평균", data: ma, borderColor: "#1f6fd6", pointRadius: 0, tension: 0.2, noLabels: true },
        ],
      },
      options: baseOpts({ plugins: { legend: { display: true, position: "bottom" } }, scales: { y: { suggestedMin: 75, suggestedMax: 110 }, x: { grid: { display: false } } } }),
      plugins: [valueLabels((v) => v)],
    });
  }

  // ───────────── 라운드 입력/수정 ─────────────
  function inputView(id) {
    const edit = id ? rounds.find((r) => r.id === id) : null;
    const r = edit ? structuredClone(edit) : { date: new Date().toISOString().slice(0, 10), course: "", front: "", back: "", memo: "", holes: [] };
    const hmap = Object.fromEntries((r.holes || []).map((h) => [h.h, h]));
    const courses = [...new Set(rounds.map((x) => x.course))].sort();
    const opt = (vals, cur, blank = "") => `<option value="">${blank}</option>` + vals.map((v) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${v > 0 && typeof v === "number" ? "+" + v : v}</option>`).join("");
    const holeRow = (n) => {
      const h = hmap[n] || {};
      return `<tr data-h="${n}">
        <td class="hn">${n}</td>
        <td><select data-k="par">${opt([3, 4, 5, 6], h.par ?? "")}</select></td>
        <td><select data-k="score" class="sc-cell">${opt([-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8], h.score ?? "")}</select></td>
        <td><select data-k="putts">${opt([0, 1, 2, 3, 4, 5], h.putts ?? "")}</select></td>
        <td><select data-k="tee">${opt(["F", "L", "R"], h.tee ?? "", "-")}</select></td>
        <td><select data-k="pen">${opt([0, 1, 2, 3, 4], h.pen ?? "")}</select></td>
        <td class="det"><input data-k="fp" type="number" inputmode="decimal" step="0.5" min="0" value="${h.fp ?? ""}" style="width:64px"></td>
      </tr>`;
    };
    app.innerHTML = `
      <h2>${edit ? "라운드 수정" : "라운드 입력"}</h2>
      <div class="notice">홀마다 <b>스코어(+/-) · 퍼트 · 티샷(F/L/R) · 벌타</b>만 적으면 GIR·스크램블·3퍼트가 자동 계산됩니다. 퍼트를 비우면 스코어 분석만 합니다.</div>
      <div class="card" style="margin-top:12px">
        <div class="form">
          <label class="f">날짜<input id="fDate" type="date" value="${esc(r.date)}"></label>
          <label class="f">골프장<input id="fCourse" list="courseList" value="${esc(r.course)}" placeholder="예: 기흥CC"></label>
          <label class="f">전반 코스<input id="fFront" value="${esc(r.front)}" placeholder="예: NORTH"></label>
          <label class="f">후반 코스<input id="fBack" value="${esc(r.back)}" placeholder="예: WEST"></label>
        </div>
        <datalist id="courseList">${courses.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
        <div class="row" style="margin-top:10px">
          <button class="btn ghost" id="bPar" type="button">이전 라운드 Par 불러오기</button>
          <label class="row" style="gap:6px;font-size:14px"><input type="checkbox" id="fDet"> 1st 퍼트 거리 입력</label>
        </div>
      </div>
      <div class="tbl-wrap holes-in" style="margin-top:12px"><table>
        <thead><tr><th>홀</th><th>Par</th><th>스코어</th><th>퍼트</th><th>티샷</th><th>벌타</th><th class="det">1st퍼트(m)</th></tr></thead>
        <tbody>
          ${Array.from({ length: 9 }, (_, i) => holeRow(i + 1)).join("")}
          <tr class="sep"><td colspan="7" id="sumFront"></td></tr>
          ${Array.from({ length: 9 }, (_, i) => holeRow(i + 10)).join("")}
          <tr class="sep"><td colspan="7" id="sumBack"></td></tr>
        </tbody>
      </table></div>
      <div class="totals" id="totals"></div>
      <label class="f" style="margin-top:12px">메모<textarea id="fMemo">${esc(r.memo)}</textarea></label>
      <div class="row" style="margin-top:14px">
        <button class="btn" id="bSave" type="button">저장</button>
        <a class="btn ghost" href="${edit ? "#/round/" + esc(edit.id) : "#/rounds"}">취소</a>
      </div>
      <p class="legend-note">티샷: F 페어웨이 / L 왼쪽 미스 / R 오른쪽 미스 (파3은 비움). 퍼트는 그린 위에서 친 것만 셉니다.</p>
    `;
    const tbody = app.querySelector("tbody");
    const detBox = document.getElementById("fDet");
    const hasFp = (r.holes || []).some((h) => isNum(h.fp));
    detBox.checked = hasFp;
    const showDet = () => app.querySelectorAll(".det").forEach((el) => (el.style.display = detBox.checked ? "" : "none"));
    detBox.addEventListener("change", showDet);
    showDet();
    const read = () => {
      const hs = [];
      tbody.querySelectorAll("tr[data-h]").forEach((tr) => {
        const h = { h: Number(tr.dataset.h) };
        tr.querySelectorAll("[data-k]").forEach((el) => {
          const v = el.value;
          if (v === "") return;
          h[el.dataset.k] = el.dataset.k === "tee" ? v : Number(v);
        });
        if (h.par !== 3 || h.tee) {
          /* 파3 티샷은 통계에서 빠지지만 입력값은 그대로 둔다 */
        }
        if (Object.keys(h).length > 1) hs.push(h);
      });
      return hs;
    };
    const paint = () => {
      tbody.querySelectorAll("select[data-k=score]").forEach((el) => {
        el.className = "sc-cell";
        const v = Number(el.value);
        if (el.value === "") return;
        el.classList.add(v <= -1 ? "sc-m2" : v === 0 ? "sc-0" : v === 2 ? "sc-2" : v >= 3 ? "sc-3" : "x");
      });
      const hs = read();
      const half = (a, b) => {
        const x = hs.filter((h) => h.h >= a && h.h <= b);
        const par = S.sum(x.filter((h) => isNum(h.par)).map((h) => h.par));
        const sc = x.filter((h) => isNum(h.score));
        const putts = x.filter((h) => isNum(h.putts));
        return { par, over: S.sum(sc.map((h) => h.score)), strokes: S.sum(sc.filter((h) => isNum(h.par)).map((h) => h.par + h.score)), n: sc.length, putts: S.sum(putts.map((h) => h.putts)) };
      };
      const fr = half(1, 9), bk = half(10, 18);
      document.getElementById("sumFront").textContent = `전반  Par ${fr.par || "-"}  /  타수 ${fr.n ? fr.strokes : "-"} (${fr.n ? sgn(fr.over, 0) : "-"})  /  퍼트 ${fr.putts || "-"}`;
      document.getElementById("sumBack").textContent = `후반  Par ${bk.par || "-"}  /  타수 ${bk.n ? bk.strokes : "-"} (${bk.n ? sgn(bk.over, 0) : "-"})  /  퍼트 ${bk.putts || "-"}`;
      const st = S.round({ date: document.getElementById("fDate").value, holes: hs });
      document.getElementById("totals").innerHTML = `
        <span>입력 홀 <b>${st.holes}</b></span>
        <span>총타수 <b>${st.full ? st.strokes : fr.strokes + bk.strokes || "-"}</b></span>
        <span>오버 <b>${sgn(st.over, 0)}</b></span>
        ${st.detail ? `<span>퍼트 <b>${st.putts}</b></span><span>GIR <b>${st.gir}</b></span><span>3퍼트 <b>${st.p3}</b></span>` : ""}
        <span>더블+ <b>${st.dbl}</b></span>`;
    };
    tbody.addEventListener("change", paint);
    tbody.addEventListener("input", paint);
    paint();
    document.getElementById("bPar").addEventListener("click", () => {
      const c = document.getElementById("fCourse").value.trim();
      const fr = document.getElementById("fFront").value.trim();
      const bk = document.getElementById("fBack").value.trim();
      const prev = S.byRecent(rounds.filter((x) => x.course === c && x.id !== r.id));
      if (!prev.length) return toast("같은 골프장 이전 기록이 없습니다.");
      // 같은 코스명이 전반이든 후반이든 있었으면 그 9홀 Par를 쓴다
      const nine = (name) => {
        for (const p of prev) {
          if (p.front === name) return p.holes.filter((h) => h.h <= 9).map((h) => h.par);
          if (p.back === name) return p.holes.filter((h) => h.h > 9).map((h) => h.par);
        }
        return null;
      };
      const fp = (fr && nine(fr)) || prev[0].holes.filter((h) => h.h <= 9).map((h) => h.par);
      const bp = (bk && nine(bk)) || prev[0].holes.filter((h) => h.h > 9).map((h) => h.par);
      [...fp, ...bp].forEach((p, i) => {
        const el = tbody.querySelector(`tr[data-h="${i + 1}"] select[data-k=par]`);
        if (el && isNum(p)) el.value = String(p);
      });
      paint();
      toast(`${dot(prev[0].date)} 기록에서 Par를 불러왔습니다.`);
    });
    document.getElementById("bSave").addEventListener("click", () => {
      const date = document.getElementById("fDate").value;
      const course = document.getElementById("fCourse").value.trim();
      const hs = read();
      if (!date || !course) return toast("날짜와 골프장을 입력하세요.");
      if (!hs.some((h) => isNum(h.score))) return toast("스코어를 한 홀 이상 입력하세요.");
      const obj = {
        id: edit ? edit.id : "r" + date.replaceAll("-", "") + "-" + Date.now().toString(36),
        date, course,
        front: document.getElementById("fFront").value.trim(),
        back: document.getElementById("fBack").value.trim(),
        memo: document.getElementById("fMemo").value.trim(),
        holes: hs,
      };
      if (edit) rounds[rounds.indexOf(edit)] = obj;
      else rounds.push(obj);
      saveRounds();
      toast("저장했습니다.");
      location.hash = "#/round/" + obj.id;
    });
  }

  // ───────────── 라운드 목록·상세 ─────────────
  function roundsView() {
    const list = S.byRecent(rounds);
    app.innerHTML = `
      <div class="row" style="justify-content:space-between"><h2>라운드 목록 <span class="muted">${list.length}회</span></h2><a class="btn" href="#/input">+ 새 라운드</a></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>날짜</th><th class="l">골프장</th><th>홀</th><th>총타수</th><th>오버</th><th>전반</th><th>후반</th><th>퍼트</th><th>GIR</th><th>더블+</th><th>벌타</th></tr></thead>
        <tbody>${list.map((r) => {
          const s = S.round(r);
          return `<tr class="click" data-id="${esc(r.id)}"><td>${dot(r.date)}</td><td class="l">${esc(r.course)}</td><td>${s.holes}</td><td><b>${s.strokes ?? "-"}</b></td><td>${sgn(s.over, 0)}</td><td>${s.front ?? "-"}</td><td>${s.back ?? "-"}</td><td>${s.detail ? s.putts : "-"}</td><td>${s.detail ? pct(s.girp) : "-"}</td><td>${s.dbl}</td><td>${s.detail && isNum(s.pen) ? s.pen : "-"}</td></tr>`;
        }).join("")}</tbody>
      </table></div>`;
    app.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => (location.hash = "#/round/" + tr.dataset.id)));
  }
  function roundView(id) {
    const r = rounds.find((x) => x.id === id);
    if (!r) { app.innerHTML = `<p>라운드를 찾을 수 없습니다. <a href="#/rounds">목록으로</a></p>`; return; }
    const s = S.round(r);
    const hm = Object.fromEntries(r.holes.map((h) => [h.h, h]));
    const cell = (h, k) => {
      const v = hm[h]?.[k];
      if (k === "score" && isNum(v)) return `<td class="sc-cell ${v <= -1 ? "sc-m2" : v === 0 ? "sc-0" : v === 2 ? "sc-2" : v >= 3 ? "sc-3" : ""}">${v > 0 ? "+" + v : v}</td>`;
      if (k === "gir") { const g = hm[h] ? S.holeGir(hm[h]) : null; return `<td>${g === null ? "" : g ? "●" : "○"}</td>`; }
      return `<td>${v ?? ""}</td>`;
    };
    const half = (a) => {
      const hs = Array.from({ length: 9 }, (_, i) => a + i);
      const line = (lab, k) => `<tr><th class="l">${lab}</th>${hs.map((h) => cell(h, k)).join("")}</tr>`;
      return `<div class="tbl-wrap" style="margin-top:10px"><table>
        <thead><tr><th class="l">홀</th>${hs.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${line("Par", "par")}${line("스코어", "score")}${line("퍼트", "putts")}${line("GIR", "gir")}${line("티샷", "tee")}${line("벌타", "pen")}</tbody></table></div>`;
    };
    app.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <h2>${dot(r.date)} ${esc(r.course)} <span class="muted">${esc([r.front, r.back].filter(Boolean).join(" / "))}</span></h2>
        <div class="row"><a class="btn ghost" href="#/edit/${esc(r.id)}">수정</a><button class="btn danger" id="bDel" type="button">삭제</button></div>
      </div>
      <div class="kpis">
        ${kpi("총타수", s.strokes ?? "-", s.full ? `전반 ${s.front} / 후반 ${s.back}` : `${s.holes}홀 입력`)}
        ${kpi("오버파", sgn(s.over, 0), `버디+ ${s.birdie} / 파 ${s.parn} / 보기 ${s.bogey}`)}
        ${kpi("더블+", s.dbl, `초과타 ${s.blow}`)}
        ${s.detail ? kpi("퍼트", s.putts, `3퍼트 ${s.p3}`) + kpi("GIR", pct(s.girp), `스크램블 ${pct(s.scrp)}`) + kpi("FW", pct(s.fwp), `벌타 ${s.pen ?? "-"}`) : ""}
      </div>
      ${half(1)}${half(10)}
      ${r.memo ? `<p class="card" style="margin-top:12px">${esc(r.memo)}</p>` : ""}
      <p class="legend-note">GIR ● 적중 / ○ 실패 (타수 − 퍼트 ≤ Par − 2, 직접 입력값이 있으면 그 값)</p>
      <div id="delBox"></div>
      <p><a href="#/rounds">← 목록으로</a></p>`;
    document.getElementById("bDel").addEventListener("click", () => {
      document.getElementById("delBox").innerHTML = `<div class="notice">이 라운드를 삭제할까요? <button class="btn danger" id="bDel2" type="button">삭제 확인</button></div>`;
      document.getElementById("bDel2").addEventListener("click", () => {
        rounds = rounds.filter((x) => x.id !== id);
        saveRounds();
        toast("삭제했습니다.");
        location.hash = "#/rounds";
      });
    });
  }

  // ───────────── 통계 ─────────────
  function statsView() {
    const A = S.analyze(rounds, settings);
    const bands = [["70대", 0, 79], ["80대", 80, 89], ["90대", 90, 99], ["100 이상", 100, 999]].map(([l, a, b]) => ({ l, n: A.fulls.filter((r) => r.strokes >= a && r.strokes <= b).length }));
    const years = [...new Set(A.rs.map((r) => r.year))].sort();
    const yr = years.map((y) => {
      const rs = A.rs.filter((r) => r.year === y), fs = rs.filter((r) => r.full);
      return { y, n: rs.length, f: fs.length, c: new Set(rs.map((r) => r.course)).size, avg: S.avg(fs.map((r) => r.strokes)), best: fs.length ? Math.min(...fs.map((r) => r.strokes)) : null, worst: fs.length ? Math.max(...fs.map((r) => r.strokes)) : null };
    });
    const cs = [...new Set(A.recent.map((r) => r.course))].map((c) => {
      const rs = A.rs.filter((r) => r.course === c), fs = rs.filter((r) => r.full);
      return { c, n: rs.length, avg: S.avg(fs.map((r) => r.strokes)), best: fs.length ? Math.min(...fs.map((r) => r.strokes)) : null, last: rs.map((r) => r.date).sort().at(-1) };
    }).sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1));
    app.innerHTML = `
      <h2>스코어 구간 <span class="muted">18홀 ${A.fulls.length}회</span></h2>
      <div class="grid g2">
        <div class="tbl-wrap"><table><thead><tr><th class="l">구간</th><th>라운드</th><th>비율</th></tr></thead>
          <tbody>${bands.map((b) => `<tr><td class="l">${b.l}</td><td>${b.n}</td><td>${pct(A.fulls.length ? b.n / A.fulls.length : null)}</td></tr>`).join("")}</tbody></table></div>
        <div class="card"><div class="chart-box"><canvas id="cBand"></canvas></div></div>
      </div>
      <h2>연도별</h2>
      <div class="tbl-wrap"><table><thead><tr><th>연도</th><th>라운드</th><th>18홀</th><th>골프장 수</th><th>평균 타수</th><th>베스트</th><th>워스트</th></tr></thead>
        <tbody>${yr.map((r) => `<tr><td><b>${r.y}</b></td><td>${r.n}</td><td>${r.f}</td><td>${r.c}</td><td>${f1(r.avg)}</td><td>${r.best ?? "-"}</td><td>${r.worst ?? "-"}</td></tr>`).join("")}</tbody></table></div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h3 style="margin-top:0">연도별 라운드 · 골프장 수</h3><div class="chart-box"><canvas id="cYear"></canvas></div></div>
        <div class="card"><h3 style="margin-top:0">연도별 평균 타수</h3><div class="chart-box"><canvas id="cYearAvg"></canvas></div></div>
      </div>
      <h2>골프장별 <span class="muted">${cs.length}곳</span></h2>
      <div class="tbl-wrap"><table><thead><tr><th class="l">골프장</th><th>방문</th><th>18홀 평균</th><th>베스트</th><th>최근 방문</th></tr></thead>
        <tbody>${cs.map((r) => `<tr><td class="l">${esc(r.c)}</td><td>${r.n}</td><td>${f1(r.avg)}</td><td class="${A.best && r.best === A.best.strokes ? "ng" : ""}">${r.best ?? "-"}</td><td>${dot(r.last)}</td></tr>`).join("")}</tbody></table></div>
    `;
    chart("cBand", { type: "bar", data: { labels: bands.map((b) => b.l), datasets: [{ data: bands.map((b) => b.n), backgroundColor: "#2e7d5b" }] }, options: baseOpts({ scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }), plugins: [valueLabels((v) => v)] });
    chart("cYear", {
      type: "bar",
      data: { labels: yr.map((r) => r.y), datasets: [{ label: "라운드", data: yr.map((r) => r.n), backgroundColor: "#1f6fd6" }, { label: "골프장", data: yr.map((r) => r.c), backgroundColor: "#f28c28" }] },
      options: baseOpts({ plugins: { legend: { display: true, position: "bottom" } }, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }),
      plugins: [valueLabels((v) => v)],
    });
    chart("cYearAvg", { type: "bar", data: { labels: yr.map((r) => r.y), datasets: [{ data: yr.map((r) => r.avg), backgroundColor: "#1e5e3b" }] }, options: baseOpts({ scales: { y: { suggestedMin: 70, grid: { display: false } }, x: { grid: { display: false } } } }), plugins: [valueLabels(f1)] });
  }

  // ───────────── 홀·파 분석 ─────────────
  function holesView() {
    const H = S.holeLevel(rounds);
    const maxO = Math.max(...H.byHole.map((h) => h.over ?? -9)), minO = Math.min(...H.byHole.map((h) => h.over ?? 99));
    app.innerHTML = `
      <h2>파 유형별 <span class="muted">Par가 기록된 ${H.total.n}홀</span></h2>
      <div class="tbl-wrap"><table><thead><tr><th class="l">파 유형</th><th>홀 수</th><th>평균 타수</th><th>평균 오버</th><th>버디+</th><th>파</th><th>보기</th><th>더블</th><th>트리플+</th></tr></thead>
        <tbody>${[3, 4, 5].map((p) => { const x = H.byPar[p]; return `<tr><td class="l"><b>파${p}</b></td><td>${x.n}</td><td>${f2(x.strokes)}</td><td><b>${sgn(x.over)}</b></td><td>${pct(x.birdie)}</td><td>${pct(x.parExact)}</td><td>${pct(x.bogey)}</td><td>${pct(x.double)}</td><td>${pct(x.triple)}</td></tr>`; }).join("")}
        <tr><td class="l"><b>전체</b></td><td>${H.total.n}</td><td>${f2(H.total.strokes)}</td><td><b>${sgn(H.total.over)}</b></td><td>${pct(H.total.birdie)}</td><td>${pct(H.total.parExact)}</td><td>${pct(H.total.bogey)}</td><td>${pct(H.total.double)}</td><td>${pct(H.total.triple)}</td></tr></tbody></table></div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h3 style="margin-top:0">파 유형별 평균 오버</h3><div class="chart-box"><canvas id="cPar"></canvas></div></div>
        <div class="card"><h3 style="margin-top:0">연도별 파 유형 평균 오버</h3><div class="chart-box"><canvas id="cYearPar"></canvas></div></div>
      </div>
      <h2>홀 번호별</h2>
      <div class="card"><div class="chart-box"><canvas id="cHole"></canvas></div>
        <p class="legend-note">골프장마다 홀 구성이 달라 홀 난이도 비교가 아니라, 첫 홀(워밍업)·막판(체력·집중력) 같은 흐름 패턴을 보는 용도입니다. 빨강=가장 약함, 파랑=가장 좋음.</p></div>
      <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>홀</th><th>기록 수</th><th>평균 Par</th><th>평균 타수</th><th>평균 오버</th><th>파 이하</th><th>더블+</th></tr></thead>
        <tbody>${H.byHole.map((x, i) => `<tr><td><b>${i + 1}</b></td><td>${x.n}</td><td>${f1(x.par)}</td><td>${f2(x.strokes)}</td><td class="${x.over === maxO ? "ng" : x.over === minO ? "ok" : ""}"><b>${sgn(x.over)}</b></td><td>${pct(x.parlow)}</td><td>${pct(x.dbl)}</td></tr>`).join("")}</tbody></table></div>
    `;
    chart("cPar", { type: "bar", data: { labels: ["파3", "파4", "파5"], datasets: [{ data: [3, 4, 5].map((p) => H.byPar[p].over), backgroundColor: "#f28c28" }] }, options: baseOpts({ scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }), plugins: [valueLabels(f2)] });
    chart("cYearPar", {
      type: "line",
      data: { labels: H.byYearPar.map((y) => y.year), datasets: [["p3", "파3", "#1f6fd6"], ["p4", "파4", "#2e7d5b"], ["p5", "파5", "#f28c28"]].map(([k, l, c]) => ({ label: l, data: H.byYearPar.map((y) => y[k]), borderColor: c, backgroundColor: c, pointRadius: 4, tension: 0 })) },
      options: baseOpts({ plugins: { legend: { display: true, position: "bottom" } }, scales: { y: { grid: { display: false } }, x: { grid: { display: false } } } }),
      plugins: [valueLabels(f2)],
    });
    chart("cHole", {
      type: "bar",
      data: { labels: H.byHole.map((_, i) => i + 1), datasets: [{ data: H.byHole.map((h) => h.over), backgroundColor: H.byHole.map((h) => (h.over === maxO ? "#e5352b" : h.over === minO ? "#1f6fd6" : "#2e7d5b")) }] },
      options: baseOpts({ scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }),
      plugins: [valueLabels(f1)],
    });
  }

  // ───────────── 설정·데이터 ─────────────
  function settingsView() {
    const tg = settings.targets, rd = settings.radar;
    app.innerHTML = `
      <h2>목표 기준값</h2>
      <div class="tbl-wrap"><table><thead><tr><th class="l">지표</th><th>목표</th><th>방향</th></tr></thead>
        <tbody>${Object.entries(tg).map(([k, t]) => `<tr><td class="l">${t.label}</td><td><input data-t="${k}" type="number" step="${t.fmt === "%" ? 1 : 0.5}" value="${t.fmt === "%" ? Math.round(t.v * 100) : t.v}" style="width:90px"> ${t.fmt === "%" ? "%" : ""}</td><td class="muted">${t.low ? "낮을수록 좋음" : "높을수록 좋음"}</td></tr>`).join("")}</tbody></table></div>
      <h2>육각형 점수 기준 <span class="muted">0점 / 100점</span></h2>
      <div class="tbl-wrap"><table><thead><tr><th class="l">영역</th><th class="l">지표</th><th>0점</th><th>100점</th></tr></thead>
        <tbody>${Object.entries(rd).map(([k, c]) => `<tr><td class="l"><b>${c.label}</b></td><td class="l">${c.metric}</td><td><input data-rz="${k}" type="number" step="0.05" value="${c.zero}" style="width:80px"></td><td><input data-rf="${k}" type="number" step="0.05" value="${c.full}" style="width:80px"></td></tr>`).join("")}
        <tr><td class="l"><b>목표선</b></td><td class="l">육각형 기준선 점수</td><td colspan="2"><input id="rTarget" type="number" value="${settings.radarTarget}" style="width:80px"></td></tr></tbody></table></div>
      <p class="legend-note">기준값은 아마추어 핸디캡별 통계 경향을 참고한 가정값입니다(100점 ≈ 싱글~10 핸디캡, 0점 ≈ 초보). 비율은 0~1로 입력합니다(예: 0.7 = 70%).</p>
      <div class="row" style="margin-top:10px"><button class="btn" id="bSaveSet" type="button">기준값 저장</button><button class="btn ghost" id="bResetSet" type="button">기본값으로</button></div>

      <h2>데이터</h2>
      <div class="notice">입력한 라운드는 <b>이 브라우저에만</b> 저장됩니다. 다른 기기에서 보거나 백업하려면 내보내기 파일을 저장해 두세요. 내보낸 파일로 저장소의 <code>data/rounds.json</code>을 바꾸고 올리면 모든 기기의 기본 데이터가 됩니다.</div>
      <div class="row" style="margin-top:10px">
        <button class="btn" id="bExport" type="button">내보내기 (JSON)</button>
        <label class="btn ghost" style="cursor:pointer">가져오기 (JSON)<input id="fImport" type="file" accept="application/json,.json" hidden></label>
        <button class="btn danger" id="bReset" type="button">원본 데이터로 되돌리기</button>
      </div>
      <div id="resetBox" style="margin-top:10px"></div>
      <p class="muted">현재 ${rounds.length}라운드 저장됨</p>
    `;
    document.getElementById("bSaveSet").addEventListener("click", () => {
      app.querySelectorAll("[data-t]").forEach((el) => { const t = tg[el.dataset.t]; const v = Number(el.value); if (isNum(v)) t.v = t.fmt === "%" ? v / 100 : v; });
      app.querySelectorAll("[data-rz]").forEach((el) => { const v = Number(el.value); if (isNum(v)) rd[el.dataset.rz].zero = v; });
      app.querySelectorAll("[data-rf]").forEach((el) => { const v = Number(el.value); if (isNum(v)) rd[el.dataset.rf].full = v; });
      const rt = Number(document.getElementById("rTarget").value);
      if (isNum(rt)) settings.radarTarget = rt;
      saveSettings();
      toast("기준값을 저장했습니다.");
    });
    document.getElementById("bResetSet").addEventListener("click", () => { settings = structuredClone(S.DEFAULT_SETTINGS); store.del(KEY_SETTINGS); settingsView(); toast("기본값으로 되돌렸습니다."); });
    document.getElementById("bExport").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(S.byRecent(rounds).reverse(), null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `rounds-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    document.getElementById("fImport").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data) || !data.every((r) => r.date && r.course && Array.isArray(r.holes))) throw new Error("형식");
        rounds = data.map((r, i) => ({ ...r, id: r.id || "r" + String(r.date).replaceAll("-", "") + "-i" + i }));
        saveRounds();
        toast(`${rounds.length}라운드를 가져왔습니다.`);
        settingsView();
      } catch {
        toast("가져오기 실패: 라운드 JSON 형식이 아닙니다.");
      }
    });
    document.getElementById("bReset").addEventListener("click", () => {
      document.getElementById("resetBox").innerHTML = `<div class="notice">이 브라우저에 입력한 기록이 모두 지워지고 data/rounds.json으로 되돌아갑니다. 먼저 내보내기로 백업하세요. <button class="btn danger" id="bReset2" type="button">되돌리기 확인</button></div>`;
      document.getElementById("bReset2").addEventListener("click", async () => {
        rounds = await loadOriginal();
        saveRounds();
        toast("원본 데이터로 되돌렸습니다.");
        settingsView();
      });
    });
  }

  init().catch((e) => {
    app.innerHTML = `<div class="notice">데이터를 불러오지 못했습니다. 로컬 파일(file://)로 열었다면 간단한 웹 서버로 열어 주세요. (${esc(e.message)})</div>`;
  });
})();
