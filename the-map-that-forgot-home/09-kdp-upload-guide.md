# Amazon KDP Upload Guide: Paperback

## The two files
| File | What it is | Size |
|---|---|---|
| `KDP-Interior.pdf` | The inside pages: 116 pages, black and white, fonts embedded | 5.5 × 8.5 in, no bleed |
| `KDP-Cover.pdf` | The full wrap-around cover: back, spine and front | 11.511 × 8.750 in (includes 0.125 in bleed; spine 0.261 in) |

## Before you upload: fill in your details
1. Open `build/build-kdp.js` and edit the `BOOK` settings at the top: `author`, `illustrator`, `year` and `isbn`.
2. Rebuild by running `node build/build-kdp.js` from the book folder, or ask Claude to do it.
   - The cover's spine width depends on the page count. The build calculates it automatically, so always rebuild the cover whenever the text changes.

## Settings to choose on KDP (Paperback Content page)
- **Print ISBN:** use KDP's free ISBN, or your own. If you use KDP's, rebuild afterwards so the ISBN appears on the copyright page.
- **Interior and paper type:** **Black & white interior, white paper.** Don't choose colour; it costs far more per copy.
- **Trim size:** **5.5 × 8.5 in (13.97 × 21.59 cm)**.
- **Bleed settings:** **No bleed**.
- **Paperback cover finish:** **Matte** suits this cover's soft, painterly look. Glossy makes the colours pop more. Either works.
- **Manuscript:** upload `KDP-Interior.pdf`.
- **Cover:** choose **Upload a cover you already have** and upload `KDP-Cover.pdf`.
- **Barcode:** leave the bottom-right of the back cover empty. KDP adds the barcode there automatically.

## AI-generated content
On the KDP content page, KDP asks whether the book contains AI-generated content. Answer **Yes** for the **images** (they were made with ChatGPT). If you wrote or edited the text with AI help, answer according to KDP's definitions on that page.

## Check the proof
1. Use KDP's **Launch Previewer** and flip through every page. Look for text near the edges, picture placement, and chapters starting cleanly.
2. Order **one printed proof copy** before publishing. Check:
   - the picture sharpness, especially the cover, which was enlarged from the original image;
   - that the spine text sits centred on the spine;
   - how the colours look on paper (printed colours often come out a little darker than on screen).

## Pricing note
A 116-page black-and-white paperback at this size has a low printing cost on KDP. Children's novels of this length usually sell for about £6.99–£7.99 (US $7.99–$9.99). KDP shows your exact royalty for each price as you type it in.
