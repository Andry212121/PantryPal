# Reads the manuscript aloud with a local British voice and writes one MP3 per chapter.
import re, sys, subprocess, pathlib, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
SCR = pathlib.Path(__file__).parent
ROOT = pathlib.Path('/home/user/PantryPal/the-map-that-forgot-home')
OUT = ROOT / 'audiobook'; OUT.mkdir(exist_ok=True)
VOICE, SPEED = 'bf_emma', 0.95
k = Kokoro(str(SCR / 'voices/kokoro-v1.0.onnx'), str(SCR / 'voices/voices-v1.0.bin'))
WORDS = ['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty','Twenty-One','Twenty-Two','Twenty-Three','Twenty-Four']

def clean(t):
    t = t.replace('&nbsp;', ' ').replace('·', ',')
    t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t); t = re.sub(r'\*([^*]+)\*', r'\1', t)
    t = re.sub(r'^>\s?', '', t, flags=re.M)
    return re.sub(r'\s+', ' ', t).strip()

def speak(text):
    a, sr = k.create(text, voice=VOICE, speed=SPEED, lang='en-gb'); return a, sr

def chapter_blocks(md):
    """Return list of (kind, text) where kind is 'p' or 'break'."""
    blocks, para = [], []
    def flush():
        if para: blocks.append(('p', clean(' '.join(para)))); para.clear()
    for line in md.split('\n'):
        if line.strip() == '---': flush(); blocks.append(('break', '')); continue
        if not line.strip(): flush(); continue
        if line.startswith('>'):  # notices: read each line as its own sentence
            flush(); txt = clean(line)
            if txt: blocks.append(('p', txt if txt.endswith(('.', '!', '?', ':')) else txt + '.'))
            continue
        para.append(line)
    flush()
    return [b for b in blocks if b[0] == 'break' or b[1]]

def render(name, title_line, blocks, tag_title, track):
    out = OUT / f'{name}.mp3'
    if out.exists(): print('skip', name); return
    sr = 24000; pieces = []
    gap = lambda s: np.zeros(int(sr * s), dtype=np.float32)
    a, sr = speak(title_line); pieces += [a, gap(1.4)]
    for kind, txt in blocks:
        if kind == 'break': pieces.append(gap(1.3)); continue
        # long paragraphs: split into sentences of manageable size
        chunks, cur = [], ''
        for s in re.split(r'(?<=[.!?…”"])\s+', txt):
            if len(cur) + len(s) > 400 and cur: chunks.append(cur); cur = s
            else: cur = (cur + ' ' + s).strip()
        if cur: chunks.append(cur)
        for c in chunks:
            a, sr = speak(c); pieces += [a, gap(0.15)]
        pieces.append(gap(0.45))
    wav = SCR / f'{name}.wav'; sf.write(wav, np.concatenate(pieces), sr)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-ac', '1', '-b:a', '64k',
        '-metadata', f'title={tag_title}', '-metadata', 'album=The Map That Forgot Home', '-metadata', 'artist=[Author Name]',
        '-metadata', f'track={track}', str(out)], check=True)
    wav.unlink(); print('done', name, flush=True)

ms = (ROOT / '02-manuscript.md').read_text()
ms = ms[ms.index('## Chapter One'):]
parts = re.split(r'^## Chapter (.+)\n### (.+)\n', ms, flags=re.M)
render('00-Opening', 'The Map That Forgot Home. Four friends. Three days. A way home that is disappearing.', [], 'Opening', 0)
for i in range(1, len(parts), 3):
    word, title, body = parts[i], parts[i + 1], parts[i + 2]
    n = WORDS.index(word) + 1
    render(f'{n:02d}-Chapter-{n}', f'Chapter {word}. {clean(title)}.', chapter_blocks(body), f'Chapter {n}: {clean(title)}', n)
print('ALL DONE')
