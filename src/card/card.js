/* Визитка: контакты, врачи, работы «до/после», «Поделиться». Данные — из ../config.js.
   Весь текст выводится через textContent; внешние ссылки допускаются только https://. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const httpsOnly = (u) => { try { const x = new URL(u); return x.protocol === "https:" ? x.href : null; } catch { return null; } };
  const localPath = (p) => (typeof p === "string" && /^[\w-]+(\/[\w.-]+)*\.(svg|jpe?g|png|webp|avif)$/i.test(p) ? p : null);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- тексты и ссылки ---------- */
  $$("[data-cfg]").forEach((n) => { const v = CONFIG[n.dataset.cfg]; if (v) n.textContent = v; });
  const hrefs = {
    tel: "tel:" + String(CONFIG.phoneTel).replace(/[^\d+]/g, ""),
    whatsapp: "https://wa.me/" + String(CONFIG.whatsapp).replace(/\D/g, ""),
    telegram: "https://t.me/" + String(CONFIG.telegram).replace(/[^A-Za-z0-9_]/g, ""),
    map: httpsOnly(CONFIG.mapUrl),
    map2gis: httpsOnly(CONFIG.map2gisUrl),
    site: httpsOnly(CONFIG.siteUrl),
  };
  $$("[data-href]").forEach((a) => { const h = hrefs[a.dataset.href]; if (h) a.href = h; });

  const social = $("#social");
  (CONFIG.social || []).forEach(([name, url]) => {
    const h = httpsOnly(url); if (!h) return;
    const a = el("a", null, name); a.href = h; a.target = "_blank"; a.rel = "noopener"; social.append(a);
  });

  /* ---------- врачи ---------- */
  const team = $("#team-list");
  (CONFIG.team || []).forEach((d) => {
    const li = el("li", "doc");
    const ph = el("div", "doc-ph", "фото"); ph.setAttribute("aria-hidden", "true");
    const box = el("div");
    box.append(el("h3", null, d.name), el("p", "doc-role", d.role));
    const ul = el("ul"); (d.facts || []).forEach((f) => ul.append(el("li", null, f)));
    box.append(ul);
    // личные кнопки связи врача (только заполненные)
    const links = el("div", "doc-links");
    const add = (text, href, ext) => { const a = el("a", null, text); a.href = href; if (ext) { a.target = "_blank"; a.rel = "noopener"; } links.append(a); };
    const tel = String(d.phoneTel || "").replace(/[^\d+]/g, ""), wa = String(d.whatsapp || "").replace(/\D/g, ""), tg = String(d.telegram || "").replace(/[^A-Za-z0-9_]/g, "");
    if (tel.length >= 10) add("Позвонить", "tel:" + tel);
    if (wa.length >= 10) add("WhatsApp", "https://wa.me/" + wa, true);
    if (tg.length >= 5) add("Telegram", "https://t.me/" + tg, true);
    if (links.children.length) box.append(links);
    li.append(ph, box); team.append(li);
  });

  /* ---------- QR на экране ---------- */
  const dlg = $("#qr-dialog");
  $("#qr-open").addEventListener("click", () => (dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", "")));
  $("#qr-close").addEventListener("click", () => (dlg.close ? dlg.close() : dlg.removeAttribute("open")));
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // клик по фону закрывает

  /* ---------- до / после ---------- */
  const works = (CONFIG.works || []).filter((w) => localPath(w.before) && localPath(w.after));
  const tabs = $("#case-tabs"), frame = $(".ba-frame"), range = $("#ba-range");
  const imgBefore = $("#ba-before"), imgAfter = $("#ba-after");
  const setPos = (v) => frame.style.setProperty("--pos", v + "%");
  range.addEventListener("input", () => setPos(range.value));

  function show(i) {
    const w = works[i];
    imgBefore.src = w.before; imgAfter.src = w.after;
    imgBefore.alt = "До лечения: " + w.title; imgAfter.alt = "После лечения: " + w.title;
    $("#ba-title").textContent = w.title; $("#ba-method").textContent = w.method;
    [...tabs.children].forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    range.value = 50; setPos(50);
  }
  works.forEach((w, i) => {
    const t = el("button", "case-tab", "Случай " + (i + 1));
    t.type = "button"; t.setAttribute("role", "tab"); t.setAttribute("aria-controls", "ba");
    t.addEventListener("click", () => show(i));
    t.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return;
      e.preventDefault(); const n = (i + d + works.length) % works.length; show(n); tabs.children[n].focus();
    });
    tabs.append(t);
  });
  if (works.length) show(0); else $("#works").hidden = true;

  // подсказка: шторка один раз «покачивается», когда блок впервые появляется на экране
  if (works.length && !reduceMotion.matches && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const start = performance.now();
      (function wiggle(now) {
        const t = (now - start) / 1600; if (t >= 1) { setPos(range.value); return; }
        setPos((50 + Math.sin(t * Math.PI * 2) * 22 * (1 - t)).toFixed(1));
        requestAnimationFrame(wiggle);
      })(start);
    }, { threshold: 0.6 });
    io.observe(frame);
  }

  /* ---------- поделиться ---------- */
  const shareBtn = $("#share"), status = $("#share-status");
  const url = httpsOnly(CONFIG.cardUrl) || location.href;
  shareBtn.addEventListener("click", async () => {
    try {
      if (navigator.share) { await navigator.share({ title: CONFIG.clinicName, text: CONFIG.cardTagline, url }); return; }
      await navigator.clipboard.writeText(url);
      status.textContent = "Ссылка на визитку скопирована";
    } catch (err) {
      if (err && err.name === "AbortError") return; // пользователь закрыл окно «Поделиться»
      status.textContent = "Не получилось. Ссылка: " + url;
    }
  });
})();
