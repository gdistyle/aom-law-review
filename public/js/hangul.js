/**
 * 영문 자판 상태로 친 글자를 두벌식 한글로 바꿈 (예: gksska → 한남, rkadlehd → 감이동).
 * 브라우저는 입력기(한/영)를 웹페이지가 바꿀 수 없으므로, 영문으로 입력돼도 한글로 고쳐 넣는 방식.
 */
const KEY = {r:'ㄱ',R:'ㄲ',s:'ㄴ',e:'ㄷ',E:'ㄸ',f:'ㄹ',a:'ㅁ',q:'ㅂ',Q:'ㅃ',t:'ㅅ',T:'ㅆ',d:'ㅇ',w:'ㅈ',W:'ㅉ',c:'ㅊ',z:'ㅋ',x:'ㅌ',v:'ㅍ',g:'ㅎ',
  k:'ㅏ',o:'ㅐ',i:'ㅑ',O:'ㅒ',j:'ㅓ',p:'ㅔ',u:'ㅕ',P:'ㅖ',h:'ㅗ',y:'ㅛ',n:'ㅜ',b:'ㅠ',m:'ㅡ',l:'ㅣ'};
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VV = {'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
const CC = {'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'};
const SPLIT = Object.fromEntries(Object.entries(CC).map(([k, v]) => [v, [...k]]));
const isV = j => JUNG.includes(j);

function compose(jamo) {
  let out = '', c = null, v = null, t = null;
  const flush = () => { if (c && v) out += String.fromCharCode(0xAC00 + (CHO.indexOf(c) * 21 + JUNG.indexOf(v)) * 28 + JONG.indexOf(t || '')); else out += (c || '') + (v || ''); c = v = t = null; };
  for (const j of jamo) {
    if (isV(j)) {
      if (c && v && t) { // 받침이 다음 글자 초성으로 넘어감
        const sp = SPLIT[t]; let nc;
        if (sp) { t = sp[0]; nc = sp[1]; } else { nc = t; t = null; }
        flush(); c = nc; v = j;
      } else if (v && !t && VV[v + j]) v = VV[v + j];
      else if (c && !v) v = j;
      else { flush(); v = j; }
    } else {
      if (c && v && !t && JONG.includes(j)) t = j;
      else if (c && v && t && CC[t + j]) t = CC[t + j];
      else { flush(); c = j; }
    }
  }
  flush();
  return out;
}

/** 영문 글자 묶음만 한글로 바꾸고 숫자·기호·한글은 그대로 둔다. */
const VSPLIT = Object.fromEntries(Object.entries(VV).map(([k, v]) => [v, [...k]]));
function decompose(ch) {
  const n = ch.charCodeAt(0) - 0xAC00;
  if (n < 0 || n > 11171) return VSPLIT[ch] || SPLIT[ch] || [ch];
  const v = JUNG[Math.floor(n / 28) % 21], t = JONG[n % 28];
  return [CHO[Math.floor(n / 588)], ...(VSPLIT[v] || [v]), ...(t ? SPLIT[t] || [t] : [])];
}
const keyOf = ch => KEY[ch] || KEY[ch.toLowerCase()];
export function toHangul(s) {
  // 영문이 섞인 한글·영문 묶음만 다시 조합 (앞에서 이미 바뀐 글자와 이어서 조합되도록)
  return String(s).replace(/[가-힣ㄱ-ㅣA-Za-z]+/g, run => {
    if (!/[A-Za-z]/.test(run) || ![...run].every(ch => !/[A-Za-z]/.test(ch) || keyOf(ch))) return run;
    return compose([...run].flatMap(ch => /[A-Za-z]/.test(ch) ? [keyOf(ch)] : decompose(ch)));
  });
}

/** 입력칸에 연결: 영문이 들어오면 바로 한글로 바꿈(커서 위치 유지). */
export function hangulInput(el) {
  if (!el || el.dataset.hangul) return; el.dataset.hangul = '1'; el.lang = 'ko'; el.setAttribute('autocapitalize', 'off'); el.spellcheck = false;
  el.addEventListener('input', e => {
    if (e.isComposing || !/[A-Za-z]/.test(el.value)) return;
    const pos = el.selectionStart ?? el.value.length, before = toHangul(el.value.slice(0, pos)), after = toHangul(el.value.slice(pos));
    el.value = before + after; try { el.setSelectionRange(before.length, before.length); } catch {}
  });
}
