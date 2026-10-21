# 골프 라운드 분석 (웹)

「골프 라운드 분석_v2.xlsx」를 웹으로 옮긴 정적 페이지입니다. GitHub Pages로 배포합니다.

## 기능
- **대시보드**: 등록 라운드·베스트·평균·최근 5R, 목표 대비 실력 진단, 6영역 육각형, 타수 손실 원인, 강점·약점, 타수 추이
- **라운드 입력**: 홀마다 Par·스코어(+/-)·퍼트·티샷(F/L/R)·벌타 (선택: 1st 퍼트 거리). 같은 골프장 이전 Par 불러오기
- **라운드 목록/상세**: 스코어카드, 수정·삭제
- **통계**: 스코어 구간, 연도별, 골프장별
- **홀·파 분석**: 파3/4/5, 홀 번호별, 연도별 파 유형
- **설정·데이터**: 목표값·육각형 기준 조정, JSON 내보내기/가져오기

## 데이터 저장 방식
- GitHub Pages는 서버가 없어서, 입력한 라운드는 **그 브라우저(localStorage)** 에 저장됩니다.
- 처음 열면 `data/rounds.json`(엑셀 v2에서 옮긴 44라운드)을 불러옵니다.
- 다른 기기와 맞추려면: 설정 → 내보내기 → 받은 파일로 `data/rounds.json` 교체 → commit/push.
  (이미 데이터가 저장된 브라우저는 설정 → 원본 데이터로 되돌리기를 누르면 새 rounds.json을 다시 읽습니다.)

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
