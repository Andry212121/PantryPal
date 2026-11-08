
import pathlib
from PIL import Image
src = pathlib.Path(r'/home/user/PantryPal/the-map-that-forgot-home/images'); out = pathlib.Path(r'/home/user/PantryPal/the-map-that-forgot-home/build/kdp')
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
