'use strict';
/* v39 design pass checks: unified SVG icons, no duplicate plan/ride icon,
   distinct Mint swatch, focus coverage, every static button addressable. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
function read(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
const html = read('index.html'), css = read('v39-design.css'), sw = read('sw.js'), app = read('app.js');
ok('v39 css linked', html.includes('v39-design.css'));
ok('v39 css precached', sw.includes('v39-design.css'));
ok('sw cache v39', sw.includes("iht-v39"));
ok('about version 39', html.includes('version 39'));
ok('no home tic icons left', !/tic-(toolkit|comfort|plan|learn|history|privacy|about)/.test(html));
ok('no trip glyph icons left', !/[◯◎〜✦☁✆]/.test(html));
ok('no pov shape icons left', !/pov-(guide|breathe|ground)"><i/.test(html));
ok('tool icons are svg', (html.match(/class="tool-ic"[^>]*><svg/g) || []).length >= 12);
ok('panic icons are svg', (html.match(/class="po-ic[^"]*"[^>]*><svg/g) || []).length === 3);
ok('mint swatch distinct from classic', (html.match(/data-color="mint"[^>]*--sw:#7fd4b2/g) || []).length === 3
  && !(html.match(/data-color="mint"[^>]*--sw:#93d3ab/g) || []).length);
ok('more button has aria-expanded', html.includes('id="btn-home-more"') && html.includes("aria-expanded"));
ok('more handler syncs aria-expanded', app.includes("b.setAttribute('aria-expanded'"));
ok('focus covers tool, panicopt, backlink, linklike, acct-btn, sosfloat', [
  '.tool:focus-visible', '.panicopt:focus-visible', '.backlink:focus-visible',
  '.linklike:focus-visible', '.acct-btn:focus-visible', '.sosfloat:focus-visible'
].every(function (s) { return css.includes(s); }));
ok('disabled style exists', css.includes('.btn:disabled'));
const btns = html.match(/<button[^>]*>/g) || [];
const bad = btns.filter(function (b) { return !/id=|data-/.test(b); });
ok('every static button has id or data attribute', bad.length === 0, JSON.stringify(bad.slice(0, 3)));
ok('no duplicate ride/plan nav', !html.includes('data-go="screen-checkin"><span class="tool-ic"'));
ok('home nav has learn', html.includes('data-go="screen-learn"><span class="tool-ic"'));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
