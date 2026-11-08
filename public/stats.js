// 데이터 다루기 도우미: CSV 읽기, 자료형 판단, 기술 통계, 상관, 회귀
// (pandas의 read_csv / info / describe / corr, sklearn의 StandardScaler·LinearRegression 역할을 작게 흉내 냄)

window.DS = (() => {
  "use strict";

  // ---------- 읽기 ----------

  // 공공데이터 CSV는 EUC-KR(CP949)인 경우가 많아서 UTF-8로 먼저 읽어 보고 실패하면 EUC-KR로 다시 읽음
  function decode(buf) {
    try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), enc: "UTF-8" }; }
    catch { return { text: new TextDecoder("euc-kr").decode(buf), enc: "EUC-KR" }; }
  }

  function parseCsv(text) {
    const res = Papa.parse(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    const data = res.data.filter((r) => r.some((c) => String(c).trim() !== ""));
    if (data.length < 2) throw new Error("머리글과 데이터가 들어 있는 CSV가 아니에요.");
    const width = Math.max(...data.slice(0, 50).map((r) => r.length));
    const header = data[0].slice(0, width).map((h, i) => String(h).trim() || `열${i + 1}`);
    // 같은 이름의 열이 있으면 뒤에 번호를 붙임
    const seen = {};
    const columns = header.map((h) => (seen[h] = (seen[h] || 0) + 1) > 1 ? `${h}_${seen[h]}` : h);
    const rows = data.slice(1).map((r) => columns.map((_, i) => (r[i] == null ? "" : String(r[i]).trim())));
    return { columns, rows };
  }

  const MISSING = new Set(["", "-", "NA", "N/A", "NaN", "nan", "null", "NULL", "없음", "x", "X", "…"]);
  function toNum(s) {
    if (s == null) return null;
    const t = String(s).trim();
    if (MISSING.has(t)) return null;
    const c = t.replace(/,/g, "").replace(/%$/, "");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(c)) return NaN;
    return Number(c);
  }

  // 각 열을 수치형/범주형으로 나누고 값 배열을 만듦
  function build(ds) {
    const cols = ds.columns.map((name, j) => {
      const raw = ds.rows.map((r) => r[j]);
      const nums = raw.map(toNum);
      const present = nums.filter((v) => v !== null);
      const bad = present.filter((v) => Number.isNaN(v)).length;
      const isNum = present.length > 0 && bad / present.length <= 0.02; // 98% 이상이 숫자면 수치형
      const values = isNum
        ? nums.map((v) => (v === null || Number.isNaN(v) ? null : v))
        : raw.map((v) => (MISSING.has(String(v).trim()) ? null : String(v)));
      const isDate = !isNum && values.filter(Boolean).slice(0, 30).every((v) => /^\d{4}[-./]\d{1,2}([-./]\d{1,2})?/.test(v));
      return { name, type: isNum ? "num" : isDate ? "date" : "text", values };
    });
    return { n: ds.rows.length, cols, byName: Object.fromEntries(cols.map((c) => [c.name, c])) };
  }

  // ---------- 전처리 ----------
  // opts: { drop: [열이름], missing: "none"|"drop"|"mean", scale: "none"|"z"|"minmax", scaleCols: [열이름] }
  function preprocess(tbl, opts) {
    let cols = tbl.cols.filter((c) => !(opts.drop || []).includes(c.name));
    let keep = [...Array(tbl.n).keys()];
    const log = [];
    if ((opts.drop || []).length) log.push(`열 ${opts.drop.length}개 제외 (${opts.drop.join(", ")})`);
    if (opts.missing === "drop") {
      const before = keep.length;
      keep = keep.filter((i) => cols.every((c) => c.values[i] != null));
      log.push(`결측치가 있는 행 ${before - keep.length}개 삭제`);
    }
    cols = cols.map((c) => ({ ...c, values: keep.map((i) => c.values[i]) }));
    if (opts.missing === "mean") {
      let filled = 0;
      cols = cols.map((c) => {
        if (c.type !== "num") return c;
        const m = mean(c.values.filter((v) => v != null));
        return { ...c, values: c.values.map((v) => (v == null ? (filled++, m) : v)) };
      });
      log.push(`수치형 결측치 ${filled}개를 평균으로 채움`);
    }
    if (opts.scale && opts.scale !== "none") {
      const targets = new Set(opts.scaleCols || []);
      cols = cols.map((c) => {
        if (c.type !== "num" || !targets.has(c.name)) return c;
        const v = c.values.filter((x) => x != null);
        if (opts.scale === "z") {
          const m = mean(v), s = std(v, 0);
          return { ...c, scaled: "z", values: c.values.map((x) => (x == null ? null : s ? (x - m) / s : 0)) };
        }
        const lo = Math.min(...v), hi = Math.max(...v);
        return { ...c, scaled: "minmax", values: c.values.map((x) => (x == null ? null : hi > lo ? (x - lo) / (hi - lo) : 0)) };
      });
      if (targets.size) log.push(`${targets.size}개 열 ${opts.scale === "z" ? "표준화(평균 0, 표준편차 1)" : "최소-최대 정규화(0~1)"}`);
    }
    return { n: keep.length, cols, byName: Object.fromEntries(cols.map((c) => [c.name, c])), log };
  }

  // ---------- 통계 ----------

  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : NaN);
  function std(a, ddof = 1) {
    if (a.length - ddof <= 0) return NaN;
    const m = mean(a);
    return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - ddof));
  }
  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
  }
  // pandas describe()와 같은 항목
  function describe(col) {
    const v = col.values.filter((x) => x != null);
    const s = v.slice().sort((a, b) => a - b);
    return {
      count: v.length, mean: mean(v), std: std(v), min: s[0],
      q1: quantile(s, 0.25), median: quantile(s, 0.5), q3: quantile(s, 0.75), max: s[s.length - 1],
    };
  }
  function freq(col) {
    const m = new Map();
    for (const v of col.values) if (v != null) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  function pairs(a, b) {
    const pts = [];
    for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) pts.push([a[i], b[i]]);
    return pts;
  }
  function pearson(a, b) {
    const pts = pairs(a, b);
    const n = pts.length;
    if (n < 3) return null;
    const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    if (!sxx || !syy) return null;
    return { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, b: my - (sxy / sxx) * mx, n };
  }
  function corrWord(r) {
    const a = Math.abs(r);
    if (a < 0.2) return "상관관계가 거의 없음";
    const s = a >= 0.7 ? "강한" : a >= 0.4 ? "뚜렷한" : "약한";
    return `${s} ${r > 0 ? "양(+)의" : "음(-)의"} 상관관계`;
  }

  // 히스토그램 구간 (스터지스 공식)
  function histogram(values, bins) {
    const v = values.filter((x) => x != null);
    if (!v.length) return { labels: [], counts: [], edges: [] };
    const lo = Math.min(...v), hi = Math.max(...v);
    const k = bins || Math.min(30, Math.max(5, Math.ceil(Math.log2(v.length) + 1)));
    const w = (hi - lo) / k || 1;
    const counts = Array(k).fill(0);
    for (const x of v) counts[Math.min(k - 1, Math.floor((x - lo) / w))]++;
    const edges = [...Array(k + 1).keys()].map((i) => lo + i * w);
    return { counts, edges };
  }

  // 상자 그림용 다섯 수치 + 이상치(1.5 IQR)
  function fiveNum(values) {
    const s = values.filter((x) => x != null).sort((a, b) => a - b);
    if (!s.length) return null;
    const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1;
    const lf = q1 - 1.5 * iqr, uf = q3 + 1.5 * iqr;
    const inside = s.filter((x) => x >= lf && x <= uf);
    return {
      min: s[0], max: s[s.length - 1], q1, med: quantile(s, 0.5), q3,
      lo: inside[0] ?? q1, hi: inside[inside.length - 1] ?? q3,
      outliers: s.filter((x) => x < lf || x > uf),
    };
  }

  // ---------- 회귀 ----------

  // 시드가 있는 난수 (같은 시드면 항상 같은 분할 → random_state 역할)
  function rng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function split(n, testRatio, seed) {
    const idx = [...Array(n).keys()];
    const rand = rng(seed);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const nt = Math.round(n * testRatio);
    return { test: idx.slice(0, nt), train: idx.slice(nt) };
  }

  // 최소제곱법 다중 선형 회귀: (XᵀX)β = Xᵀy 를 가우스 소거로 풂
  function ols(X, y) {
    const p = X[0].length + 1;
    const A = Array.from({ length: p }, () => Array(p + 1).fill(0));
    for (let i = 0; i < X.length; i++) {
      const row = [1, ...X[i]];
      for (let a = 0; a < p; a++) {
        for (let b = 0; b < p; b++) A[a][b] += row[a] * row[b];
        A[a][p] += row[a] * y[i];
      }
    }
    for (let c = 0; c < p; c++) {
      let piv = c;
      for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) throw new Error("독립 변수끼리 너무 비슷하거나(다중공선성) 값이 모두 같은 열이 있어요.");
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = 0; r < p; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
      }
    }
    return A.map((row, i) => row[p] / A[i][i]); // [절편, 계수1, 계수2, ...]
  }
  const predict = (beta, x) => beta[0] + x.reduce((s, v, i) => s + v * beta[i + 1], 0);
  function r2(y, yhat) {
    const m = mean(y);
    const ssr = sum(y.map((v, i) => (v - yhat[i]) ** 2));
    const sst = sum(y.map((v) => (v - m) ** 2));
    return sst ? 1 - ssr / sst : NaN;
  }
  const rmse = (y, yhat) => Math.sqrt(mean(y.map((v, i) => (v - yhat[i]) ** 2)));

  function regress(tbl, xNames, yName, { testRatio = 0.3, seed = 1234 } = {}) {
    const xs = xNames.map((n) => tbl.byName[n].values);
    const yv = tbl.byName[yName].values;
    const ok = [];
    for (let i = 0; i < tbl.n; i++) if (yv[i] != null && xs.every((c) => c[i] != null)) ok.push(i);
    if (ok.length < xNames.length + 5) throw new Error(`결측치가 없는 행이 ${ok.length}개뿐이라 회귀 분석을 하기에 부족해요.`);
    const sp = testRatio > 0 ? split(ok.length, testRatio, seed) : { train: [...ok.keys()], test: [] };
    const pick = (ids) => ({ X: ids.map((k) => xs.map((c) => c[ok[k]])), y: ids.map((k) => yv[ok[k]]), rows: ids.map((k) => ok[k]) });
    const tr = pick(sp.train), te = pick(sp.test);
    const beta = ols(tr.X, tr.y);
    const trHat = tr.X.map((x) => predict(beta, x));
    const teHat = te.X.map((x) => predict(beta, x));
    return {
      beta, xNames, yName, nUsed: ok.length, nTrain: tr.y.length, nTest: te.y.length,
      r2Train: r2(tr.y, trHat), r2Test: te.y.length > 2 ? r2(te.y, teHat) : null,
      rmseTrain: rmse(tr.y, trHat), rmseTest: te.y.length ? rmse(te.y, teHat) : null,
      test: te.y.map((y, i) => ({ y, yhat: teHat[i] })),
      train: tr.y.map((y, i) => ({ y, yhat: trHat[i] })),
    };
  }

  return { decode, parseCsv, build, preprocess, mean, std, describe, freq, pearson, corrWord, histogram, fiveNum, regress, predict, toNum };
})();
