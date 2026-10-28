# 기관 문서 재확인 및 실키 시험

확인 기준일: 2026-10-28. 발급된 실사용 키는 제공되지 않았다. 아래 미확정 부분은 자동 응답을 꾸미는 대신 오류·공란·수동 경로로 처리한다. 코드 검색어: `기관 문서로 사양 재확인할 곳`.

| 항목 | 구현 | 기관 인증 후 확인할 내용 | 미확인 시 동작 |
|---|---|---|---|
| 카카오 주소 검색 | `/v2/local/search/address.json`, Authorization 헤더, PNU 조립 | 무료 쿼터 적용 앱, REST 권한·필지 반환, mountain_yn | 주소 수동 입력, 좌표 빈칸 |
| 카카오 지도 | 일반·HYBRID·로드뷰 3단 | JS 도메인, 지도 활성화, 실제 로드뷰 존재 | 지도 안내 유지 |
| 건축HUB | 명시된 4개 오퍼레이션, 시군구·법정동·산·본부번 | 승인된 서비스 경로, JSON body/header, totalCount, 건물·층별 식별자 | 오류를 나대지로 변경하지 않음 |
| 건축물 변동사항 | 사용자 자료 입력란·PDF 표 | 현재 제공되는 전용 공개 서비스의 존재·명세 | 자동 API 미생성, 공란 |
| VWorld NED | 인수인계서 3개 서비스 | 서비스별 래퍼, totalCount/totalCnt, pnu, 도로접면/면적/공시지가·기준연월 필드, 검색 연도 범위 | 구조가 다르면 실패. 현재 연도 값으로 추정하지 않음 |
| 연속지적도 | LP_PA_CBND_BUBUN, bbox, EPSG:4326 | 요청 버전·페이지·총수 및 지목 속성 | 실제 GeoJSON 입력 가능 |
| 주변 건물 | 환경변수로 검증된 레이어/필드 지정 | 현재 서비스 ID, 건물 윤곽, 실측 높이/지상층수 의미·단위 | 빈 레이어·수동 GeoJSON, 층수로 높이 계산 시 가정 표시 |
| 국가법령 | eflaw 목록 nw=3, 시행일 검사, ID 또는 MST+efYd 본문 | 인증값·HTTPS 접근, 최신 응답/조문 구조 | 현행 미수신, 기준표 수치 미대입 |
| 자치법규 | ordin 목록 nw=1, 제목 기반 조문 탐색 | 해당 자치단체의 조례 정확명칭, 별표 제공 여부 | 시 조례/국가 현행 상한 또는 공란. 구 조례 임의 생성 없음 |
| 토지이음 필지 링크 | EUM_PARCEL_URL_TEMPLATE 선택 설정 | 실제 필지로 이동하는 현재 URL·PNU 자리 | 일반 토지이음 링크·PNU 복사 제공 |
| DEM | AWS Terrarium z12 PNG, R×256+G+B/256−32768 | 실제 타일 응답·출처별 정밀도·표고 기준 | 지형 없는 DAE와 주석 |

## 수정 지점

`src/worker.js`는 기관 응답을 허용 필드만으로 정리한다. 응답 사양이 바뀌면 오퍼레이션, 허용 필드, 전체 개수와 페이지 처리부터 수정하고 시험 응답을 익명화하여 단위 시험에 추가한다. 모르는 필드명을 후보 목록으로 무한 추측하지 않는다. 원본 대장을 그대로 브라우저에 전달하거나 저장하지 않는다.

토지 분류의 법령 정보가 응답에 없으면 국토계획법 구역/다른 법령 구역을 단정하지 않는다. 수동 분류 형식은 `국토계획 | 지역명 | 법령명 | 행위제한 근거`, `다른법령 | …`, `제9조제4항 | …`이다. 원자료에 없는 행위제한은 빨간색이다.

현재 조례 조회는 정확한 자치단체 이름 및 도시계획·군계획·건축·주차장 조례명 조합을 사용한다. 그 지자체가 다른 조례명을 쓰면 검색 후보에 기관 확인 이름을 추가한다. 검색 결과에서 다른 지역/유사 명칭을 자동 채택하지 않는다. 정확한 일치가 없으면 수동 경로로 남긴다.

## 실사용 절차

실제 승인키로 한 기관씩 연결한다. 개발자 도구에서 상태 코드를 확인하되 키가 들어 있는 upstream URL을 로그·스크린샷으로 남기지 않는다. 수집 시각과 법령 시행일을 기록한다. 0건, 인증 실패, 통신 실패, 구조 해석 실패를 각각 재현한다. 100건 이상 층별 자료는 다음 페이지가 누락되지 않는지 확인한다. 총수 필드를 못 읽은 응답을 첫 페이지만 완전 수집된 것으로 처리하지 않는다.

`EUM_PARCEL_URL_TEMPLATE`은 https 및 토지이음 도메인으로 제한한다. 임의 외부 URL 중계는 구현하지 않는다. 등록되지 않은 VWorld 건물 레이어를 환경변수에 임의 대입하지 않는다.

## 공식 근거

- 카카오: https://developers.kakao.com/docs/ko/kakaomap/rest-api
- 지도: https://apis.map.kakao.com/web/guide/
- 건축HUB: https://www.data.go.kr/data/15134735/openapi.do
- VWorld: https://www.vworld.kr
- 현행 시행일 목록: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdListGuide
- 현행 시행일 본문: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdInfoGuide
- 자치법규 목록: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=ordinListGuide
- 자치법규 본문: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=ordinInfoGuide
- DEM: https://registry.opendata.aws/terrain-tiles/

이 문서는 연결 명세 재확인 목록이며 특정 필지의 현행 법적 판단서가 아니다.
