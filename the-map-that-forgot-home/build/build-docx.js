// Builds the Word files from the markdown sources.
// Usage: node build/build-docx.js   (run from the-map-that-forgot-home/)
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  TableOfContents, Footer, ImageRun, PageOrientation, PageNumber, BorderStyle, LevelFormat,
} = require('docx');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FONT = 'Georgia';

// ---------- inline markdown -> TextRuns ----------
function runs(text, base = {}) {
  text = text.replace(/&nbsp;/g, ' ');
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const body = (text, opts = {}) => new Paragraph({
  children: runs(text),
  indent: opts.noIndent ? undefined : { firstLine: 340 },
  spacing: { after: 60, line: 300 },
  ...opts.para,
});
const centred = (text, extra = {}) => new Paragraph({
  children: runs(text, extra.run || {}), alignment: AlignmentType.CENTER,
  spacing: { before: extra.before ?? 120, after: extra.after ?? 120 },
});
const sceneBreak = () => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun('\u2726   \u2726   \u2726')] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const boxed = (lines) => lines.map((l, i) => new Paragraph({
  children: runs(l, { size: 20, color: '444444' }),
  alignment: AlignmentType.CENTER,
  spacing: { before: i === 0 ? 240 : 0, after: i === lines.length - 1 ? 240 : 40 },
  border: {
    top: i === 0 ? { style: BorderStyle.DASHED, size: 6, color: '888888', space: 8 } : undefined,
    bottom: i === lines.length - 1 ? { style: BorderStyle.DASHED, size: 6, color: '888888', space: 8 } : undefined,
    left: { style: BorderStyle.DASHED, size: 6, color: '888888', space: 8 },
    right: { style: BorderStyle.DASHED, size: 6, color: '888888', space: 8 },
  },
}));

// ---------- illustration placeholders, by chapter number ----------
const ILLUS = {
  1: ['I-1', 'The chart drawer: Mara at the lamp-room table, the map half-drawing itself.'],
  2: ['I-2', 'Nan on the harbour steps, tilting the map to the light. Fog on Wren Bridge.'],
  3: ['I-3', 'Walking on light: three children on the Lamp Road; a gull frozen above the lighthouse.'],
  5: ['I-4', 'The toll token: Grandma Tull at the tollhouse window; the bell board legible.'],
  6: ['I-5', 'Follow the bees: Bea points along a line of bees while the boys argue.'],
  8: ['I-6', 'The Ropewalk: Idris winds silver thread round the brake, high over the Slack.'],
  9: ['I-7', 'The underside: Mara standing upside down beneath the Orchard.'],
  11: ['I-8', 'The Night Market: Tavi faces his mother among lantern-lit boats.'],
  12: ['I-9', 'The last toll: Bellbridge fading, bells falling; the crew watch from the coracle.'],
  15: ['I-10', 'Behind the stars: the float-lift and the star-chart wall.'],
  18: ['I-11', 'Low breath: four children share the last flapjack, the map between them.'],
  22: ['I-12', 'The Great Chart: the Surveyor at the window, Mara with her torch.'],
  24: ['S-1', 'Mara and Nan drawing a pencil map, with a gap in the harbour wall.'],
};
const PRINT = path.join(ROOT, 'build', 'print');
const SIZES = fs.existsSync(path.join(PRINT, 'sizes.json')) ? JSON.parse(fs.readFileSync(path.join(PRINT, 'sizes.json'), 'utf8')) : {};
const imgFile = (id) => {
  const [a, n] = id.split('-');
  for (const name of [`${a}-${n.padStart(2, '0')}`, id]) {
    const f = path.join(PRINT, name + '.jpg');
    if (fs.existsSync(f)) return f;
  }
  return null;
};
const picture = (f, maxW, maxH) => {
  const [w, h] = SIZES[path.basename(f, '.jpg')];
  const k = Math.min(maxW / w, maxH / h);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 },
    children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(f), transformation: { width: Math.round(w * k), height: Math.round(h * k) } })] });
};
const placeholder = (id, desc) => {
  const f = imgFile(id);
  return f ? [picture(f, 430, 300)] : boxed([`**[ILLUSTRATION ${id}]**`, `*${desc}*`]);
};

// ---------- generic markdown block renderer ----------
function renderBlocks(md, { chapterMode = false } = {}) {
  const lines = md.split('\n');
  const out = [];
  let para = [];
  let chapterNo = 0;
  let firstAfterHeading = false;
  let listId = 0, inList = false;
  const words = ['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty','Twenty-One','Twenty-Two','Twenty-Three','Twenty-Four'];

  const flush = () => {
    if (!para.length) return;
    const text = para.join(' ').trim();
    para = [];
    if (!text) return;
    if (/^\*\*[A-Z][A-Z ,'-]+\*\*$/.test(text) && chapterMode) {
      out.push(centred(text, { run: { size: 20 }, before: 200, after: 200 }));
      return;
    }
    out.push(body(text, { noIndent: firstAfterHeading }));
    firstAfterHeading = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^# /.test(line)) { flush(); continue; } // file titles handled by caller
    if (/^## /.test(line)) {
      flush();
      const title = line.slice(3).trim();
      if (chapterMode) {
        chapterNo = words.indexOf(title.replace('Chapter ', '')) + 1;
        const sub = (lines[i + 1] || '').startsWith('### ') ? lines[++i].slice(4).trim() : '';
        out.push(pageBreak());
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Chapter ${chapterNo}`, break: 0 }), new TextRun({ text: sub, break: 1 })] }));
        if (ILLUS[chapterNo]) out.push(...placeholder(...ILLUS[chapterNo]));
      } else {
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(title) }));
        const backPic = /Equipment/.test(title) ? 'B-1' : /Design Your Own Island/.test(title) ? 'B-3' : null;
        if (backPic && imgFile(backPic)) out.push(picture(imgFile(backPic), 400, 500));
      }
      firstAfterHeading = true;
      continue;
    }
    if (/^### /.test(line)) { flush(); out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(line.slice(4)) })); firstAfterHeading = true; continue; }
    if (/^---\s*$/.test(line)) {
      flush();
      // scene break, unless the next non-blank line is a chapter heading
      let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && !/^## /.test(lines[j]) && chapterMode) { out.push(sceneBreak()); firstAfterHeading = true; }
      else if (!chapterMode && j < lines.length && !/^## /.test(lines[j])) out.push(sceneBreak());
      continue;
    }
    if (/^> /.test(line) || line === '>') {
      flush();
      const block = [];
      while (i < lines.length && (/^> /.test(lines[i]) || lines[i] === '>')) { block.push(lines[i].replace(/^> ?/, '')); i++; }
      i--;
      block.filter(Boolean).forEach((b, k, arr) => out.push(new Paragraph({
        children: runs(b, { size: 21 }), alignment: AlignmentType.CENTER,
        spacing: { before: k === 0 ? 160 : 0, after: k === arr.length - 1 ? 160 : 20 },
        indent: { left: 400, right: 400 },
      })));
      firstAfterHeading = true;
      continue;
    }
    if (/^(\d+)\. /.test(line)) { flush(); if (!inList) { listId++; inList = true; } out.push(new Paragraph({ numbering: { reference: 'nums', level: 0, instance: listId }, children: runs(line.replace(/^\d+\. /, '')), spacing: { after: 60 } })); continue; }
    if (/^- /.test(line)) { flush(); out.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: runs(line.slice(2)), spacing: { after: 40 } })); continue; }
    if (!line.trim()) { flush(); continue; }
    inList = false;
    // lines inside back matter that should stay separate (label: value lines)
    if (!chapterMode && /^(What it does|Its limit|Its cost|Watch out):/.test(line)) { flush(); out.push(body(line, { noIndent: true })); continue; }
    para.push(line.trim());
  }
  flush();
  return out;
}

// ---------- document plumbing ----------
const styles = {
  default: { document: { run: { font: FONT, size: 23 } } },
  paragraphStyles: [
    { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 56, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 } } },
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 34, bold: true }, paragraph: { spacing: { before: 600, after: 360 }, keepNext: true, outlineLevel: 0 } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { spacing: { before: 280, after: 140 }, keepNext: true, outlineLevel: 1 } },
    { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, italics: true }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
  ],
};
const numbering = { config: [
  { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } } } }] },
  { reference: 'nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 300 } } } }] },
] };
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] });
// A5 page
const page = { size: { width: 8391, height: 11906 }, margin: { top: 1000, bottom: 1000, left: 950, right: 950, footer: 500 } };

async function save(doc, name) {
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(ROOT, name), buf);
  console.log('wrote', name);
}

(async () => {
  // ----- the book -----
  const manuscript = read('02-manuscript.md');
  const back = read('06-back-matter.md');
  const titles = [...manuscript.matchAll(/^## Chapter (.+)\n### (.+)$/gm)];
  const contents = titles.map((m, k) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${k + 1}.  `, bold: true }), new TextRun(m[2])] }));
  contents.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: 'For Explorers: equipment, puzzles and your own island', italics: true })] }));
  const front = [
    new Paragraph({ spacing: { before: 2600 } }),
    new Paragraph({ style: 'Title', children: [new TextRun('The Map That Forgot Home')] }),
    centred('*Four friends. Three days. A way home that is disappearing.*', { after: 1600 }),
    centred('[Author name]', { run: { size: 26 } }),
    centred('Illustrated by [Illustrator name]', { run: { size: 20 } }),
    pageBreak(),
    new Paragraph({ spacing: { before: 4000 } }),
    centred('Text © [Author name], [Year]. Illustrations © [Illustrator name], [Year].', { run: { size: 18 } }),
    centred('All rights reserved. Draft manuscript, not for distribution.', { run: { size: 18 } }),
    pageBreak(),
    new Paragraph({ spacing: { before: 3000 } }),
    centred('*For everyone who has ever left a gap for the wanderers.*', { run: { size: 24 } }),
    pageBreak(),
    new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, children: [new TextRun('Contents')] }),
    ...contents,
  ];
  const coverFile = imgFile('cover-0') ? null : (fs.existsSync(path.join(PRINT, 'cover.jpg')) ? path.join(PRINT, 'cover.jpg') : null);
  const mapFile = fs.existsSync(path.join(PRINT, 'map.jpg')) ? path.join(PRINT, 'map.jpg') : null;
  const chapters = renderBlocks(manuscript.slice(manuscript.indexOf('## Chapter One')), { chapterMode: true });
  const backHead = [pageBreak(), new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun('For Explorers')] })];
  const backBlocks = renderBlocks(back.replace(/^# .*\n/, '').replace(/\n---\n\n## Answers/, '\n\n## Answers'));
  // Answers on their own page
  const ansIdx = backBlocks.findIndex(p => JSON.stringify(p).includes('"Answers"'));
  if (ansIdx > 0) backBlocks.splice(ansIdx, 0, pageBreak());
  // Each back-matter section on a new page
  const withBreaks = [];
  backBlocks.forEach((b, k) => {
    const s = JSON.stringify(b);
    if (k > 0 && s.includes('Heading2') && !s.includes('"Answers"')) withBreaks.push(pageBreak());
    withBreaks.push(b);
  });

  const book = new Document({
    title: 'The Map That Forgot Home', creator: '[Author name]', styles, numbering,
    features: { updateFields: true },
    sections: [
      ...(coverFile ? [{ properties: { page: { size: page.size, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
        children: [picture(coverFile, 560, 793)] }] : []),
      { properties: { page }, footers: { default: footer }, children: front },
      { properties: { page: { size: { width: page.size.width, height: page.size.height, orientation: PageOrientation.LANDSCAPE }, margin: { top: 700, bottom: 700, left: 800, right: 800 } } },
        children: [new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun('Map of the Fold')] }),
          ...(mapFile ? [picture(mapFile, 660, 400)] : boxed(['**[FRONT MAP]**']))] },
      { properties: { page }, footers: { default: footer }, children: [...chapters.slice(1), ...backHead, ...withBreaks] },
    ],
  });
  await save(book, 'The-Map-That-Forgot-Home.docx');

  // ----- submission pack -----
  const sub = read('07-submission-pack.md');
  const subDoc = new Document({
    title: 'The Map That Forgot Home: Submission Pack', creator: '[Author name]', styles, numbering,
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
      footers: { default: footer },
      children: renderBlocks(sub.replace(/^# .*\n/, '').replace('\n---\n\n## Synopsis', '\n\n## Synopsis'))
        .flatMap(p => JSON.stringify(p).includes('"Synopsis"') ? [pageBreak(), p] : [p]) }],
  });
  await save(subDoc, 'Submission-Pack.docx');
})();
