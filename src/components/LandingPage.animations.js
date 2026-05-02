/* eslint-disable */
// Scroll-driven animations for LandingPage. Plain JS to keep DOM access loose.
// Called once after the landing markup is mounted; exposes window.__qmLandingCleanup
// for the parent component's unmount.

export function runLandingAnimations() {
  'use strict';
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const nav = document.getElementById('nav');
  let lastScrolled = false;
  const onNavScroll = () => {
    const s = window.scrollY > 40;
    if (s !== lastScrolled) {
      nav && nav.classList.toggle('scrolled', s);
      lastScrolled = s;
    }
  };
  window.addEventListener('scroll', onNavScroll, { passive: true });
  onNavScroll();

  const reveals = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealObs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -80px 0px' }
  );
  reveals.forEach((el) => revealObs.observe(el));
  requestAnimationFrame(() => {
    document.querySelectorAll('.hero .reveal').forEach((el) => el.classList.add('in'));
  });

  const blobA = document.querySelector('[data-blob="a"]');
  const blobB = document.querySelector('[data-blob="b"]');
  const blobC = document.querySelector('[data-blob="c"]');
  const hero = document.getElementById('hero');

  const canvas = document.getElementById('storyCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const story = document.getElementById('story');
  const storySteps = document.querySelectorAll('.story-step');
  const storyH2 = document.getElementById('storyH2');

  const resizeCanvas = () => {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function getStoryProgress() {
    if (!story) return 0;
    const r = story.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const scrolled = -r.top;
    return clamp(scrolled / total, 0, 1);
  }

  const isLight = () => document.documentElement.classList.contains('light');

  function drawStory(p) {
    if (!canvas || !ctx) return;
    const W = canvas.clientWidth,
      H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2,
      cy = H / 2;
    const light = isLight();
    const text = light ? '#1A1713' : '#FFFFFF';
    const muted = light ? '#5C5346' : '#94A3B8';
    const border = light ? '#ECE6D8' : '#2D2E35';
    const surface = light ? '#FFFDF8' : '#1B1C20';
    const surface2 = light ? '#FAF7F0' : '#15161A';
    const mint = '#10B981';

    const docVis =
      clamp((p - 0.05) / 0.07, 0, 1) * (1 - clamp((p - 0.3) / 0.06, 0, 1));
    const parseScan = clamp((p - 0.12) / 0.18, 0, 1);
    const gradeVis =
      clamp((p - 0.36) / 0.06, 0, 1) * (1 - clamp((p - 0.62) / 0.06, 0, 1));
    const gradeFill = clamp((p - 0.42) / 0.2, 0, 1);
    const quizVis = clamp((p - 0.68) / 0.06, 0, 1);
    const quizReveal = clamp((p - 0.74) / 0.2, 0, 1);
    const stageB = parseScan;

    if (docVis > 0.001) {
      const docX = cx - 180;
      const docY = cy - 230;
      const docW = 360,
        docH = 460;
      ctx.save();
      ctx.globalAlpha = docVis;
      roundRect(ctx, docX, docY, docW, docH, 16);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = surface2;
      ctx.beginPath();
      ctx.moveTo(docX + docW - 28, docY);
      ctx.lineTo(docX + docW, docY + 28);
      ctx.lineTo(docX + docW - 28, docY + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = text;
      ctx.globalAlpha *= 0.95;
      roundRect(ctx, docX + 28, docY + 36, 200, 14, 4);
      ctx.fill();
      const lineCount = 14;
      for (let i = 0; i < lineCount; i++) {
        const yy = docY + 76 + i * 24;
        const isHead = i % 5 === 0;
        const lp = clamp(docVis * 1.5 - i * 0.04, 0, 1);
        const wide = (docW - 56) * (0.55 + 0.4 * Math.sin(i * 1.7 + 1));
        ctx.globalAlpha = docVis * lp;
        if (isHead) {
          ctx.fillStyle = text;
          roundRect(ctx, docX + 28, yy - 6, wide * 0.5, 9, 3);
        } else {
          ctx.fillStyle = muted;
          roundRect(ctx, docX + 28, yy - 4, wide, 5, 3);
        }
        ctx.fill();
      }
      if (parseScan > 0 && parseScan < 1) {
        const scanY = docY + 30 + ease(parseScan) * (docH - 60);
        ctx.globalAlpha = docVis * (1 - Math.abs(parseScan - 0.5) * 1.4) * 0.7;
        const grad = ctx.createLinearGradient(docX, scanY - 30, docX, scanY + 30);
        grad.addColorStop(0, 'rgba(16,185,129,0)');
        grad.addColorStop(0.5, 'rgba(16,185,129,0.35)');
        grad.addColorStop(1, 'rgba(16,185,129,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(docX, scanY - 30, docW, 60);
      }
      ctx.restore();
    }

    if (docVis > 0.5 && parseScan > 0.05 && parseScan < 0.95) {
      const pCount = 50;
      for (let i = 0; i < pCount; i++) {
        const seed = i * 0.137;
        const lp = (stageB * 1.2 + seed) % 1;
        const sx = cx - 180 + 360 - 30;
        const sy = cy - 230 + 60 + ((i * 41) % (460 - 100));
        const ex = cx + 140;
        const ey = cy + Math.sin(i) * 60;
        const x = lerp(sx, ex, ease(lp));
        const y = lerp(sy, ey, ease(lp)) + Math.sin(lp * Math.PI * 2 + i) * 14;
        const a = Math.sin(lp * Math.PI) * 0.85;
        ctx.globalAlpha = a * docVis;
        ctx.fillStyle = mint;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + Math.sin(lp * Math.PI) * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (gradeVis > 0.001) {
      const gW = 360,
        gH = 240;
      const gX = cx - gW / 2;
      const gY = cy - gH / 2;
      const sc = lerp(0.92, 1, ease(gradeVis));
      ctx.save();
      ctx.globalAlpha = gradeVis;
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -cy);
      roundRect(ctx, gX, gY, gW, gH, 16);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = mint;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textBaseline = 'top';
      ctx.fillText('● DIFFICULTY MIX', gX + 24, gY + 22);
      ctx.fillStyle = text;
      ctx.font = '500 22px "Fraunces", serif';
      ctx.fillText('Difficulty distribution', gX + 24, gY + 46);
      const items = [
        { label: 'Easy', v: 0.45, c: 'rgba(167,243,208,1)' },
        { label: 'Medium', v: 0.72, c: '#10B981' },
        { label: 'Hard', v: 0.88, c: '#059669' },
      ];
      items.forEach((it, i) => {
        const yy = gY + 96 + i * 38;
        ctx.fillStyle = text;
        ctx.font = '500 13px "Inter", sans-serif';
        ctx.fillText(it.label, gX + 24, yy);
        ctx.fillStyle = muted;
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(it.v * 100) + '%', gX + gW - 24, yy);
        ctx.textAlign = 'left';
        ctx.fillStyle = border;
        roundRect(ctx, gX + 24, yy + 18, gW - 48, 6, 3);
        ctx.fill();
        const fillW = (gW - 48) * it.v * clamp(gradeFill * 1.4 - i * 0.15, 0, 1);
        ctx.fillStyle = it.c;
        roundRect(ctx, gX + 24, yy + 18, fillW, 6, 3);
        ctx.fill();
      });
      ctx.restore();
    }

    if (quizVis > 0.001) {
      const qW = 480,
        qH = 340;
      const qX = cx - qW / 2;
      const qY = cy - qH / 2;
      const sc = lerp(0.92, 1, ease(quizVis));
      ctx.save();
      ctx.globalAlpha = quizVis;
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -cy);
      ctx.shadowColor = 'rgba(16,185,129,0.3)';
      ctx.shadowBlur = 32;
      roundRect(ctx, qX, qY, qW, qH, 20);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(16,185,129,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(16,185,129,0.18)';
      roundRect(ctx, qX + 28, qY + 28, 116, 26, 13);
      ctx.fill();
      ctx.fillStyle = mint;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('● BIOLOGY · Q7', qX + 40, qY + 41);
      ctx.fillStyle = text;
      ctx.font = 'italic 600 22px "Fraunces", serif';
      ctx.textBaseline = 'top';
      const qText = 'Which organ regulates blood sugar?';
      const maxQW = qW - 56;
      const words = qText.split(' ');
      let line = '',
        lines = [];
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxQW && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      lines.forEach((ln, li) => ctx.fillText(ln, qX + 28, qY + 76 + li * 28));
      const opts = ['A.   Pancreas', 'B.   Liver', 'C.   Kidney', 'D.   Heart'];
      ctx.font = '500 14px "Inter", sans-serif';
      opts.forEach((opt, i) => {
        const yy = qY + 140 + i * 36;
        const oa = clamp(quizReveal * 2 - i * 0.2, 0, 1);
        ctx.globalAlpha = quizVis * oa;
        const correct = i === 0;
        if (correct && quizReveal > 0.5) {
          ctx.fillStyle = 'rgba(16,185,129,0.18)';
          roundRect(ctx, qX + 28, yy - 8, qW - 56, 28, 8);
          ctx.fill();
          ctx.fillStyle = mint;
        } else {
          ctx.fillStyle = muted;
        }
        ctx.fillText(opt, qX + 40, yy);
        if (correct && quizReveal > 0.75) {
          ctx.fillStyle = mint;
          ctx.font = 'bold 14px "Inter", sans-serif';
          ctx.fillText('✓', qX + qW - 42, yy);
          ctx.font = '500 14px "Inter", sans-serif';
        }
      });
      ctx.globalAlpha = quizVis;
      ctx.restore();
    }
  }

  function updateStorySteps(p) {
    const stages = [0.0, 0.2, 0.5, 0.8];
    let active = 0;
    stages.forEach((s, i) => {
      if (p >= s) active = i;
    });
    storySteps.forEach((el, i) => el.classList.toggle('active', i === active));
    const titles = [
      'Drop in <em class="italic mint">messy notes.</em>',
      'Watch us <em class="italic mint">read between</em> the lines.',
      'Score every question against <em class="italic mint">how hard it really is.</em>',
      'Pull out a <em class="italic mint">real quiz.</em>',
    ];
    if (storyH2 && storyH2.dataset.idx !== String(active)) {
      storyH2.dataset.idx = String(active);
      storyH2.style.opacity = 0;
      setTimeout(() => {
        storyH2.innerHTML = '<span>' + titles[active] + '</span>';
        storyH2.style.opacity = 1;
      }, 200);
    }
  }
  if (storyH2) storyH2.style.transition = 'opacity 0.4s ease';

  function buildVisual0() {
    const el = document.getElementById('visual0');
    if (!el) return;
    el.innerHTML = `
      <div id="v0wrap" style="position:relative; width:100%; height:100%;">
        <div class="src-stack" style="position:absolute; left:0; top:50%; transform:translateY(-50%); width:220px; height:280px;">
          ${[0, 1, 2]
            .map(
              (i) => `
            <div class="src-card" data-src="${i}" style="
              position:absolute; top:${i * 10}px; left:${i * 8}px;
              width:200px; height:260px;
              background: var(--surface); border:1px solid var(--border);
              border-radius:14px; padding:18px;
              transform: rotate(${(i - 1) * -3}deg);
              box-shadow: 0 16px 32px -12px rgba(0,0,0,0.4);
              z-index:${3 - i};
            ">
              ${Array.from({ length: 7 })
                .map(
                  (_, j) => `
                <div style="
                  height:${j === 0 ? 9 : 5}px; border-radius:2px;
                  background:${j === 0 ? 'var(--text)' : 'var(--muted)'};
                  opacity:${j === 0 ? 0.9 : 0.4};
                  width:${50 + ((j * 17) % 50)}%;
                  margin-bottom:10px;"></div>`
                )
                .join('')}
            </div>`
            )
            .join('')}
        </div>
        ${[0, 1, 2]
          .map(
            (i) => `
          <div class="out-card" data-out="${i}" style="
            position:absolute; top:${20 + i * 130}px; right:0;
            width:240px; padding:14px;
            background: var(--bg2); border:1px solid color-mix(in oklab, var(--mint) 50%, transparent);
            border-radius:12px;
            box-shadow: 0 8px 24px -8px color-mix(in oklab, var(--mint) 40%, transparent);
            opacity:0; transform: translateX(40px);
            transition: opacity 0.6s ease, transform 0.6s ease;
          ">
            <div class="mono mint" style="font-size:9px; font-weight:700; letter-spacing:0.2em; margin-bottom:6px;">
              Q${i + 1} · ${['EASY', 'MEDIUM', 'HARD'][i]}
            </div>
            <div style="font-size:13px; font-weight:500; color: var(--text); line-height:1.4;">
              ${['What is the function of mitochondria?', 'How does ATP synthase work?', 'Predict the reaction product...'][i]}
            </div>
          </div>`
          )
          .join('')}
        <svg id="v0svg" style="position:absolute; inset:0; pointer-events:none; width:100%; height:100%; overflow:visible;">
          ${[0, 1, 2]
            .map(
              (i) =>
                `<path data-line="${i}" stroke="var(--mint)" stroke-width="1.5" fill="none" stroke-dasharray="4 4" opacity="0" />`
            )
            .join('')}
        </svg>
      </div>`;
    requestAnimationFrame(layoutVisual0Lines);
  }
  function layoutVisual0Lines() {
    const wrap = document.getElementById('v0wrap');
    if (!wrap) return;
    const svg = document.getElementById('v0svg');
    if (!svg) return;
    const wRect = wrap.getBoundingClientRect();
    const topSrc = wrap.querySelector('[data-src="2"]');
    if (!topSrc) return;
    const sRect = topSrc.getBoundingClientRect();
    const sx = sRect.right - wRect.left;
    const sy = sRect.top + sRect.height / 2 - wRect.top;
    [0, 1, 2].forEach((i) => {
      const out = wrap.querySelector('[data-out="' + i + '"]');
      const line = svg.querySelector('[data-line="' + i + '"]');
      if (!out || !line) return;
      const oRect = out.getBoundingClientRect();
      const ex = oRect.left - wRect.left;
      const ey = oRect.top + oRect.height / 2 - wRect.top;
      const cx1 = sx + (ex - sx) * 0.5;
      const d =
        'M ' + sx + ' ' + sy + ' C ' + cx1 + ' ' + sy + ', ' + cx1 + ' ' + ey + ', ' + ex + ' ' + ey;
      line.setAttribute('d', d);
    });
  }
  window.addEventListener('resize', () => requestAnimationFrame(layoutVisual0Lines));
  function animateVisual0(progress) {
    const outs = document.querySelectorAll('#visual0 [data-out]');
    const lines = document.querySelectorAll('#visual0 [data-line]');
    outs.forEach((el, i) => {
      const lp = clamp(progress * 1.6 - i * 0.18, 0, 1);
      el.style.opacity = lp;
      el.style.transform = 'translateX(' + (1 - lp) * 40 + 'px)';
    });
    lines.forEach((el, i) => {
      const lp = clamp(progress * 1.6 - i * 0.18, 0, 1);
      el.setAttribute('opacity', String(lp * 0.6));
    });
    layoutVisual0Lines();
  }

  function buildVisual1() {
    const el = document.getElementById('visual1');
    if (!el) return;
    el.innerHTML = `
      <div style="
        width:100%; height:100%;
        background: var(--surface); border:1px solid var(--border);
        border-radius:20px; padding:32px;
        display:flex; flex-direction:column; gap:18px;
        box-shadow: 0 24px 48px -12px rgba(0,0,0,0.4);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="mono mint" style="font-size:11px; letter-spacing:0.2em; font-weight:700;">● DIFFICULTY MIX</span>
          <span class="mono" style="font-size:11px; color:var(--subtle);">24 questions</span>
        </div>
        <h4 class="serif" style="font-size:28px; margin:0; letter-spacing:-0.02em;">Difficulty distribution</h4>
        ${[
          { l: 'Easy', v: 0.45, c: '#A7F3D0' },
          { l: 'Medium', v: 0.72, c: '#10B981' },
          { l: 'Hard', v: 0.88, c: '#059669' },
        ]
          .map(
            (it, i) => `
          <div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span style="font-size:14px; font-weight:500;">${it.l}</span>
              <span class="mono" style="font-size:13px; color:var(--muted);">${Math.round(it.v * 100)}%</span>
            </div>
            <div style="height:8px; border-radius:99px; background:var(--border); overflow:hidden;">
              <div data-bar="${i}" data-v="${it.v}"
                style="height:100%; width:0%;
                background:${it.c}; border-radius:99px;
                box-shadow: 0 0 12px ${it.c}88;
                transition: width 0.7s cubic-bezier(.2,.7,.2,1);"></div>
            </div>
          </div>`
          )
          .join('')}
        <div style="
          margin-top:auto; padding:16px; border-radius:12px;
          background: color-mix(in oklab, var(--mint) 10%, transparent);
          border: 1px solid color-mix(in oklab, var(--mint) 30%, transparent);
          font-size:13px; color:var(--text); line-height:1.5;">
          <span class="mint" style="font-weight:600;">Tip · </span>
          Most quiz tools only ask easy questions. We mix in the hard ones too.
        </div>
      </div>`;
  }
  function animateVisual1(progress) {
    const bars = document.querySelectorAll('#visual1 [data-bar]');
    bars.forEach((el, i) => {
      const v = parseFloat(el.dataset.v);
      const lp = clamp(progress * 1.6 - i * 0.15, 0, 1);
      el.style.width = lp * v * 100 + '%';
    });
  }

  function buildVisual2() {
    const el = document.getElementById('visual2');
    if (!el) return;
    el.innerHTML = `
      <div style="
        width:100%; height:100%;
        background: var(--surface); border:1px solid var(--border);
        border-radius:20px; padding:32px;
        display:flex; flex-direction:column; gap:14px;
        box-shadow: 0 24px 48px -12px rgba(0,0,0,0.4);
      ">
        <span class="mono mint" style="font-size:11px; letter-spacing:0.2em; font-weight:700;">● QUESTION 7 · ORGANIC CHEM</span>
        <h4 class="serif" style="font-size:24px; margin:0; line-height:1.2; letter-spacing:-0.02em;">
          The SN1 reaction proceeds through which intermediate?
        </h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:4px;">
          ${['Carbocation', 'Free radical', 'Carbanion', 'Concerted transition state']
            .map((opt, i) => {
              const correct = i === 0;
              return `<div style="
                padding:10px 14px; border-radius:10px;
                background: ${correct ? 'color-mix(in oklab, var(--mint) 14%, transparent)' : 'transparent'};
                border: 1px solid ${correct ? 'color-mix(in oklab, var(--mint) 60%, transparent)' : 'var(--border)'};
                font-size:13px;
                color: ${correct ? 'var(--mint)' : 'var(--muted)'};
                font-weight: ${correct ? 600 : 500};
                display:flex; justify-content:space-between; align-items:center;">
                <span>${String.fromCharCode(65 + i)}. ${opt}</span>
                ${correct ? '<span style="font-size:12px;">✓</span>' : ''}
              </div>`;
            })
            .join('')}
        </div>
        <div data-explain style="
          margin-top:4px; padding:16px; border-radius:12px;
          background: color-mix(in oklab, var(--bg) 80%, var(--bg2));
          border: 1px dashed color-mix(in oklab, var(--mint) 60%, transparent);
          opacity: 0; transform: translateY(16px);
          transition: opacity 0.6s ease, transform 0.6s ease;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span class="mono mint" style="font-size:10px; letter-spacing:0.2em; font-weight:700;">WHY ↓</span>
          </div>
          <p style="margin:0; font-size:13px; line-height:1.55; color:var(--text);">
            SN1 is unimolecular: the leaving group departs first, forming a planar
            <em class="italic mint">carbocation</em> intermediate before the nucleophile attacks.
          </p>
        </div>
      </div>`;
  }
  function animateVisual2(progress) {
    const ex = document.querySelector('#visual2 [data-explain]');
    if (!ex) return;
    const lp = clamp(progress * 1.6 - 0.4, 0, 1);
    ex.style.opacity = lp;
    ex.style.transform = 'translateY(' + (1 - lp) * 16 + 'px)';
  }

  buildVisual0();
  buildVisual1();
  buildVisual2();

  function getFeatureProgress(idx) {
    const sec = document.querySelector('[data-feature="' + idx + '"]');
    if (!sec) return 0;
    const r = sec.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const scrolled = -r.top;
    return clamp(scrolled / total, 0, 1);
  }
  function applyFeatureMotion(idx) {
    const sec = document.querySelector('[data-feature="' + idx + '"]');
    if (!sec) return;
    const txt = sec.querySelector('.feature-text');
    const visual = sec.querySelector('.feature-visual');
    const p = getFeatureProgress(idx);
    const enter = clamp(p / 0.4, 0, 1);
    const exit = clamp((p - 0.7) / 0.3, 0, 1);
    const v = enter * (1 - exit);
    if (txt) {
      txt.style.opacity = v;
      txt.style.transform = 'translateX(' + (1 - enter) * -40 + 'px)';
    }
    if (visual) {
      visual.style.opacity = v;
      visual.style.transform =
        'translateX(' + (1 - enter) * 40 + 'px) scale(' + lerp(0.92, 1, enter) + ')';
    }
  }

  const parallaxSec = document.getElementById('parallax');
  const parallaxBack = document.getElementById('parallaxBack');
  const parallaxMid = document.getElementById('parallaxMid');
  const parallaxFront = document.getElementById('parallaxFront');

  let ticking = false;
  function tick() {
    ticking = false;
    const vh = window.innerHeight;
    if (blobA && hero) {
      const heroRect = hero.getBoundingClientRect();
      const heroP = clamp(-heroRect.top / vh, 0, 1);
      blobA.style.transform = 'translate3d(' + heroP * -80 + 'px, ' + heroP * 60 + 'px, 0)';
      blobB.style.transform = 'translate3d(' + heroP * 60 + 'px, ' + heroP * -50 + 'px, 0)';
      blobC.style.transform = 'translate(-50%, -50%) translate3d(0, ' + heroP * 40 + 'px, 0)';
    }
    if (story) {
      const storyRect = story.getBoundingClientRect();
      if (storyRect.bottom > 0 && storyRect.top < vh) {
        const p = getStoryProgress();
        drawStory(p);
        updateStorySteps(p);
      }
    }
    [0, 1, 2].forEach((i) => {
      const sec = document.querySelector('[data-feature="' + i + '"]');
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      if (r.bottom > -200 && r.top < vh + 200) {
        applyFeatureMotion(i);
        const p = getFeatureProgress(i);
        const enter = clamp(p / 0.5, 0, 1);
        if (i === 0) animateVisual0(enter);
        if (i === 1) animateVisual1(enter);
        if (i === 2) animateVisual2(enter);
      }
    });
    if (parallaxSec) {
      const pr = parallaxSec.getBoundingClientRect();
      if (pr.bottom > 0 && pr.top < vh) {
        const total = pr.height + vh;
        const scrolled = vh - pr.top;
        const p = clamp(scrolled / total, 0, 1);
        const offset = (p - 0.5) * 220;
        if (parallaxBack) parallaxBack.style.transform = 'translate3d(0, ' + offset * 0.3 + 'px, 0)';
        if (parallaxMid) parallaxMid.style.transform = 'translate3d(0, ' + offset * -0.4 + 'px, 0)';
        if (parallaxFront) parallaxFront.style.transform = 'translate3d(0, ' + offset * -0.7 + 'px, 0)';
      }
    }
  }
  function requestTick() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(tick);
    }
  }
  const onScroll = requestTick;
  const onResize = () => {
    resizeCanvas();
    requestTick();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  requestTick();

  window.__qmLandingCleanup = function () {
    window.removeEventListener('scroll', onNavScroll);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('resize', resizeCanvas);
    try {
      revealObs.disconnect();
    } catch (e) {}
    delete window.__qmLandingCleanup;
  };
}
