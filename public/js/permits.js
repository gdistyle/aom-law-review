/* 인허가 절차 — 지목·용도지역·지역지구·행위 구분·기존 건축물로 일반적인 절차 순서를 판정.
   ・ 근거 조문은 reference()로 현행 원문 링크를 붙이고, 원문을 받지 못한 조문은 빨간 글씨.
   ・ 처리 기간은 지자체·협의 기관에 따라 달라 숫자를 쓰지 않음(빨간 안내).
   ・ 확정 판단이 아님: 실제 절차는 인허가권자 협의로 확정. */
import {reference} from './legal.js';
import {scaleChecklist, useChange} from './checklist.js';
import {totalArea, selectedBuilding} from './core.js';

const BLD = '건축법', PLAN = '국토의 계획 및 이용에 관한 법률', GREEN = '개발제한구역의 지정 및 관리에 관한 특별조치법';

/** @returns {{steps: Array<{no:number, step:string, when:string, refs:Array, note:string, red:boolean}>, flags:object, note:string}} */
export function permitSteps(p) {
  const laws = p.laws || [], R = (n, a) => reference(laws, n, a);
  const zone = p.land?.zone?.value || '', cat = p.land?.category?.value || '', zones = (p.land?.zones || []).map(z => z.name);
  const op = p.operation || '신축';
  const farmland = ['전', '답', '과수원'].includes(cat), forest = cat === '임야';
  const green = zones.some(z => z.includes('개발제한구역')), district = zones.some(z => z.includes('지구단위계획'));
  const nonUrban = /관리지역|농림지역|자연환경보전/.test(zone);
  const grading = farmland || forest || !!p.manual?.grading;
  const L = p.review?.limits || {}, floors = Number(p.floors) || null;
  const chk = scaleChecklist({zone, purpose: p.purpose, floors, gross: L.maxGross});
  const reportable = chk.find(c => c.item.startsWith('건축허가'))?.result === '건축신고 가능 범위';
  const b = selectedBuilding(p);
  const steps = [];
  const add = (step, when, refs, note = '', red = false) => steps.push({no: steps.length + 1, step, when, refs, note, red: red || refs.some(r => !r.current)});

  add('건축사 설계 · 사전 검토', '공통', [R(BLD, 23)], '건축허가·신고 대상 건축물의 설계는 건축사가 수행');
  if (green) add('개발제한구역 행위허가', '개발제한구역 안 건축', [R(GREEN, 12)], '허용 행위·입지기준 충족 여부가 선행 조건', true);
  if (district) add('지구단위계획 적합 검토', '지구단위계획구역 안', [R(PLAN, 54)], '시행지침의 용도·높이·건축선 등에 맞게 계획', true);
  if (farmland) add('농지전용 허가(협의)', `지목 ${cat}`, [R('농지법', 34), R('농지법', 38)], '농지보전부담금 납부 대상 — 건축허가 시 함께 처리(의제)될 수 있음', true);
  if (forest) add('산지전용 허가(협의)', '지목 임야', [R('산지관리법', 14), R('산지관리법', 19)], '대체산림자원조성비 납부 대상 — 건축허가 시 함께 처리(의제)될 수 있음', true);
  if (grading || nonUrban) add('개발행위허가(협의)', grading ? '토지 형질변경 수반' : '비도시지역', [R(PLAN, 56)], '건축허가 시 함께 처리(의제)될 수 있음', true);

  if (op === '용도변경') {
    const ch = b && p.purpose ? useChange(b.mainPurpsCdNm, p.purpose) : null;
    if (ch) add(`용도변경 ${ch.kind}`, ch.text, [R(BLD, 19)], ch.kind === '허가' ? '상위 시설군 변경' : ch.kind === '신고' ? '하위 시설군 변경' : '같은 시설군 안 변경');
    else add('용도변경 허가 · 신고 · 기재변경', '기존 용도와 변경 용도로 결정', [R(BLD, 19)], b ? '05 계획 조건에서 주용도(변경할 용도)를 선택하면 판정' : '기존 건축물 정보가 없어 판정 불가', true);
    add('위반건축물 여부 열람', '용도변경 전', [R(BLD, 79)], '세움터 건축물대장 표제부의 「위반건축물」 표시 유무 열람 — 위반 시 허가 제한 가능', true);
  } else {
    const kind = op === '증축' ? '증축' : '신축';
    if (reportable) add(`건축신고 (${kind})`, '비도시지역 소규모 (연면적 200㎡ 미만·3층 미만)', [R(BLD, 14)], '지구단위계획구역 등은 제외될 수 있음', true);
    else add(`건축허가 (${kind})`, '건축신고 대상 규모·지역 외', [R(BLD, 11)], '관련 인허가(농지·산지·개발행위 등)는 허가 시 함께 협의');
    if (op === '증축') add('위반건축물 여부 열람', '증축 전', [R(BLD, 79)], '세움터 건축물대장 표제부의 「위반건축물」 표시 유무 열람', true);
  }
  if (op === '용도변경') {
    add('공사 · 사용승인 (해당 시)', '용도변경에 공사가 수반되거나 일정 규모 이상인 경우', [R(BLD, 19), R(BLD, 22)], '사용승인 대상 여부는 변경 바닥면적 등에 따라 달라짐', true);
  } else {
    add('착공신고', '공사 시작 전', [R(BLD, 21)], '공사감리자·시공자 지정 후 신고');
    add('공사 · 감리', '공사 기간', [R(BLD, 25)], '허가 대상은 공사감리자 지정');
    add('사용승인', '공사 완료 후', [R(BLD, 22)], '사용승인 후 건축물대장 생성·변경');
  }
  return {steps, flags: {farmland, forest, green, district, grading, nonUrban, reportable, op},
    note: '처리 기간은 지자체·협의 기관과 서류 보완 여부에 따라 달라 숫자로 표시하지 않음. 실제 절차는 인허가권자 사전 협의로 확정.'};
}
