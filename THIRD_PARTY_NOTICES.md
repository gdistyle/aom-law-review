# 외부 구성요소·데이터·제공 자산

## JSZip 3.10.1

로컬 배포: `public/vendor/jszip-3.10.1.min.js`. MIT 또는 GPLv3 선택 라이선스 중 MIT 조건에 따라 사용한다. 저작권과 전체 고지는 `public/vendor/JSZip-LICENSE.txt`에 보관한다. 프로젝트: https://github.com/Stuk/jszip.

## three.js 0.180.0 / OrbitControls

CDN의 정확한 패키지 버전을 사용한다. MIT 라이선스. 프로젝트: https://github.com/mrdoob/three.js/tree/r180. 라이선스: https://github.com/mrdoob/three.js/blob/r180/LICENSE. 앱은 해당 라이브러리 파일을 저장소에 복제하지 않고 런타임에 불러온다. CDN 미수신 시 자체 Canvas 표시 경로를 사용한다.

## Kakao Maps SDK

기관이 제공하는 동적 JavaScript SDK를 사용한다. 별도 버전 URL을 기관이 제공하지 않는 이 SDK에 임의 버전 번호를 붙이지 않는다. 이용약관·도메인·쿼터 정책은 카카오의 현행 안내를 따른다. https://apis.map.kakao.com/web/guide/.

## 원본 도장 도구와 문서 자산

사용자가 제공한 도장 HTML, 문서 틀, 로고의 권리는 원권리자에게 있다. 도장 HTML은 변경하지 않았으며 외부 Google Fonts와 원본의 글꼴·출력 기능을 그대로 유지한다. 이 저장소는 해당 제공 자산에 임의로 새로운 오픈소스 라이선스를 부여하지 않는다. 글꼴 파일은 포함하지 않는다.

## 기관 데이터

브이월드·건축HUB·카카오·국가법령정보 공동활용의 실제 데이터는 각 기관 이용조건에 따른다. 저장소는 실기관 조회 결과를 내장하지 않는다. 시험 fixture는 사용자가 제공한 비개인 건물 제원만 포함하고 실제 조회에 대입하지 않는다.

## 공개 표고자료

Terrain Tiles — Mapzen / Linux Foundation project, AWS Registry of Open Data. 원천 데이터별 기여·라이선스: https://github.com/tilezen/joerd/blob/master/docs/attribution.md. 목록: https://registry.opendata.aws/terrain-tiles/. 지형을 내려받을 때 조회일시와 데이터 출처를 ZIP의 출처목록에 기록한다. AWS 계정·비밀키를 요구하지 않는다.

## 개발·시험 도구

Wrangler 4.151.0은 공식 패키지 배포본을 npx로 실행하며 코드 ZIP에 복제하지 않는다. Python Playwright·PyMuPDF는 선택 검수 의존성이며 웹사이트 운영 의존성이 아니다. 해당 패키지의 라이선스는 각 프로젝트 배포본을 따른다. 정적 화면 배포에 Python, Office, LibreOffice, LLM API는 필요 없다.
