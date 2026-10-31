/* 농지·산지 전용 부담금 개략 산정.
   ・ 농지보전부담금: 「농지법 시행령」 원문(이용자 브라우저가 받은 현행 원문)에서 공시지가 대비 비율과 ㎡당 상한액을 읽어 계산.
     원문을 받지 못하거나 수치를 읽지 못하면 계산하지 않고 빨간 글씨 안내.
   ・ 대체산림자원조성비: 산림청 고시 단가가 법령 원문에 없어 자동 계산하지 않음(단가 직접 입력 안내).
   ・ 전용 면적은 대지 전체로 가정(빨간 글씨). 감면·제외 대상 여부는 반영하지 않음. */
import {getLaw, reference} from './legal.js';
import {parcelRows} from './multiparcel.js';

const DEC = '농지법 시행령';
const flat = t => String(t || '').replace(/\s+/g, ' ').trim();

/** 원문에서 비율과 ㎡당 상한 추출.
    시행령 제53조 ①: 개별공시지가 × (농업진흥지역 농지 100분의 N / 밖 100분의 M), ②: 상한은 농림축산식품부령(시행규칙 제47조의2 'N만원'). 옛 단일 비율 형식도 읽음. */
export function parseFarmRate(text, ruleText = '', inPromotion = false) {
  const t0 = flat(text), t = t0.replace(/\s+/g, '');
  const inside = t0.match(/농업진흥지역의\s*농지\s*[:：]\s*100분의\s*(\d+)/), outside = t0.match(/농업진흥지역\s*밖의\s*농지\s*[:：]\s*100분의\s*(\d+)/), single = t0.match(/개별공시지가의\s*100분의\s*(\d+)/);
  const rate = inside && outside ? Number(inPromotion ? inside[1] : outside[1]) : single ? Number(single[1]) : null;
  const r = flat(ruleText).replace(/\s+/g, '');
  const c = r.match(/제53조제2항[^.]*?금액(?:”|")?이란(?:각각)?(\d+)만원/) || t0.match(/(\d+)\s*만\s*원을?\s*초과/) || t0.match(/제곱미터당\s*(\d+)\s*만\s*원/);
  return {rate, cap: c ? Number(c[1]) * 10000 : null, capByNotice: !c && /고시하는금액|농림축산식품부령으로정하는금액/.test(t)};
}

export function farmlandCharge(p) {
  const rows = parcelRows(p).filter(r => ['전', '답', '과수원'].includes(r.category));
  if (!rows.length) return null;
  const law = getLaw(p.laws || [], DEC);
  const art = law?.articles?.find(a => /제곱미터당\s*금액|부과기준/.test(a.title || '') && /공시지가/.test(a.text || '')) || law?.articles?.find(a => /개별공시지가(의|에)/.test(flat(a.text)) && /농지보전부담금/.test(flat(a.text)));
  const rule = getLaw(p.laws || [], '농지법 시행규칙'), ruleArt = rule?.articles?.find(a => /상한/.test(a.title || '') && /농지보전부담금/.test(a.title || a.text || ''));
  const promo = (p.land?.zones || []).some(z => /농업진흥구역|농업보호구역|농업진흥지역/.test(z.name));
  const {rate, cap, capByNotice} = parseFarmRate(art?.text, ruleArt?.text || '', promo);
  const ref = art ? reference(p.laws, DEC, art.number) : reference(p.laws || [], DEC, '');
  const per = rows.map(r => {
    const unit = rate != null && r.price != null ? (cap != null ? Math.min(r.price * rate / 100, cap) : r.price * rate / 100) : null;
    return {address: r.address, category: r.category, area: r.area, price: r.price, unit, amount: unit != null && r.area != null ? unit * r.area : null};
  });
  const ok = rate != null && cap != null && per.every(x => x.amount != null);   // 비율·상한을 원문에서 모두 읽은 경우에만 산정
  return {kind: '농지보전부담금', ok, rate, cap, per, total: ok ? per.reduce((s, x) => s + x.amount, 0) : null, ref, articleText: flat(art?.text).slice(0, 400),
    note: ok ? `공시지가 × ${rate}%(${promo ? '농업진흥지역 농지' : '농업진흥지역 밖 농지'})${cap != null ? ` (㎡당 상한 ${cap.toLocaleString('ko-KR')}원)` : ''} × 전용 면적(대지 전체로 가정). 감면·제외 대상은 반영하지 않음.` : (capByNotice ? `㎡당 상한액이 농림축산식품부장관 고시 금액이라 원문만으로 확정할 수 없어 자동 산정하지 않음 (비율: 공시지가의 ${rate ?? '-'}%).` : '「농지법 시행령」 부과기준 원문을 받지 못해 자동 산정하지 않음.')};
}

export function forestCharge(p) {
  const rows = parcelRows(p).filter(r => r.category === '임야');
  if (!rows.length) return null;
  return {kind: '대체산림자원조성비', ok: false, per: rows.map(r => ({address: r.address, area: r.area, price: r.price})), total: null, ref: reference(p.laws || [], '산지관리법', 19),
    note: '산림청장이 매년 고시하는 단가가 필요해 자동 산정하지 않음. 고시 단가 확인 후 07 사업성 「기타 비용」에 입력할 것.'};
}

export function charges(p) { return [farmlandCharge(p), forestCharge(p)].filter(Boolean); }
