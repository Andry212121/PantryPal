// Builds Amazon KDP print-ready files:
//   KDP-Interior.pdf  5.5 x 8.5 in, black and white, no bleed, mirrored margins
//   KDP-Cover.pdf     full wrap (back + spine + front) with 0.125 in bleed
// Usage (from the-map-that-forgot-home/):  node build/build-kdp.js
// Edit the BOOK settings below, then rebuild.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const BOOK = {
  title: 'The Map That Forgot Home',
  author: '[Author Name]',
  illustrator: '[Illustrator Name]',
  year: '[Year]',
  isbn: '[ISBN]',
  tagline: 'Four friends. Three days. A way home that is disappearing.',
};

const ROOT = path.join(__dirname, '..');
const FONTS = path.join(__dirname, 'fonts');
const FONTFACE = `<style>
@font-face { font-family: Literata; font-weight: 400; font-style: normal; src: url("file://${FONTS}/Literata-400.ttf"); }
@font-face { font-family: Literata; font-weight: 400; font-style: italic; src: url("file://${FONTS}/Literata-400i.ttf"); }
@font-face { font-family: Literata; font-weight: 600 700; font-style: normal; src: url("file://${FONTS}/Literata-600.ttf"); }
@font-face { font-family: Fraunces; font-weight: 600; src: url("file://${FONTS}/Fraunces-600.ttf"); }
@font-face { font-family: Fraunces; font-weight: 800; src: url("file://${FONTS}/Fraunces-800.ttf"); }
</style>`;

const OUT = path.join(__dirname, 'kdp');
fs.mkdirSync(OUT, { recursive: true });
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const esc = (s) => s.replace(/&(?!nbsp;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/'/g, '’').replace(/(^|[\s(—])’/g, '$1‘')
  .replace(/"([^"]*)"/g, '“$1”');

// ---------- images: greyscale, full resolution, for print ----------
function prepImages() {
  const py = `
import pathlib
from PIL import Image
src = pathlib.Path(r'${path.join(ROOT, 'images')}'); out = pathlib.Path(r'${OUT}')
for p in src.glob('*.png'):
    im = Image.open(p)
    if p.stem in ('cover', 'map-colour'):
        im = im.convert('RGB')
        if p.stem == 'cover':  # enlarge to about 300 dpi at print size (KDP's recommendation)
            from PIL import ImageFilter
            im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 40, 2))
        im.save(out / (p.stem + '.png'))
    else:
        g = im.convert('L')
        if p.stem == 'map': g = g.rotate(90, expand=True)
        g.save(out / (p.stem + '.png'))
`;
  fs.writeFileSync(path.join(OUT, 'prep.py'), py);
  execSync(`python3 -I "${path.join(OUT, 'prep.py')}"`);
}
const img = (name) => fs.existsSync(path.join(OUT, name + '.png')) ? `${name}.png` : null;

// ---------- markdown -> HTML ----------
const ILLUS = { 1: 'I-01', 2: 'I-02', 3: 'I-03', 5: 'I-04', 6: 'I-05', 8: 'I-06', 9: 'I-07', 11: 'I-08', 12: 'I-09', 15: 'I-10', 18: 'I-11', 22: 'I-12', 24: 'S-1' };
const WORDS = ['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty','Twenty-One','Twenty-Two','Twenty-Three','Twenty-Four'];

function mdToHtml(md, { chapters = false } = {}) {
  const lines = md.split('\n');
  const out = [];
  let para = [], list = null, first = true;
  const flush = () => {
    if (para.length) {
      const t = para.join(' ').trim();
      if (/^\*\*[A-Z][A-Z ,'-]+\*\*$/.test(t)) out.push(`<p class="countdown">${inline(t.slice(2, -2))}</p>`);
      else out.push(`<p${first ? ' class="first"' : ''}>${inline(t)}</p>`);
      first = false; para = [];
    }
    if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; }
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^# /.test(l)) continue;
    if (/^## /.test(l)) {
      flush();
      const t = l.slice(3).trim();
      if (chapters) {
        const n = WORDS.indexOf(t.replace('Chapter ', '')) + 1;
        const sub = (lines[i + 1] || '').startsWith('### ') ? lines[++i].slice(4).trim() : '';
        const pic = ILLUS[n] && img(ILLUS[n]);
        out.push(`<section class="chapter" id="ch${n}"><div class="chnum">Chapter ${n}</div><h1>${inline(sub)}</h1>${pic ? `<img class="illus" src="${pic}">` : ''}`);
      } else {
        const id = t.toLowerCase().replace(/[^a-z]+/g, '-');
        out.push(`<h2 id="${id}">${inline(t)}</h2>`);
        if (/Equipment/.test(t) && img('B-1')) out.push(`<img class="b1" src="${img('B-1')}">`);
      }
      first = true; continue;
    }
    if (/^### /.test(l)) { flush(); out.push(`<h3>${inline(l.slice(4))}</h3>`); first = true; continue; }
    if (/^---\s*$/.test(l)) {
      flush();
      let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && !/^## /.test(lines[j]) && chapters) { out.push('<p class="break">✦ ✦ ✦</p>'); first = true; }
      continue;
    }
    if (/^>/.test(l)) {
      flush();
      const b = [];
      while (i < lines.length && /^>/.test(lines[i])) { b.push(lines[i].replace(/^> ?/, '')); i++; }
      i--;
      out.push(`<div class="notice">${b.filter(Boolean).map(x => `<div>${inline(x)}</div>`).join('')}</div>`);
      first = true; continue;
    }
    const num = l.match(/^\d+\. (.*)/), bul = l.match(/^- (.*)/);
    if (num || bul) {
      if (para.length) { const p = para; para = []; out.push(`<p class="first">${inline(p.join(' '))}</p>`); }
      const tag = num ? 'ol' : 'ul';
      if (!list || list.tag !== tag) { if (list) flush(); list = { tag, items: [] }; }
      list.items.push((num || bul)[1]); continue;
    }
    if (!l.trim()) { flush(); continue; }
    if (!chapters && /^(What it does|Its limit|Its cost|Watch out):/.test(l)) { flush(); out.push(`<p class="first kit">${inline(l)}</p>`); continue; }
    para.push(l.trim());
  }
  flush();
  return out.join('\n').replace(/<section class="chapter"/g, (m, o, s) => (s.slice(0, o).includes('<section class="chapter"') ? '</section>' : '') + m) + (chapters ? '</section>' : '');
}

// ---------- interior ----------
function interiorHtml(pageOf = {}) {
  const ms = read('02-manuscript.md');
  const titles = [...ms.matchAll(/^## Chapter (.+)\n### (.+)$/gm)].map(m => m[2]);
  let back = read('06-back-matter.md').replace(/\n---\n/g, '\n');
  // put the B-3 drawing page before the answers
  back = back.replace('## Answers', '<<B3>>\n\n## Answers');
  let backHtml = mdToHtml(back);
  backHtml = backHtml.replace(/<p class="first">&lt;&lt;B3&gt;&gt;<\/p>|<p>&lt;&lt;B3&gt;&gt;<\/p>/, img('B-3') ? `<div class="fullpage"><img src="${img('B-3')}"></div>` : '');
  const pn = (k) => pageOf[k] ? `<span class="pg">${pageOf[k]}</span>` : '<span class="pg"></span>';

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
${FONTFACE}
<style>
@page { size: 5.5in 8.5in; margin: 0.6in 0.5in 0.75in 0.65in;
  @bottom-center { content: counter(page); font-family: Literata, serif; font-size: 8.5pt; color: #333; } }
@page :left  { margin-left: 0.5in;  margin-right: 0.65in; }
@page :right { margin-left: 0.65in; margin-right: 0.5in; }
@page plain { @bottom-center { content: none; } }
html { font-family: Literata, serif; font-size: 10.6pt; line-height: 1.45; color: #111; hyphens: auto; }
body { margin: 0; }
p { margin: 0; text-indent: 1.3em; text-align: justify; orphans: 2; widows: 2; }
p.first, p.kit { text-indent: 0; }
p.kit { text-align: left; margin-top: .15em; }
.front { page: plain; break-after: page; text-align: center; }
.titlepage h1 { font-family: Fraunces, serif; font-weight: 800; font-size: 30pt; line-height: 1.05; margin: 1.3in 0 .25in; }
.titlepage .tag { font-style: italic; font-size: 11pt; }
.titlepage .by { margin-top: 2.2in; font-family: Fraunces, serif; font-size: 13pt; letter-spacing: .08em; }
.titlepage .ill { font-size: 9.5pt; margin-top: .1in; }
.copyright { display: flex; flex-direction: column; justify-content: flex-end; height: 7.1in; font-size: 8pt; line-height: 1.5; text-align: left; }
.copyright p { text-indent: 0; text-align: left; margin-bottom: .5em; }
.dedication { padding-top: 2.4in; font-style: italic; font-size: 11pt; }
.contents h2, h2 { font-family: Fraunces, serif; font-weight: 600; font-size: 15pt; text-align: center; margin: 0 0 .25in; }
.contents ol { list-style: none; padding: 0; margin: 0; text-align: left; font-size: 9.6pt; line-height: 1.55; }
.contents li { display: flex; gap: .4em; }
.contents li b { width: 1.6em; text-align: right; font-weight: 600; }
.contents li .dots { flex: 1; border-bottom: 1px dotted #999; margin: 0 .3em .3em; }
.mappage { page: plain; break-after: page; height: 7.1in; display: flex; align-items: center; justify-content: center; }
.mappage img { max-width: 100%; max-height: 7.1in; }
.chapter { break-before: page; }
.chnum { font-family: Fraunces, serif; font-weight: 600; font-size: 10pt; letter-spacing: .25em; text-transform: uppercase; text-align: center; margin-top: .15in; color: #333; }
.chapter h1 { font-family: Fraunces, serif; font-weight: 800; font-size: 19pt; text-align: center; margin: .06in 0 .2in; line-height: 1.1; }
img.illus { display: block; width: 100%; max-height: 3.05in; object-fit: contain; margin: 0 auto .2in; }
p.break { text-align: center; text-indent: 0; margin: .7em 0; font-size: 9pt; letter-spacing: .3em; }
p.countdown { text-align: center; text-indent: 0; font-family: Fraunces, serif; font-weight: 600; letter-spacing: .12em; font-size: 9.5pt; margin: 1em 0; }
.notice { margin: .8em .25in; padding: .5em .2in; border-top: .5pt solid #555; border-bottom: .5pt solid #555; text-align: center; font-size: 9.5pt; line-height: 1.4; break-inside: avoid; }
h3 { font-family: Fraunces, serif; font-size: 11pt; margin: .9em 0 .3em; break-after: avoid; }
.backmatter h2 { break-before: page; margin-top: .1in; }
.backmatter .explorers { page: plain; break-before: page; break-after: page; text-align: center; padding-top: 2.6in; font-family: Fraunces, serif; font-weight: 800; font-size: 26pt; }
.backmatter ul, .backmatter ol { margin: .3em 0 .5em; padding-left: 1.4em; }
.backmatter li { margin-bottom: .15em; }
.backmatter p { text-align: left; }
img.b1 { display: block; max-height: 3.4in; max-width: 100%; margin: 0 auto .2in; }
.fullpage { page: plain; break-before: page; height: 7.1in; display: flex; align-items: center; justify-content: center; }
.fullpage img { max-width: 100%; max-height: 7.1in; }
.theend { text-align: center; text-indent: 0; font-family: Fraunces, serif; font-weight: 600; letter-spacing: .2em; margin-top: 1.2em; }
</style></head><body>
<div class="front titlepage"><h1>${BOOK.title.replace('That ', 'That<br>')}</h1><div class="tag">${BOOK.tagline}</div>
  <div class="by">${BOOK.author}</div><div class="ill">Illustrated by ${BOOK.illustrator}</div></div>
<div class="front copyright">
  <p>Text copyright © ${BOOK.author} ${BOOK.year}<br>Illustrations copyright © ${BOOK.illustrator} ${BOOK.year}</p>
  <p>All rights reserved. No part of this book may be reproduced in any form without written permission from the author, except for brief quotations in reviews.</p>
  <p>This is a work of fiction. Names, characters, places and events are the products of the author's imagination.</p>
  <p>ISBN: ${BOOK.isbn}</p><p>First edition</p></div>
<div class="front dedication">For everyone who has ever left a gap for the wanderers.</div>
<div class="front contents"><h2>Contents</h2><ol>
${titles.map((t, k) => `<li><b>${k + 1}</b><span>${inline(t)}</span><span class="dots"></span>${pn('ch' + (k + 1))}</li>`).join('\n')}
<li style="margin-top:.5em"><b></b><span><em>For Explorers</em></span><span class="dots"></span>${pn('explorers')}</li></ol></div>
${img('map') ? `<div class="mappage"><img src="${img('map')}"></div>` : ''}
${mdToHtml(ms.slice(ms.indexOf('## Chapter One')).replace(/\*\*THE END\*\*/, ''), { chapters: true })}
<p class="theend">THE END</p>
<div class="backmatter"><div class="explorers" id="explorers">For Explorers</div>${backHtml}</div>
</body></html>`;
}

// ---------- cover ----------
function coverHtml(pages) {
  const spine = +(pages * 0.002252).toFixed(4);   // KDP white paper, black ink
  const bleed = 0.125, W = bleed * 2 + 5.5 * 2 + spine, H = 8.5 + bleed * 2;
  const blurb = [
    'Mara Ellery likes plans, lists and maps that tell the truth. So when the map she finds in the Gull Head lighthouse starts growing islands, and the road out of Wrenmouth turns grey and vanishes into fog, she knows something is badly wrong.',
    'Beyond the lighthouse door lies the Fold: lamplit harbours, a forest that steals your voice, an orchard that hangs upside down, and a market that never stays in the same place twice. And somewhere at its edge, the Surveyor has begun the Stilling.',
    'In seventy-two hours, every island on his great Chart will freeze for ever, and that includes Mara’s town, her dad and her nan.',
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8">
${FONTFACE}
<style>
@page { size: ${W}in ${H}in; margin: 0; }
html, body { margin: 0; width: ${W}in; height: ${H}in; }
.wrap { position: relative; width: ${W}in; height: ${H}in; overflow: hidden; background: #2e1934; }
.back { position: absolute; left: 0; top: 0; width: ${bleed + 5.5}in; height: ${H}in;
  background: radial-gradient(120% 80% at 50% 0%, #6a3a63 0%, #3b2142 55%, #24142a 100%); color: #fbf5ea; }
.back .inner { position: absolute; left: ${bleed + 0.5}in; right: 0.5in; top: ${bleed + 0.55}in; }
.hook { font-family: Fraunces, serif; font-weight: 800; color: #f2c86b; font-size: 21pt; line-height: 1.15; text-align: center; margin-bottom: .22in; }
.back p { font-family: Literata, serif; font-size: 11pt; line-height: 1.5; margin: 0 0 .12in; }
.stars { text-align: center; color: #f2c86b; letter-spacing: .5em; margin: .16in 0 .08in; font-size: 10pt; }
.call { text-align: center; font-style: italic; }
.age { position: absolute; left: ${bleed + 0.5}in; bottom: ${bleed + 0.55}in; border: 1.2pt solid #f2c86b; color: #f2c86b; border-radius: 20pt; padding: 4pt 11pt; font-family: Fraunces, serif; font-weight: 600; font-size: 10pt; }
.spine { position: absolute; left: ${bleed + 5.5}in; top: 0; width: ${spine}in; height: ${H}in; background: linear-gradient(90deg,#2b1631,#4a2850 50%,#2b1631);
  display: flex; align-items: center; justify-content: center; }
.spine span { writing-mode: vertical-rl; font-family: Fraunces, serif; font-weight: 600; font-size: ${Math.min(9, spine * 72 * 0.55).toFixed(1)}pt; color: #fbf5ea; letter-spacing: .06em; white-space: nowrap; }
.spine b { color: #f2c86b; font-weight: 600; }
.front { position: absolute; left: ${bleed + 5.5 + spine}in; top: 0; width: ${5.5 + bleed}in; height: ${H}in; background: url(cover.png) center/cover; }
.title { position: absolute; left: 0; right: ${bleed}in; top: ${bleed + 0.35}in; text-align: center; font-family: Fraunces, serif; font-weight: 800; color: #fbf5ea; font-size: 44pt; line-height: .95;
  text-shadow: 0 3pt 12pt rgba(40,10,40,.8), 0 1pt 0 rgba(0,0,0,.4); }
.title small { display: block; font-weight: 600; letter-spacing: .18em; font-size: 12pt; color: #f2c86b; margin-bottom: 6pt; }
.tag { position: absolute; left: .4in; right: ${bleed + 0.4}in; top: ${bleed + 2.15}in; text-align: center; font-family: Literata, serif; font-style: italic; font-size: 11pt; color: #fff; text-shadow: 0 2pt 6pt rgba(0,0,0,.8); }
.author { position: absolute; left: 0; right: ${bleed}in; bottom: ${bleed + 0.35}in; text-align: center; font-family: Fraunces, serif; font-weight: 600; font-size: 14pt; letter-spacing: .14em; color: #fff; text-shadow: 0 2pt 8pt rgba(0,0,0,.9); }
</style></head><body><div class="wrap">
<div class="back"><div class="inner">
  <div class="hook">Four friends.<br>Three days.<br>A way home that is disappearing.</div>
  ${blurb.map(p => `<p>${p}</p>`).join('')}
  <div class="stars">✦ ✦ ✦</div>
  <p class="call">Crack the codes. Read the map.<br>Find the road he can’t control.</p>
</div><div class="age">Ages 8–12</div></div>
<div class="spine"><span>${BOOK.title.toUpperCase()} &nbsp;·&nbsp; <b>${BOOK.author}</b></span></div>
<div class="front"><div class="title"><small>THE</small>Map That<br>Forgot Home</div>
  <div class="tag">${BOOK.tagline}</div><div class="author">${BOOK.author.toUpperCase()}</div></div>
</div></body></html>`;
  return { html, W, H, spine };
}

// ---------- run ----------
const pageCount = (f) => +execSync(`pdfinfo "${f}"`).toString().match(/Pages:\s+(\d+)/)[1];
function findPages(pdf, titles) {
  const n = pageCount(pdf), found = {};
  for (let p = 1; p <= n; p++) {
    const t = execSync(`pdftotext -f ${p} -l ${p} "${pdf}" -`).toString();
    const m = t.match(/CHAPTER (\d+)/i);
    if (m && /^\s*Chapter \d+/i.test(t.trimStart()) && !found['ch' + m[1]]) found['ch' + m[1]] = p;
    if (!found.explorers && /^\s*For Explorers\s*$/.test(t.trim())) found.explorers = p;
  }
  return found;
}

(async () => {
  prepImages();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const interiorFile = path.join(OUT, 'interior.html');
  const interiorPdf = path.join(ROOT, 'KDP-Interior.pdf');
  const render = async (html) => {
    fs.writeFileSync(interiorFile, html);
    await page.goto('file://' + interiorFile, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: interiorPdf, preferCSSPageSize: true, printBackground: true });
  };
  await render(interiorHtml());                       // pass 1: find chapter pages
  const pageOf = findPages(interiorPdf);
  await render(interiorHtml(pageOf));                 // pass 2: contents with page numbers
  const pages = pageCount(interiorPdf);
  console.log('interior pages:', pages, 'chapters found:', Object.keys(pageOf).length);

  const { html, W, H, spine } = coverHtml(pages % 2 ? pages + 1 : pages);
  const coverFile = path.join(OUT, 'cover.html');
  fs.writeFileSync(coverFile, html);
  await page.goto('file://' + coverFile, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(ROOT, 'KDP-Cover.pdf'), width: W + 'in', height: H + 'in', printBackground: true, pageRanges: '1' });
  console.log(`cover: ${W.toFixed(3)} x ${H.toFixed(3)} in, spine ${spine} in`);
  await browser.close();
})();
