/* 웹 화면(저장소 루트)을 www/로 복사하고, 오프라인에서도 차트가 뜨도록 Chart.js를 앱 안에 넣는다. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(__dirname, "www");
fs.rmSync(WWW, { recursive: true, force: true });
for (const p of ["index.html", "css", "js", "data"]) fs.cpSync(path.join(ROOT, p), path.join(WWW, p), { recursive: true });

const CHART_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
(async () => {
  const res = await fetch(CHART_CDN);
  if (!res.ok) throw new Error("Chart.js 다운로드 실패 " + res.status);
  fs.mkdirSync(path.join(WWW, "js/vendor"), { recursive: true });
  fs.writeFileSync(path.join(WWW, "js/vendor/chart.umd.min.js"), Buffer.from(await res.arrayBuffer()));
  const idx = path.join(WWW, "index.html");
  const html = fs.readFileSync(idx, "utf8").replace(CHART_CDN, "js/vendor/chart.umd.min.js");
  if (!html.includes("js/vendor/chart.umd.min.js")) throw new Error("index.html의 Chart.js 경로를 바꾸지 못했습니다");
  fs.writeFileSync(idx, html);
  console.log("www 준비 완료");
})().catch((e) => { console.error(e); process.exit(1); });
