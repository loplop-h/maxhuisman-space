/* ═══════════════════════════════════════════════════════════════════════
   maxhuisman.space — loplop://session
   one viewport, scenes morph as you scroll
   ═══════════════════════════════════════════════════════════════════════ */

gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// shared mutable state declared up-front so all functions can access it
let _typeTimer = null;
const _entered = new Set();

// ── scenes (in order) ──────────────────────────────────────────────────
const SCENES = [
    { id: 'whoami',   cmd: 'whoami',                    path: '~/identity'       },
    { id: 'toolkit',  cmd: 'tree ~/toolkit',            path: '~/toolkit'        },
    { id: 'rewind',   cmd: 'cat projects/rewind.md',    path: '~/projects/rewind' },
    { id: 'stratum',  cmd: 'cat projects/stratum.md',   path: '~/projects/stratum' },
    { id: 'others',   cmd: 'ls ~/projects/',            path: '~/projects'       },
    { id: 'timeline', cmd: 'git log --career --oneline', path: '~/career'         },
    { id: 'process',  cmd: 'cat ~/process.md',          path: '~/process'        },
    { id: 'contact',  cmd: 'contact --send',            path: '~/contact'        },
];

// ── early-exit for reduced motion users ────────────────────────────────
if (REDUCED_MOTION) {
    document.querySelectorAll('.scene').forEach(s => {
        s.style.opacity = 1;
        s.classList.add('is-active');
    });
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count, 10);
        el.textContent = target.toLocaleString('en-US') + (el.dataset.suffix || '');
    });
    initClock();
} else {
    initLenis();
    initScenes();
    initLoplopBird();
    initClock();
    initEasterEgg();
}

// ═══════════════════════════════════════════════════════════════════════
// Lenis smooth scroll
// ═══════════════════════════════════════════════════════════════════════
function initLenis() {
    if (typeof Lenis === 'undefined') return;
    const lenis = new Lenis({
        duration: 1.1,
        easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.6,
    });
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
}

// ═══════════════════════════════════════════════════════════════════════
// Scenes: scroll-driven crossfade + per-scene reveal
// ═══════════════════════════════════════════════════════════════════════
function initScenes() {
    const sceneEls = SCENES.map(s => document.querySelector(`.scene[data-scene="${s.id}"]`));
    const total = SCENES.length;

    // Spacer height = N scenes × 100vh
    document.getElementById('spacer').style.height = `${total * 100}vh`;

    // Initial state: all scenes hidden, first visible
    sceneEls.forEach((el, i) => {
        gsap.set(el, { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 20 });
    });
    sceneEls[0].classList.add('is-active');

    // Type the first command immediately
    typeCommand(SCENES[0].cmd);
    setSceneMeta(0);

    // ── Master ScrollTrigger drives scene swaps ────────────────────────
    let currentIdx = 0;

    ScrollTrigger.create({
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        invalidateOnRefresh: true,
        onUpdate: (self) => {
            const progress = self.progress;
            updateScrollUI(progress);

            // Determine active scene index with hysteresis (small dead-zone
            // around boundaries so wiggling doesn't trigger swap thrash)
            const raw = progress * total;
            let idx = Math.min(total - 1, Math.floor(raw));
            const frac = raw - idx;
            // If we're within 5% of a boundary on the leaving side, stick
            if (idx !== currentIdx) {
                if (idx === currentIdx + 1 && frac < 0.05) return;
                if (idx === currentIdx - 1 && frac > 0.95) return;
                swapScene(currentIdx, idx, sceneEls);
                currentIdx = idx;
            }
        },
    });

    // Re-measure on resize / orientation change so scene boundaries stay correct
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
    });

    // First scene's counters animate on load
    runCountersFor(sceneEls[0]);

    // ── Hide scroll cue after first interaction ────────────────────────
    const cue = document.getElementById('scrollCue');
    if (cue) {
        const fadeCue = () => {
            gsap.to(cue, { opacity: 0, duration: 0.5, onComplete: () => cue.style.display = 'none' });
        };
        ScrollTrigger.create({
            trigger: document.body,
            start: 'top top',
            end: '5% top',
            onLeave: fadeCue,
        });
    }
}

function swapScene(fromIdx, toIdx, els) {
    if (fromIdx === toIdx) return;

    const from = els[fromIdx];
    const to = els[toIdx];
    const goingForward = toIdx > fromIdx;

    // Mark active state immediately (single source of truth)
    els.forEach(el => el.classList.remove('is-active'));
    to.classList.add('is-active');

    // Force ALL non-participating scenes to a clean hidden state.
    // This handles fast-scroll skips: scenes the user blew past
    // would otherwise be left in a half-faded state.
    els.forEach((el, i) => {
        if (i !== fromIdx && i !== toIdx) {
            gsap.killTweensOf(el);
            gsap.set(el, { opacity: 0, y: 20 });
        }
    });

    // Outgoing — overwrite kills any in-progress tween on this element
    gsap.to(from, {
        opacity: 0,
        y: goingForward ? -24 : 24,
        duration: 0.4,
        ease: 'power2.in',
        overwrite: 'auto',
    });

    // Incoming
    gsap.fromTo(to,
        { opacity: 0, y: goingForward ? 24 : -24 },
        {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: 'power3.out',
            overwrite: 'auto',
        }
    );

    // Type new prompt + update meta
    typeCommand(SCENES[toIdx].cmd);
    setSceneMeta(toIdx);

    // Trigger one-shot scene-specific animations + counters
    triggerSceneEntry(SCENES[toIdx].id, to);
    runCountersFor(to);
}

function runCountersFor(el) {
    const counters = el.querySelectorAll('[data-count]');
    counters.forEach(c => {
        if (c.dataset._counted === '1') return;
        c.dataset._counted = '1';
        const target = parseInt(c.dataset.count, 10);
        const suffix = c.dataset.suffix || '';
        const obj = { v: 0 };
        gsap.to(obj, {
            v: target,
            duration: 1.6,
            ease: 'power3.out',
            onUpdate: () => {
                c.textContent = formatNum(Math.round(obj.v)) + suffix;
            },
        });
    });
}

function setSceneMeta(idx) {
    const scene = SCENES[idx];
    const pathEl = document.getElementById('framePath');
    const idxEl  = document.getElementById('sceneIdx');
    if (pathEl) pathEl.textContent = scene.path;
    if (idxEl)  idxEl.textContent  = String(idx + 1).padStart(2, '0');
}

function updateScrollUI(progress) {
    const pct = Math.round(progress * 100);
    const bar = document.getElementById('scrollBar');
    const lbl = document.getElementById('scrollPct');
    if (bar) bar.style.setProperty('--scroll-pct', pct + '%');
    if (lbl) lbl.textContent = pct + '%';
}

// ═══════════════════════════════════════════════════════════════════════
// Per-scene one-shot animations (toolkit lines, terminal lines, etc.)
// ═══════════════════════════════════════════════════════════════════════
function triggerSceneEntry(id, el) {
    // Already played? still re-run lightweight ones for consistency
    const isFirst = !_entered.has(id);
    _entered.add(id);

    switch (id) {
        case 'whoami':
            if (isFirst) {
                gsap.from(el.querySelectorAll('.whoami-name .given, .whoami-name .family'), {
                    opacity: 0, y: 24, duration: 0.9, stagger: 0.15, ease: 'power3.out',
                });
                gsap.from(el.querySelectorAll('.strip-cell'), {
                    opacity: 0, y: 12, duration: 0.5, stagger: 0.1, delay: 0.6, ease: 'power2.out',
                });
                gsap.from(el.querySelector('.whoami-stats'), {
                    opacity: 0, y: 20, duration: 0.7, delay: 0.9, ease: 'power3.out',
                });
            }
            break;

        case 'toolkit':
            // Draw connection lines, then pop nodes
            gsap.fromTo(el.querySelectorAll('.link'),
                { strokeDashoffset: 1200 },
                { strokeDashoffset: 0, duration: 1.4, stagger: 0.08, ease: 'power2.inOut' }
            );
            gsap.fromTo(el.querySelectorAll('.node'),
                { scale: 0, opacity: 0, transformOrigin: '50% 50%' },
                { scale: 1, opacity: 1, duration: 0.55, stagger: 0.12, delay: 0.4, ease: 'back.out(2)' }
            );
            gsap.fromTo(el.querySelectorAll('.toolkit-center, .toolkit-center-sub'),
                { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 1.0, stagger: 0.1 }
            );
            gsap.fromTo(el.querySelector('.toolkit-thesis'),
                { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, delay: 1.3, ease: 'power3.out' }
            );
            break;

        case 'rewind':
            if (isFirst) {
                gsap.from(el.querySelector('.rewind-title'),  { opacity: 0, x: -20, duration: 0.6, ease: 'power2.out' });
                gsap.from(el.querySelector('.rewind-pitch'),  { opacity: 0, x: -20, duration: 0.6, delay: 0.15, ease: 'power2.out' });
                gsap.from(el.querySelectorAll('.rewind-bullets li'), {
                    opacity: 0, x: -16, duration: 0.5, stagger: 0.08, delay: 0.3, ease: 'power2.out',
                });
                gsap.from(el.querySelector('.rewind-stack'), {
                    opacity: 0, y: 10, duration: 0.5, delay: 0.65, ease: 'power2.out',
                });
                gsap.from(el.querySelector('.mini-terminal'), {
                    opacity: 0, scale: 0.97, duration: 0.6, delay: 0.2, ease: 'power3.out',
                });
                gsap.from(el.querySelectorAll('.mini-body .rt-line'), {
                    opacity: 0, x: -10, duration: 0.35, stagger: 0.09, delay: 0.6, ease: 'power2.out',
                });
                gsap.from(el.querySelector('.rewind-stats'), {
                    opacity: 0, y: 12, duration: 0.5, delay: 1.4, ease: 'power2.out',
                });
            }
            break;

        case 'stratum':
            if (isFirst) {
                gsap.from(el.querySelector('.stratum-title'), {
                    opacity: 0, letterSpacing: '0.5em', duration: 0.9, ease: 'power3.out',
                });
                gsap.from(el.querySelector('.stratum-pitch'), {
                    opacity: 0, y: 14, duration: 0.6, delay: 0.4, ease: 'power3.out',
                });
                gsap.from(el.querySelectorAll('.sn-cell'), {
                    opacity: 0, y: 20, duration: 0.6, stagger: 0.1, delay: 0.5, ease: 'power3.out',
                });
                gsap.from(el.querySelectorAll('.store, .store-link'), {
                    opacity: 0, scale: 0.85, duration: 0.5, stagger: 0.08, delay: 0.9, ease: 'back.out(2)',
                });
                gsap.from(el.querySelectorAll('.stratum-stack span'), {
                    opacity: 0, y: 8, duration: 0.4, stagger: 0.04, delay: 1.2, ease: 'power2.out',
                });
            }
            break;

        case 'others':
            if (isFirst) {
                gsap.from(el.querySelector('.scene-headline'), {
                    opacity: 0, y: 16, duration: 0.6, ease: 'power2.out',
                });
                gsap.from(el.querySelectorAll('.other-card'), {
                    opacity: 0, y: 28, duration: 0.65, stagger: 0.12, delay: 0.2, ease: 'power3.out',
                });
            }
            break;

        case 'timeline':
            if (isFirst) {
                gsap.from(el.querySelector('.scene-headline'), {
                    opacity: 0, y: 14, duration: 0.5, ease: 'power2.out',
                });
                // animate the line drawing
                gsap.fromTo(el.querySelector('.career'),
                    { '--line-grow': '0%' },
                    { '--line-grow': '100%', duration: 1.0, delay: 0.2 }
                );
                gsap.from(el.querySelectorAll('.evt'), {
                    opacity: 0, x: -16, duration: 0.5, stagger: 0.1, delay: 0.3, ease: 'power2.out',
                });
            }
            break;

        case 'process':
            if (isFirst) {
                gsap.from(el.querySelector('.manifesto'), {
                    opacity: 0, y: 20, duration: 0.9, ease: 'power3.out',
                });
                gsap.from(el.querySelectorAll('.tenet'), {
                    opacity: 0, y: 24, duration: 0.6, stagger: 0.12, delay: 0.4, ease: 'power3.out',
                });
                gsap.from(el.querySelector('.learning'), {
                    opacity: 0, y: 14, duration: 0.5, delay: 0.9, ease: 'power2.out',
                });
            }
            break;

        case 'contact':
            if (isFirst) {
                gsap.from(el.querySelectorAll('.contact-cta .accent-coral, .contact-cta'), {
                    opacity: 0, y: 28, duration: 0.7, stagger: 0.05, ease: 'power3.out',
                });
                gsap.from(el.querySelectorAll('.ci'), {
                    opacity: 0, y: 16, duration: 0.5, stagger: 0.1, delay: 0.3, ease: 'power2.out',
                });
                gsap.from(el.querySelector('.contact-status'), {
                    opacity: 0, scale: 0.9, duration: 0.5, delay: 0.9, ease: 'back.out(2)',
                });
                gsap.from(el.querySelector('.contact-loplop'), {
                    opacity: 0, y: 12, duration: 0.6, delay: 1.1, ease: 'power2.out',
                });
            }
            break;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Prompt command typewriter
// ═══════════════════════════════════════════════════════════════════════
function typeCommand(text) {
    if (_typeTimer) { clearTimeout(_typeTimer); _typeTimer = null; }
    const target = document.getElementById('promptCmd');
    if (!target) return;
    target.textContent = '';
    let i = 0;
    const tick = () => {
        if (i < text.length) {
            target.textContent += text[i];
            i++;
            _typeTimer = setTimeout(tick, 20 + Math.random() * 35);
        }
    };
    tick();
}

function formatNum(n) {
    if (n >= 1000) return n.toLocaleString('en-US');
    return n.toString();
}

// ═══════════════════════════════════════════════════════════════════════
// Loplop bird drift
// ═══════════════════════════════════════════════════════════════════════
function initLoplopBird() {
    const bird = document.getElementById('loplopBird');
    if (!bird) return;

    // Fade in
    gsap.to(bird, { opacity: 0.7, duration: 1.2, delay: 0.8, ease: 'power2.out' });

    // Drift across stage based on scroll progress
    const path = [
        { x: '0vw',   y: '0vh',  r: 0   },
        { x: '-12vw', y: '6vh',  r: -8  },
        { x: '-30vw', y: '-2vh', r: 5   },
        { x: '-55vw', y: '8vh',  r: -10 },
        { x: '-75vw', y: '0vh',  r: 6   },
        { x: '-50vw', y: '-6vh', r: -4  },
        { x: '-20vw', y: '4vh',  r: 8   },
        { x: '0vw',   y: '0vh',  r: 0   },
    ];

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: document.body,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.5,
        },
    });

    path.slice(1).forEach((p) => {
        tl.to(bird, {
            x: p.x,
            y: p.y,
            rotate: p.r,
            duration: 1,
            ease: 'sine.inOut',
        });
    });

    // Subtle idle wing-tilt
    gsap.to(bird, {
        rotate: '+=2',
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
    });
}

// ═══════════════════════════════════════════════════════════════════════
// Clock
// ═══════════════════════════════════════════════════════════════════════
function initClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    const tick = () => {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        el.textContent = `${hh}:${mm}:${ss}`;
    };
    tick();
    setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════════════════
// Easter egg
// ═══════════════════════════════════════════════════════════════════════
function initEasterEgg() {
    console.log(
        '%c$ rewind --portfolio\n%c✓ session.log loaded\n# you\'re looking at it.',
        'color: #76C8FF; font-family: monospace; font-size: 14px;',
        'color: #95F2A8; font-family: monospace; font-size: 12px;'
    );
    console.log(
        '%cBuilt by Max Ernst Huisman Gutiérrez · available now.\nmaxernstprojects@gmail.com · maxhuisman.space',
        'color: #E55934; font-family: monospace; font-size: 12px;'
    );

    // Konami: ↑↑↓↓←→←→BA → coral mode
    let buf = [];
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    window.addEventListener('keydown', (e) => {
        buf.push(e.key);
        if (buf.length > code.length) buf.shift();
        if (buf.join() === code.join()) {
            document.documentElement.style.setProperty('--bg', '#1a0a0a');
            document.documentElement.style.setProperty('--bg-2', '#2a0f0f');
            console.log('%c🐦 loplop is awake.', 'color: #E55934; font-size: 16px; font-weight: bold;');
        }
    });
}
