import test from 'node:test';import assert from 'node:assert';
import {toHangul} from '../public/js/hangul.js';
test('영문 자판 입력 → 한글 주소',()=>{
 assert.equal(toHangul('gkskatl rkadlehd 440-2'),'하남시 감이동 440-2');
 assert.equal(toHangul('qndkaehd 99'),'부암동 99');
 assert.equal(toHangul('ekfrr'),'닭ㄱ');
 assert.equal(toHangul('하남시 감이동 440-2'),'하남시 감이동 440-2');
 let v='';for(const ch of 'tjdnfxmrqufwk')v=toHangul(v+ch);assert.equal(v,'서울특별자');
});
