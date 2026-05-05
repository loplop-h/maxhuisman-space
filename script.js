/* ═══════════════════════════════════════════════════════════════════════
   maxhuisman.space — section-based portfolio
   Three.js robot protagonist + GSAP scroll-triggered section reveals
   ═══════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = window.matchMedia('(max-width: 900px)').matches;

const ROBOT_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

// ── Anchor positions per section ────────────────────────────────────────
// World coords: camera at (0, 1, 5), FOV 50, looking at (0, 0.6, 0).
// Visible width at z=0 ≈ 4.66 units. Robot is ~2 units tall, pivot at feet.
// Each anchor: { x, y, z, ry, anim, fov? }
const ANCHORS = {
    hero:     { x:  2.0, y: -1.0, z:  0.2, ry: -0.5, anim: 'Wave',     scale: 0.55 },
    about:    { x: -2.5, y: -1.7, z: -0.3, ry:  0.5, anim: 'Idle',     scale: 0.35 },
    toolkit:  { x:  2.6, y: -1.7, z: -0.3, ry: -0.5, anim: 'ThumbsUp', scale: 0.35 },
    rewind:   { x: -2.7, y: -1.6, z: -0.2, ry:  0.5, anim: 'Walking',  scale: 0.35 },
    stratum:  { x:  2.7, y: -1.6, z: -0.2, ry: -0.5, anim: 'Running',  scale: 0.35 },
    others:   { x: -2.6, y: -1.7, z: -0.3, ry:  0.5, anim: 'Yes',      scale: 0.35 },
    timeline: { x:  2.7, y: -1.6, z: -0.2, ry: -0.5, anim: 'Walking',  scale: 0.35 },
    process:  { x: -2.5, y: -1.5, z: -0.1, ry:  0.5, anim: 'Standing', scale: 0.4 },
    contact:  { x:  2.5, y: -1.3, z:  0.3, ry: -0.4, anim: 'Jump',     scale: 0.55 },
};

const CANVAS = document.getElementById('stage-canvas');
const BOOT = document.getElementById('boot');

if (REDUCED_MOTION) {
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count, 10);
        el.textContent = target.toLocaleString('en-US') + (el.dataset.suffix || '');
    });
    BOOT?.classList.add('gone');
} else {
    init3D();
    initSectionAnimations();
    initScrollProgress();
    initEasterEgg();
}

// ═══════════════════════════════════════════════════════════════════════
// Three.js scene
// ═══════════════════════════════════════════════════════════════════════
function init3D() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
        canvas: CANVAS,
        alpha: true,
        antialias: !IS_MOBILE,
        powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting — moody but readable on slate background
    const hemi = new THREE.HemisphereLight(0x76C8FF, 0x0A1220, 0.6);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const coralAccent = new THREE.PointLight(0xE55934, 0.6, 12);
    coralAccent.position.set(-3, 2, 3);
    scene.add(coralAccent);

    const slateAccent = new THREE.PointLight(0x76C8FF, 0.4, 12);
    slateAccent.position.set(3, -2, 2);
    scene.add(slateAccent);

    // Robot wrapper — gives us a stable pivot for positioning
    const robotPivot = new THREE.Group();
    scene.add(robotPivot);

    // Load robot
    const loader = new GLTFLoader();
    let mixer = null;
    let actions = {};
    let currentAction = null;

    loader.load(
        ROBOT_URL,
        (gltf) => {
            const robot = gltf.scene;
            robot.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = false;
                    if (c.material) {
                        c.material.metalness = 0.2;
                        c.material.roughness = 0.55;
                    }
                }
            });
            robotPivot.add(robot);

            mixer = new THREE.AnimationMixer(robot);
            gltf.animations.forEach((clip) => {
                actions[clip.name] = mixer.clipAction(clip);
            });

            // Set initial state to hero
            const hero = ANCHORS.hero;
            robotPivot.position.set(hero.x, hero.y, hero.z);
            robotPivot.rotation.y = hero.ry;
            robotPivot.scale.setScalar(hero.scale);
            playAnim(hero.anim);

            // Wire scroll-driven motion now that robot exists
            wireScrollMotion(robotPivot);
            wireSectionAnims();

            // Hide boot splash
            requestAnimationFrame(() => {
                BOOT?.classList.add('gone');
                setTimeout(() => BOOT?.remove(), 700);
            });
        },
        undefined,
        (err) => {
            console.warn('failed to load 3D model — continuing without robot', err);
            BOOT?.classList.add('gone');
        }
    );

    // Fallback timeout — if model takes too long, hide splash anyway
    setTimeout(() => BOOT?.classList.add('gone'), 4000);

    // ── Render loop ────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    function tick() {
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);
        renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(tick);

    // ── Resize ─────────────────────────────────────────────────────────
    let resizeT = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeT);
        resizeT = setTimeout(() => {
            const w = window.innerWidth, h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
            ScrollTrigger.refresh();
        }, 150);
    });

    // ── Animation switcher ─────────────────────────────────────────────
    function playAnim(name) {
        const action = actions[name];
        if (!action) return;
        if (action === currentAction) return;
        if (currentAction) currentAction.fadeOut(0.4);
        action.reset().fadeIn(0.4).play();
        currentAction = action;
    }

    // ── Scroll-driven robot motion ─────────────────────────────────────
    function wireScrollMotion(pivot) {
        const sections = Array.from(document.querySelectorAll('.section[data-anim]'));

        sections.forEach((section) => {
            const id = section.id;
            const anchor = ANCHORS[id];
            if (!anchor) return;

            // Position transition into this anchor
            gsap.to(pivot.position, {
                x: anchor.x, y: anchor.y, z: anchor.z,
                ease: 'power2.inOut',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 70%',
                    end: 'top 30%',
                    scrub: 1.2,
                },
            });
            gsap.to(pivot.rotation, {
                y: anchor.ry,
                ease: 'power2.inOut',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 70%',
                    end: 'top 30%',
                    scrub: 1.2,
                },
            });
            gsap.to(pivot.scale, {
                x: anchor.scale, y: anchor.scale, z: anchor.scale,
                ease: 'power2.inOut',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 70%',
                    end: 'top 30%',
                    scrub: 1.2,
                },
            });

            // Animation switch on enter
            ScrollTrigger.create({
                trigger: section,
                start: 'top 60%',
                end: 'bottom 40%',
                onEnter: () => playAnim(anchor.anim),
                onEnterBack: () => playAnim(anchor.anim),
            });
        });

        // Subtle idle bob — adds life independent of scroll
        gsap.to(pivot.position, {
            y: '+=0.06',
            duration: 2.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
        });
    }

    function wireSectionAnims() {
        // Set later; section animations are wired in initSectionAnimations
        // before the model loads, but ScrollTrigger.refresh() ensures
        // they recompute once the page is fully laid out.
        ScrollTrigger.refresh();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Per-section content reveals
// ═══════════════════════════════════════════════════════════════════════
function initSectionAnimations() {
    // ── Hero — display text characters slide up ──────────────────────────
    const display = document.querySelector('.display');
    if (display) {
        gsap.from(display.querySelectorAll('.d-line'), {
            opacity: 0, y: 50, duration: 1.0, stagger: 0.15, ease: 'power3.out',
        });
        gsap.from('.section-hero .lead, .section-hero .hero-cta, .section-hero .kicker', {
            opacity: 0, y: 24, duration: 0.7, stagger: 0.12, delay: 0.6, ease: 'power2.out',
        });
    }

    // ── Counters ────────────────────────────────────────────────────────
    document.querySelectorAll('[data-count]').forEach((el) => {
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        const obj = { v: 0 };
        ScrollTrigger.create({
            trigger: el,
            start: 'top 85%',
            once: true,
            onEnter: () => {
                gsap.to(obj, {
                    v: target,
                    duration: 1.6,
                    ease: 'power3.out',
                    onUpdate: () => {
                        el.textContent = formatNum(Math.round(obj.v)) + suffix;
                    },
                });
            },
        });
    });

    // ── Helper: explicit reveal pattern (avoids gsap.from+ScrollTrigger
    //   register-time race conditions where the tween's "from" state
    //   sticks even after the trigger fires).
    function revealOnEnter(targets, fromVars, toVars, triggerOpts) {
        const els = gsap.utils.toArray(targets);
        if (!els.length) return;
        gsap.set(els, fromVars);
        ScrollTrigger.create({
            ...triggerOpts,
            once: true,
            onEnter: () => gsap.to(els, { ...toVars, overwrite: 'auto' }),
        });
    }

    // ── Headlines ───────────────────────────────────────────────────────
    gsap.utils.toArray('.section:not(.section-hero) .kicker, .section .h-section, .feature-title, .stratum-title, .contact-cta, .manifesto').forEach((el) => {
        revealOnEnter(el,
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
            { trigger: el, start: 'top 85%' }
        );
    });

    // ── About body + stats ─────────────────────────────────────────────
    revealOnEnter('.section-about .body',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' },
        { trigger: '.section-about .body', start: 'top 85%' }
    );
    revealOnEnter('.stats-card .stat',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' },
        { trigger: '.stats-card', start: 'top 85%' }
    );

    // ── Toolkit cards ───────────────────────────────────────────────────
    revealOnEnter('.tool-card',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' },
        { trigger: '.toolkit-grid', start: 'top 85%' }
    );

    // ── Rewind ──────────────────────────────────────────────────────────
    revealOnEnter('.section-rewind .feature-pitch, .section-rewind .checklist li, .section-rewind .chips',
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' },
        { trigger: '.section-rewind', start: 'top 70%' }
    );
    revealOnEnter('.section-rewind .terminal-card',
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.7, ease: 'power3.out' },
        { trigger: '.section-rewind', start: 'top 70%' }
    );
    revealOnEnter('.section-rewind .terminal-body .tline',
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.08, delay: 0.2, ease: 'power2.out' },
        { trigger: '.section-rewind .terminal-card', start: 'top 75%' }
    );
    revealOnEnter('.section-rewind .feature-stats',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        { trigger: '.section-rewind .feature-stats', start: 'top 90%' }
    );

    // ── Stratum ─────────────────────────────────────────────────────────
    revealOnEnter('.section-stratum .feature-pitch, .section-stratum .stratum-stack > *, .section-stratum .chips',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' },
        { trigger: '.section-stratum', start: 'top 70%' }
    );
    revealOnEnter('.section-stratum .sn',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' },
        { trigger: '.stratum-numbers', start: 'top 80%' }
    );

    // ── Others ──────────────────────────────────────────────────────────
    revealOnEnter('.other-card',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' },
        { trigger: '.others-grid', start: 'top 85%' }
    );

    // ── Timeline ────────────────────────────────────────────────────────
    revealOnEnter('.evt',
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
        { trigger: '.career', start: 'top 80%' }
    );

    // ── Process tenets ──────────────────────────────────────────────────
    revealOnEnter('.tenet',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' },
        { trigger: '.tenets', start: 'top 85%' }
    );

    // ── Contact ─────────────────────────────────────────────────────────
    revealOnEnter('.ci',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
        { trigger: '.contact-grid', start: 'top 85%' }
    );
    revealOnEnter('.contact-status',
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' },
        { trigger: '.contact-status', start: 'top 90%' }
    );
}

// ═══════════════════════════════════════════════════════════════════════
// Scroll progress bar
// ═══════════════════════════════════════════════════════════════════════
function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    const update = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        bar.style.width = pct + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
}

// ═══════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════
function formatNum(n) {
    if (n >= 1000) return n.toLocaleString('en-US');
    return n.toString();
}

function initEasterEgg() {
    console.log(
        '%cmaxhuisman.space\n%c$ rewind --portfolio · ✓ session.log loaded',
        'color: #E55934; font-family: monospace; font-size: 14px; font-weight: bold;',
        'color: #76C8FF; font-family: monospace; font-size: 12px;'
    );
    console.log(
        '%cBuilt by Max Ernst Huisman Gutiérrez · available now\nmaxernstprojects@gmail.com · github.com/loplop-h',
        'color: #95F2A8; font-family: monospace; font-size: 12px;'
    );
}
