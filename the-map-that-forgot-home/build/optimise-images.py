# Makes smaller copies of images/*.png in build/print/ for the Word file.
# Inside pictures become greyscale JPEGs; cover and colour map stay in colour.
import json, pathlib
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'build' / 'print'; out.mkdir(exist_ok=True)
sizes = {}
for p in sorted((root / 'images').glob('*.png')):
    im = Image.open(p)
    colour = p.stem in ('cover', 'map-colour')
    im = im.convert('RGB' if colour else 'L')
    im.thumbnail((1600, 1600))
    dest = out / (p.stem + '.jpg')
    im.save(dest, 'JPEG', quality=85, optimize=True)
    sizes[p.stem] = list(im.size)
(out / 'sizes.json').write_text(json.dumps(sizes))
print(len(sizes), 'images optimised')
