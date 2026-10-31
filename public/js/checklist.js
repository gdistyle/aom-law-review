/* 규모별 검토 항목 — 법정 최대 규모(또는 입력 층수·면적)로 건축한다고 가정했을 때의 절차·설비 대상 여부.
   규칙 판정(현행 원문 자동 대조 전)이므로 화면·문서에서 빨간 글씨로 표시한다. */

const has = (s, re) => re.test(String(s || ''));

/**
 * @param {{zone?:string, purpose?:string, floors?:number|null, gross?:number|null, footprint?:number|null}} x
 * @returns {Array<{item:string, result:string, basis:string, law:string}>}
 */
export function scaleChecklist({zone = '', purpose = '', floors = null, gross = null} = {}) {
  const out = [], f = Number(floors) || 0, g = Number(gross) || 0;
  const house = has(purpose, /단독주택|공동주택/) || !purpose;
  const nonUrban = has(zone, /관리지역|농림지역|자연환경보전/);
  const residential = has(zone, /전용주거|일반주거/);

  // 건축허가·신고
  if (zone) {
    const report = nonUrban && g > 0 && g < 200 && f > 0 && f < 3;
    out.push({item: '건축허가 · 신고', result: report ? '건축신고 가능 범위' : '건축허가 대상',
      basis: report ? '관리·농림·자연환경보전지역 안 연면적 200㎡ 미만·3층 미만 건축 (지구단위계획구역 등 제외)' : '건축신고 대상 규모·지역 요건에 해당하지 않음',
      law: '「건축법」 제11조 · 제14조'});
  }
  // 구조안전 확인
  if (f || g) {
    const yes = f >= 2 || g >= 200 || has(purpose, /단독주택|공동주택/);
    out.push({item: '구조안전 확인 · 내진설계', result: yes ? '대상' : '대상 아님(규모 기준)',
      basis: '2층 이상 또는 연면적 200㎡ 이상, 단독주택·공동주택 등 (목구조는 3층·500㎡)', law: '「건축법」 제48조 · 시행령 제32조'});
  }
  // 공사감리
  if (zone) out.push({item: '공사감리', result: '건축허가 대상이면 공사감리자 지정',
    basis: '연면적 5,000㎡ 이상 등 일정 규모 이상은 상주감리 검토', law: '「건축법」 제25조 · 시행령 제19조'});
  // 정북 일조
  if (residential) out.push({item: '일조 등 확보를 위한 높이 제한', result: '적용',
    basis: '정북방향 인접 대지경계선에서 높이 10m 이하 부분 1.5m 이상, 10m 초과 부분 해당 높이의 1/2 이상 이격', law: '「건축법」 제61조 · 시행령 제86조'});
  // 승강기
  if (f || g) {
    const lift = f >= 6 && g >= 2000;
    out.push({item: '승강기', result: lift ? '승용승강기 설치 대상' : '설치 의무 대상 아님(규모 기준)',
      basis: '6층 이상으로서 연면적 2,000㎡ 이상 (높이 31m 초과 시 비상용승강기 별도)', law: '「건축법」 제64조'});
  }
  // 에너지절약계획서
  if (g) {
    const yes = g >= 500 && !has(purpose, /단독주택/);
    out.push({item: '에너지절약계획서', result: yes ? '제출 대상' : '제출 대상 아님(규모·용도 기준)',
      basis: '연면적 500㎡ 이상 (단독주택 등 일부 용도 제외)', law: '「녹색건축물 조성 지원법」 제14조 · 시행령 제10조'});
  }
  // 장애인 편의시설
  if (!house || has(purpose, /공동주택/)) out.push({item: '장애인 · 노인 · 임산부 편의시설', result: '설치 대상 여부 검토',
    basis: '용도·면적별 대상시설 기준(근린생활시설 일부, 공동주택 등) 별표 대조', law: '「장애인등편의법」 시행령 제3조 · 별표1'});
  // 미술작품
  if (g >= 10000) out.push({item: '건축물 미술작품', result: '설치 대상', basis: '연면적 10,000㎡ 이상 (용도별 예외 있음)', law: '「문화예술진흥법」 제9조 · 시행령 제12조'});
  return out;
}

/* 건축법 제19조 시설군 (작은 번호가 상위) */
const GROUPS = [
  [1, '자동차 관련 시설군', ['자동차 관련 시설']],
  [2, '산업 등 시설군', ['운수시설', '창고시설', '공장', '위험물 저장 및 처리 시설', '자원순환 관련 시설', '묘지 관련 시설', '장례시설']],
  [3, '전기통신시설군', ['방송통신시설', '발전시설']],
  [4, '문화 및 집회시설군', ['문화 및 집회시설', '종교시설', '위락시설', '관광 휴게시설']],
  [5, '영업시설군', ['판매시설', '운동시설', '숙박시설']],
  [6, '교육 및 복지시설군', ['의료시설', '교육연구시설', '노유자시설', '수련시설', '야영장 시설']],
  [7, '근린생활시설군', ['제1종 근린생활시설', '제2종 근린생활시설']],
  [8, '주거업무시설군', ['단독주택', '공동주택', '업무시설', '교정시설', '국방·군사시설']],
  [9, '그 밖의 시설군', ['동물 및 식물 관련 시설']]
];
export function facilityGroup(use) {
  const u = String(use || '').replace(/\s+/g, '');
  for (const [n, name, list] of GROUPS) if (list.some(x => u.includes(x.replace(/\s+/g, '')))) return {n, name};
  return null;
}
/** 기존 용도 → 변경 용도의 절차 (건축법 제19조) */
export function useChange(from, to) {
  const a = facilityGroup(from), b = facilityGroup(to);
  if (!a || !b) return null;
  if (b.n < a.n) return {kind: '허가', text: `${a.name} → ${b.name} : 상위 시설군으로 변경 → 용도변경 허가`};
  if (b.n > a.n) return {kind: '신고', text: `${a.name} → ${b.name} : 하위 시설군으로 변경 → 용도변경 신고`};
  return {kind: '기재변경', text: `같은 ${a.name} 안의 변경 → 건축물대장 기재내용 변경 신청 (일부 예외)`};
}
