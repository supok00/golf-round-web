# 골프 라운드 분석 (웹)

「골프 라운드 분석_v2.xlsx」를 웹으로 옮긴 정적 페이지입니다. GitHub Pages로 배포합니다.

## 기능
- **대시보드**: 등록 라운드·베스트·평균·최근 5R, 목표 대비 실력 진단, 6영역 육각형, 타수 손실 원인, 강점·약점, 타수 추이
- **라운드 입력**: v2 스코어카드 전 항목을 한 홀씩 입력
  - 기본: Par, Score(+/-), Putts, 벌타 / 코스 정보: 거리, 핸디캡
  - 티샷: FW 안착 ○/×, 티샷 미스(L/R/H/S/-), 티샷 거리 / 그린: 온그린 타수, GIR 직접, 1st 퍼트 거리
  - 숏게임: 그린 미스(짧음/길음/좌/우), 어프로치 거리, 벙커샷, 숏게임 성공 ○/× / 홀 메모
  - 라운드: 날짜, 골프장, 전·후반 코스, 티, 날씨·컨디션·메모
  - 같은 골프장 이전 라운드에서 Par·거리·핸디캡 불러오기, 입력 중 내용은 기기에 임시 저장
- **라운드 목록/상세**: v2 스코어카드와 같은 OUT/IN 카드, 수정·삭제
- **통계 / 홀·파 분석 / 상세 분석**: 연도·골프장별, 파 유형·홀 번호별, v2 「상세분석」 7개 블록(FW·GIR·1st 퍼트 거리대·파 유형·티샷 미스·핸디캡·그린 미스/어프로치)
- **설정**: GitHub 토큰, 목표값·육각형 기준

## 데이터 저장 방식 — GitHub 저장소가 원본
- 라운드는 이 저장소의 `data/rounds.json`, 기준값은 `data/settings.json`에 저장됩니다.
- **보기**: 페이지가 GitHub API로 최신 파일을 읽습니다. 다른 기기에서 저장해도 새로고침하면 바로 보입니다.
  (API 한도 시간당 60회/IP를 넘으면 Pages 배포본을 읽으며, 이때는 몇 분 늦을 수 있습니다.)
- **저장**: 입력하는 기기에서 한 번만 설정 → GitHub 토큰을 넣습니다. 저장할 때마다 커밋이 하나씩 생기므로 변경 이력이 남습니다.
- 토큰 만들기: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
  - Repository access: Only select repositories → `golf-round-web`
  - Repository permissions → **Contents: Read and write** (나머지는 그대로), 만료 90일 권장
- 토큰은 그 브라우저(localStorage)에만 저장됩니다. 공용 PC에서는 넣지 말고, 보기만 하는 기기에는 필요 없습니다.

## 로컬에서 보기
`fetch`를 쓰므로 파일을 더블클릭(file://)하면 데이터가 안 읽힙니다. 간단한 서버로 엽니다.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## GitHub Pages 배포
1. GitHub에서 새 저장소 생성 (예: `golf-round-web`)
2. 이 폴더에서
   ```bash
   git remote add origin https://github.com/<계정>/golf-round-web.git
   git push -u origin main
   ```
3. 저장소 Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save
4. 1~2분 뒤 `https://<계정>.github.io/golf-round-web/` 에서 확인

> 공개 저장소의 Pages는 누구나 볼 수 있습니다. `data/rounds.json`(날짜·골프장·스코어)이 공개되는 점을 감안하세요.
