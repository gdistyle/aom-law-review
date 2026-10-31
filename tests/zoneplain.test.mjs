import test from 'node:test';
import assert from 'node:assert/strict';
import {zonePlain} from '../public/js/zoneplain.js';
test('주요 지역·지구 풀이', () => {
  assert.match(zonePlain('제2종일반주거지역').what, /중층/);
  assert.match(zonePlain('개발제한구역').effect, /금지/);
  assert.match(zonePlain('자연녹지지역').effect, /20%/);
  assert.equal(zonePlain('알수없는구역'), null);
  assert.ok(zonePlain('대공방어협조구역(위탁고도:54-236m)'));
});
