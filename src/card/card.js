/* Визитка «Стоматология IDEAL»: контакты, врачи, «Поделиться», QR на экране. Данные — из card-config.js.
   Весь текст выводится через textContent; внешние ссылки допускаются только https://. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const httpsOnly = (u) => { try { const x = new URL(u); return x.protocol === "https:" ? x.href : null; } catch { return null; } };

  /* ---------- тексты и ссылки ---------- */
  $$("[data-cfg]").forEach((n) => { const v = CARD[n.dataset.cfg]; if (v) n.textContent = v; });
  const hrefs = {
    tel: "tel:" + String(CARD.phoneTel).replace(/[^\d+]/g, ""),
    whatsapp: "https://wa.me/" + String(CARD.whatsapp).replace(/\D/g, ""),
    telegram: "https://t.me/" + String(CARD.telegram).replace(/[^A-Za-z0-9_]/g, ""),
    instagram: httpsOnly(CARD.instagram),
    map: httpsOnly(CARD.mapUrl),
    map2gis: httpsOnly(CARD.map2gisUrl),
  };
  // нет Telegram — кнопки Telegram нет (сетка кнопок перестраивается под 5 штук в card.css)
  if (String(CARD.telegram || "").replace(/[^A-Za-z0-9_]/g, "").length < 5) $$('[data-href="telegram"]').forEach((a) => a.remove());
  $$("[data-href]").forEach((a) => { const h = hrefs[a.dataset.href]; if (h) a.href = h; });
  // пустые строки контактов (например, часы работы) не показываем
  $$(".card-facts [data-cfg]").forEach((n) => { if (!CARD[n.dataset.cfg]) n.parentElement.remove(); });

  const social = $("#social");
  (CARD.social || []).forEach(([name, url]) => {
    const h = httpsOnly(url); if (!h) return;
    const a = el("a", null, name); a.href = h; a.target = "_blank"; a.rel = "noopener"; social.append(a);
  });

  /* ---------- врачи ---------- */
  const team = $("#team-list");
  (CARD.team || []).forEach((d) => {
    // фото — только локальный файл из папки team/ (без внешних ссылок)
    const photo = /^team\/[\w-]+\.(webp|jpe?g|png)$/.test(d.photo || "") ? d.photo : "";
    const li = el("li", photo ? "doc doc-has-photo" : "doc");
    let ph;
    if (photo) {
      // большой портрет: фото на всю ширину карточки, имя и должность поверх нижнего края
      ph = el("figure", "doc-photo");
      const img = el("img"); img.src = photo; img.alt = "Фото: " + d.name; img.width = 620; img.height = 479; img.loading = "lazy"; img.decoding = "async";
      const cap = el("figcaption");
      cap.append(el("h3", null, d.name), el("p", "doc-role", d.role));
      ph.append(img, cap);
    } else {
      // без фото — монограмма: инициалы в арке и значок специальности (у ортодонта зуб с брекетом)
      ph = el("div", "doc-mono"); ph.setAttribute("aria-hidden", "true");
      const initials = String(d.name).replace(/[[\]]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("class", "doc-mono-ico");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", /ортодонт/i.test(d.role) ? "#tooth" : "#tooth-plain");
      svg.append(use);
      ph.append(el("span", "doc-mono-txt", initials), svg);
    }
    const box = el("div", "doc-body");
    if (!photo) box.append(el("h3", null, d.name), el("p", "doc-role", d.role));
    const ul = el("ul"); (d.facts || []).forEach((f) => ul.append(el("li", null, f)));
    box.append(ul);
    // награды и сертификаты: ряд миниатюр с подписями, листается вбок; нажатие открывает целиком
    const awards = (Array.isArray(d.awards) ? d.awards : []).filter(([f]) => /^awards\/[\w-]+\.(webp|jpe?g|png)$/.test(f || ""));
    if (awards.length) {
      box.append(el("p", "doc-awards-h", "Награды и сертификаты"));
      const row = el("ul", "doc-awards");
      awards.forEach(([file, caption]) => {
        const li = el("li"), a = el("a"); a.href = file; a.target = "_blank"; a.rel = "noopener";
        const img = el("img"); img.src = file; img.alt = caption || "Награда"; img.width = 264; img.height = 200; img.loading = "lazy"; img.decoding = "async";
        a.append(img, el("span", null, caption || "")); li.append(a); row.append(li);
      });
      box.append(row);
    }
    const links = el("div", "doc-links");
    const add = (text, href, ext) => { const a = el("a", null, text); a.href = href; if (ext) { a.target = "_blank"; a.rel = "noopener"; } links.append(a); };
    const tel = String(d.phoneTel || "").replace(/[^\d+]/g, ""), wa = String(d.whatsapp || "").replace(/\D/g, ""), tg = String(d.telegram || "").replace(/[^A-Za-z0-9_]/g, "");
    if (tel.length >= 10) add("Позвонить", "tel:" + tel);
    if (wa.length >= 10) add("WhatsApp", "https://wa.me/" + wa, true);
    if (tg.length >= 5) add("Telegram", "https://t.me/" + tg, true);
    const own = httpsOnly(d.card || "");
    if (own) add("Визитка врача", own, true);
    if (links.children.length) box.append(links);
    li.append(ph, box); team.append(li);
  });

  /* ---------- QR на экране ---------- */
  const dlg = $("#qr-dialog");
  $("#qr-open").addEventListener("click", () => (dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", "")));
  $("#qr-close").addEventListener("click", () => (dlg.close ? dlg.close() : dlg.removeAttribute("open")));
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  /* ---------- поделиться ---------- */
  const shareBtn = $("#share"), status = $("#share-status");
  const url = httpsOnly(CARD.cardUrl) || location.href;
  shareBtn.addEventListener("click", async () => {
    try {
      if (navigator.share) { await navigator.share({ title: CARD.name, text: CARD.tagline, url }); return; }
      await navigator.clipboard.writeText(url);
      status.textContent = "Ссылка на визитку скопирована";
    } catch (err) {
      if (err && err.name === "AbortError") return;
      status.textContent = "Не получилось. Ссылка: " + url;
    }
  });
})();
