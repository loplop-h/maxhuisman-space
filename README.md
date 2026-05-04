# maxhuisman.space

One-page portfolio for **Max Ernst Huisman Gutiérrez** — built as a single fixed terminal viewport that morphs through 8 scenes as you scroll. No multi-page scrolling. The page itself stays put; the content transforms.

```
loplop://session
├── index.html      ← single-page layout, semantic HTML
├── styles.css      ← brand palette (slate + coral), JetBrains Mono + Inter + Fraunces
├── script.js       ← GSAP + ScrollTrigger + Lenis smooth scroll
└── README.md       ← this file
```

## Concept

**One terminal, eight scenes.** A fixed `loplop@huisman:~$` frame fills the viewport. The scrollbar drives a master timeline — the prompt re-types itself with a new command at each scene boundary, the output area crossfades, counters scrub through their range, the toolkit SVG redraws its connection lines, the loplop bird drifts across the stage. You never leave the terminal.

| Scene | Command | Content |
|------:|---------|---------|
| 01 | `whoami` | name, role, status, four stat counters |
| 02 | `tree ~/toolkit` | four PyPI packages connected as a graph (rewind, spent, mcpguard, debtx) |
| 03 | `cat projects/rewind.md` | featured deep-dive — terminal demo + bullets + key stats |
| 04 | `cat projects/stratum.md` | full-stack proof — 28K+ FDA, 4 numbers, 3 data stores |
| 05 | `ls ~/projects/` | spent + mcpguard + debtx as cards |
| 06 | `git log --career --oneline` | timeline with live PR + RSME distinction |
| 07 | `cat ~/process.md` | manifesto + 3 tenets + currently learning |
| 08 | `contact --send` | email/phone/github/linkedin + available-now status |

## Local preview

```bash
cd web
python -m http.server 8766
# open http://localhost:8766
```

Or any other static server.

## Deploy

Three options, ranked by simplicity for the `maxhuisman.space` domain (registered through Cloudflare):

### 1. Cloudflare Pages (recommended — domain is already there)
1. Push `web/` to a GitHub repo (e.g. `loplop-h/maxhuisman-space`)
2. https://dash.cloudflare.com → Pages → Create project → connect repo
3. Build command: empty · Output directory: `/`
4. Workers & Pages → Custom domains → `maxhuisman.space`
5. Live in ~30 seconds, automatic HTTPS, edge-cached worldwide

### 2. Netlify
- Drag-drop `web/` onto https://app.netlify.com/drop
- Add custom domain in Site settings → Domain → point DNS

### 3. Vercel
```bash
cd web && npx vercel deploy --prod
```

## Tech

- **GSAP 3.12.5** + **ScrollTrigger** for the master scrub timeline and per-scene reveals
- **Lenis 1.3.23** for buttery smooth scroll (CDN, ~10kb)
- **No build step** — vanilla JS, plain CSS, single HTML file
- **No backend** — purely static
- **Reduced-motion fallback** — `@media (prefers-reduced-motion: reduce)` stacks all scenes statically

## Brand palette

```
slate-darkest:  #0A1220  ← page background
slate-dark:     #0F1C30
slate:          #1F4E79  ← brand primary
slate-light:    #3A6FA0
slate-faint:    #76C8FF  ← terminal output highlights
coral:          #E55934  ← accents, anchor metrics
cream:          #F5F7FA  ← body text
green:          #1A7F37  ← "available now" status
gold:           #F0B429  ← distinction (RSME)
```

Fonts: **Inter** (UI) + **JetBrains Mono** (terminal, metadata) + **Fraunces** (display serif for the name and the manifesto).

## Tweaking

All copy lives in `index.html`. Common edits:

- Hero name: `<h1 class="whoami-name">` in scene 1
- Stats: `data-count` + `data-suffix` attributes (numbers scrub up as you scroll into view)
- Scene commands: edit the `cmd` field in the `SCENES` array in `script.js`
- Scene order: rearrange the `<section class="scene">` elements + the `SCENES` array (keep them aligned)
- Brand palette: `:root` in `styles.css`

## Easter egg

Konami code (↑↑↓↓←→←→BA) flips the page into "loplop coral mode". Open the console for the boot sequence.

## License

MIT — fork the layout, swap the content. Loplop is reusable.

---

<sub>"Loplop" is Max Ernst's bird-form alter ego. The surrealist painter who is the namesake's namesake.</sub>
