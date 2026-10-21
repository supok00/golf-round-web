/* 골프 라운드 통계 계산 — 「골프 라운드 분석_v2.xlsx」 수식과 같은 정의를 쓴다.
 * 홀 데이터: { h, par, score(+/-), putts, tee: 'F'|'L'|'R', pen, fp(1st 퍼트 m), gir(직접 입력 1/0) }
 */
const GolfStats = (() => {
  const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const avg = (a) => (a.length ? sum(a) / a.length : null);

  const DEFAULT_SETTINGS = {
    // 레이더 0점/100점 기준 (v2 기준값 시트와 동일)
    radar: {
      fw: { label: "드라이빙", metric: "FW 안착률", zero: 0.2, full: 0.7 },
      gir: { label: "아이언", metric: "GIR 비율", zero: 0, full: 0.7 },
      scr: { label: "숏게임", metric: "스크램블", zero: 0, full: 0.6 },
      pph: { label: "퍼팅", metric: "홀당 퍼트", zero: 2.4, full: 1.75 },
      fp: { label: "거리감", metric: "1st 퍼트 거리(m)", zero: 15, full: 5 },
      crisis: { label: "위기관리", metric: "18홀당 벌타+더블+ 초과타", zero: 12, full: 0 },
    },
    radarTarget: 70,
    // 목표 (간편 기록 v1 기준값과 동일). low: 낮을수록 좋음
    targets: {
      strokes: { label: "평균 타수", v: 89, low: true, fmt: "1" },
      parlow: { label: "파 이하 홀 수", v: 6, low: false, fmt: "1" },
      dbl: { label: "더블보기+ 홀 수", v: 3, low: true, fmt: "1" },
      putts: { label: "퍼트 수", v: 33, low: true, fmt: "1" },
      p3: { label: "3퍼트 수", v: 2, low: true, fmt: "1" },
      girp: { label: "GIR", v: 0.25, low: false, fmt: "%" },
      fwp: { label: "FW 안착", v: 0.5, low: false, fmt: "%" },
      scrp: { label: "스크램블", v: 0.25, low: false, fmt: "%" },
      pen: { label: "벌타", v: 2, low: true, fmt: "1" },
    },
  };
  // 목표 지표가 18홀 기준인지(full) 상세 기록 기준인지(detail)
  const TARGET_BASIS = { strokes: "full", parlow: "full", dbl: "full", putts: "detail", p3: "detail", girp: "detail", fwp: "detail", scrp: "detail", pen: "detail" };

  function holeGir(h) {
    if (isNum(h.gir)) return h.gir ? 1 : 0;
    if (isNum(h.putts) && isNum(h.par) && isNum(h.score)) return h.par + h.score - h.putts <= h.par - 2 ? 1 : 0;
    return null;
  }

  function round(r) {
    const hs = (r.holes || []).filter((h) => isNum(h.score));
    const n = hs.length;
    const parsOk = hs.every((h) => isNum(h.par));
    const full = n === 18 && parsOk;
    const s = (h) => h.score;
    const out = {
      id: r.id, date: r.date, year: Number(String(r.date).slice(0, 4)), course: r.course, holes: n, full,
      over: sum(hs.map(s)),
      strokes: full ? sum(hs.map((h) => h.par + h.score)) : null,
      front: full ? sum(hs.filter((h) => h.h <= 9).map((h) => h.par + h.score)) : null,
      back: full ? sum(hs.filter((h) => h.h > 9).map((h) => h.par + h.score)) : null,
      birdie: hs.filter((h) => h.score <= -1).length,
      parn: hs.filter((h) => h.score === 0).length,
      bogey: hs.filter((h) => h.score === 1).length,
      double: hs.filter((h) => h.score === 2).length,
      triple: hs.filter((h) => h.score >= 3).length,
      blow: sum(hs.map((h) => Math.max(0, h.score - 1))),
    };
    out.dbl = out.double + out.triple;
    out.parlow = out.birdie + out.parn;
    const pt = hs.filter((h) => isNum(h.putts));
    out.detail = pt.length > 0 && pt.length >= n;
    if (out.detail) {
      out.putts = sum(pt.map((h) => h.putts));
      out.p3 = pt.filter((h) => h.putts >= 3).length;
      out.p3loss = sum(pt.map((h) => Math.max(0, h.putts - 2)));
      out.pph = out.putts / pt.length;
      const g = pt.map(holeGir);
      out.gir = sum(g.map((v) => v || 0));
      out.girp = out.gir / pt.length;
      const miss = pt.filter((h) => holeGir(h) === 0);
      out.scrOp = miss.length;
      out.scrOk = miss.filter((h) => h.score <= 0).length;
      out.scrp = miss.length ? out.scrOk / miss.length : null;
      out.scrFail = out.scrOp - out.scrOk;
      const pens = hs.filter((h) => isNum(h.pen));
      out.pen = pens.length ? sum(pens.map((h) => h.pen)) : null;
      const fps = hs.filter((h) => isNum(h.fp) && h.fp > 0).map((h) => h.fp);
      out.fp = avg(fps);
      out.crisis = n ? ((out.pen || 0) + out.blow) * 18 / n : null;
    }
    const tees = hs.filter((h) => h.tee === "F" || h.tee === "L" || h.tee === "R");
    out.fw = tees.filter((h) => h.tee === "F").length;
    out.teeL = tees.filter((h) => h.tee === "L").length;
    out.teeR = tees.filter((h) => h.tee === "R").length;
    out.fwp = tees.length ? out.fw / tees.length : null;
    for (const p of [3, 4, 5]) {
      const a = hs.filter((h) => h.par === p).map(s);
      out["p" + p + "avg"] = avg(a);
    }
    return out;
  }

  function radarScore(key, v, settings) {
    if (!isNum(v)) return null;
    const c = settings.radar[key];
    const x = ((v - c.zero) / (c.full - c.zero)) * 100;
    return Math.round(Math.max(0, Math.min(100, x)));
  }

  // 최근 순위: 날짜 내림차순(같은 날짜면 나중에 입력한 것이 최근)
  function byRecent(list) {
    return list.map((x, i) => ({ x, i })).sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : b.i - a.i)).map((o) => o.x);
  }

  function analyze(rounds, settings) {
    const rs = rounds.map(round);
    const recent = byRecent(rs);
    const fulls = recent.filter((r) => r.full);
    const dets = recent.filter((r) => r.detail);
    const pick = (list, k) => list.map((r) => r[k]).filter(isNum);
    const metric = (key) => {
      const list = TARGET_BASIS[key] === "full" ? fulls : dets;
      const all = avg(pick(list, key));
      const r5 = avg(pick(list.slice(0, 5), key));
      const last = list.length ? list[0][key] : null;
      return { all, r5, last, n: list.length };
    };
    const best = fulls.length ? fulls.reduce((b, r) => (r.strokes < b.strokes ? r : b)) : null;
    // 레이더: 최근 상세 5라운드 평균 지표
    const d5 = dets.slice(0, 5);
    const radarRaw = {
      fw: avg(pick(d5, "fwp")), gir: avg(pick(d5, "girp")), scr: avg(pick(d5, "scrp")),
      pph: avg(pick(d5, "pph")), fp: avg(pick(d5, "fp")), crisis: avg(pick(d5, "crisis")),
    };
    const radar = Object.fromEntries(Object.keys(settings.radar).map((k) => [k, radarScore(k, radarRaw[k], settings)]));
    const loss = [
      ["벌타", "pen"], ["3퍼트 손실타", "p3loss"], ["스크램블 실패(홀)", "scrFail"], ["더블+ 초과타", "blow"],
    ].map(([label, k]) => ({ label, all: avg(pick(dets, k)), r5: avg(pick(d5, k)) }));
    return { rs, recent, fulls, dets, best, metric, radar, radarRaw, loss, courses: new Set(rs.map((r) => r.course)).size };
  }

  // 홀 단위 집계 (Par가 있는 모든 홀)
  function holeLevel(rounds) {
    const all = [];
    for (const r of rounds) for (const h of r.holes || []) if (isNum(h.score) && isNum(h.par)) all.push({ ...h, year: Number(String(r.date).slice(0, 4)) });
    const agg = (hs) => ({
      n: hs.length,
      par: avg(hs.map((h) => h.par)),
      over: avg(hs.map((h) => h.score)),
      strokes: avg(hs.map((h) => h.par + h.score)),
      parlow: hs.length ? hs.filter((h) => h.score <= 0).length / hs.length : null,
      bogey: hs.length ? hs.filter((h) => h.score === 1).length / hs.length : null,
      dbl: hs.length ? hs.filter((h) => h.score >= 2).length / hs.length : null,
      birdie: hs.length ? hs.filter((h) => h.score <= -1).length / hs.length : null,
      parExact: hs.length ? hs.filter((h) => h.score === 0).length / hs.length : null,
      double: hs.length ? hs.filter((h) => h.score === 2).length / hs.length : null,
      triple: hs.length ? hs.filter((h) => h.score >= 3).length / hs.length : null,
    });
    const byPar = Object.fromEntries([3, 4, 5].map((p) => [p, agg(all.filter((h) => h.par === p))]));
    const byHole = Array.from({ length: 18 }, (_, i) => agg(all.filter((h) => h.h === i + 1)));
    const years = [...new Set(all.map((h) => h.year))].sort();
    const byYearPar = years.map((y) => ({
      year: y,
      ...Object.fromEntries([3, 4, 5].map((p) => ["p" + p, agg(all.filter((h) => h.year === y && h.par === p)).over])),
      all: agg(all.filter((h) => h.year === y)).over,
    }));
    return { total: agg(all), byPar, byHole, byYearPar };
  }

  return { DEFAULT_SETTINGS, TARGET_BASIS, round, analyze, holeLevel, holeGir, byRecent, isNum, avg, sum };
})();
