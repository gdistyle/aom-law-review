import test from 'node:test';
import assert from 'node:assert/strict';
import {recentMonths, median, unitOf, tradeStats, sameDong, PY} from '../public/js/trades.js';
import {parseTrades} from '../src/worker.js';

test('최근 12개월: 연도 넘김', () => {
  const m = recentMonths(new Date(2026, 1, 1));
  assert.equal(m.length, 12); assert.equal(m[0], '202602'); assert.equal(m[1], '202601'); assert.equal(m[2], '202512'); assert.equal(m[11], '202503');
});
test('중앙값', () => { assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([]), null); });
test('단가 환산: 1억(1만 만원) / 330.58㎡', () => {
  const u = unitOf({amount: 10000, area: 330.58});
  assert.ok(Math.abs(u.perM2 - 100000000 / 330.58) < 1e-6);
  assert.ok(Math.abs(u.perPy - 100000000 / 330.58 * 400 / 121) < 1e-6);
  assert.ok(Math.abs(u.perPy - 1000000) < 100);     // 100평 ≈ 330.58㎡ → 평당 100만 원 = 1,000,000원
  assert.ok(Math.abs(PY - 3.305785) < 1e-6);
});
test('같은 동 판정', () => { assert.ok(sameDong('감이동', '감이동')); assert.ok(sameDong('삼성면 양덕리', '양덕리')); assert.ok(!sameDong('감일동', '감이동')); });
test('통계: 해제·지분 제외, 동 필터, 지목·용도지역', () => {
  const T = [
    {umd: '감이동', jimok: '대', zone: '제2종일반주거', amount: 30000, area: 100, y: 2026, m: 9, d: 1},
    {umd: '감이동', jimok: '대', zone: '제2종일반주거', amount: 50000, area: 100, y: 2026, m: 8, d: 1},
    {umd: '감이동', jimok: '전', zone: '자연녹지', amount: 10000, area: 100, y: 2026, m: 7, d: 1},
    {umd: '감이동', jimok: '대', zone: '제2종일반주거', amount: 99999, area: 100, y: 2026, m: 6, d: 1, cancel: true},
    {umd: '감이동', jimok: '대', zone: '제2종일반주거', amount: 99999, area: 100, y: 2026, m: 6, d: 2, share: '지분'},
    {umd: '감일동', jimok: '대', zone: '제2종일반주거', amount: 1, area: 100, y: 2026, m: 6, d: 1}
  ];
  const S = tradeStats(T, {dong: '감이동', jimok: '대', zone: '제2종일반주거지역'});
  assert.equal(S.dongCount, 5); assert.equal(S.excluded, 2);
  assert.equal(S.all.n, 3); assert.equal(S.all.perM2, 3000000);
  assert.equal(S.jimok.n, 2); assert.equal(S.jimok.perM2, 4000000);
  assert.equal(S.zone.n, 2); assert.equal(S.zone.min, 3000000); assert.equal(S.zone.max, 5000000);
  assert.equal(S.list[0].m, 9);
});
test('XML 파싱 (영문 필드·쉼표 금액·해제)', () => {
  const xml = `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
  <item><sggCd>41450</sggCd><umdNm>감이동</umdNm><jibun>4**</jibun><jimok>대</jimok><landUse>제2종일반주거지역</landUse><dealArea>123.4</dealArea><dealAmount>45,600</dealAmount><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>3</dealDay><cdealType> </cdealType><shareDealingType></shareDealingType></item>
  <item><umdNm>감이동</umdNm><dealArea>10</dealArea><dealAmount>1,000</dealAmount><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>1</dealDay><cdealType>O</cdealType></item>
  </items><totalCount>2</totalCount></body></response>`;
  const r = parseTrades(xml);
  assert.equal(r.total, 2); assert.equal(r.items[0].amount, 45600); assert.equal(r.items[0].area, 123.4); assert.equal(r.items[0].zone, '제2종일반주거지역');
  assert.equal(r.items[0].cancel, false); assert.equal(r.items[1].cancel, true);
});
test('XML 인증 오류', () => { assert.throws(() => parseTrades('<OpenAPI_ServiceResponse><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></OpenAPI_ServiceResponse>'), /AUTH/); });
