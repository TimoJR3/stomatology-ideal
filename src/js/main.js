/* Логика сайта. Данные берутся из config.js, здесь их менять не нужно. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // тексты
  $$("[data-cfg]").forEach((el) => {
    const v = CONFIG[el.dataset.cfg];
    if (v) el.textContent = v;
  });

  // ссылки
  // в ссылки попадают только допустимые символы, даже если в CONFIG вставить лишнее
  const hrefs = {
    tel: "tel:" + String(CONFIG.phoneTel).replace(/[^\d+]/g, ""),
    whatsapp: "https://wa.me/" + String(CONFIG.whatsapp).replace(/\D/g, ""),
    telegram: "https://t.me/" + String(CONFIG.telegram).replace(/[^A-Za-z0-9_]/g, ""),
  };
  $$("[data-href]").forEach((a) => { a.href = hrefs[a.dataset.href]; });

  // цены
  const rows = $("#price-rows");
  if (rows) {
    rows.replaceChildren();
    CONFIG.prices.forEach(([name, price]) => {
      const tr = document.createElement("tr");
      const a = document.createElement("td"); a.textContent = name;
      const b = document.createElement("td"); b.textContent = price + " " + CONFIG.currency;
      tr.append(a, b); rows.append(tr);
    });
  }

  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  // «Записаться» в услугах — выбирает услугу в форме
  const form = $("#booking-form");
  const service = $("#f-service");
  $$("[data-service]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.service;
      if ([...service.options].some((o) => o.value === val)) service.value = val;
      $("#booking").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      setTimeout(() => $("#f-name").focus({ preventScroll: true }), 600);
    });
  });

  // форма-заглушка: проверяет поля и показывает сообщение, никуда не отправляет
  const status = $("#form-status");
  const setErr = (name, on) => {
    const field = form.elements[name].closest(".field");
    if (field) field.classList.toggle("invalid", on);
    else $('[data-err="' + name + '"]').classList.toggle("show", on);
  };
  // Защита от ботов (работает и после подключения настоящей отправки):
  // 1) скрытое поле-ловушка, 2) слишком быстрая отправка, 3) пауза между заявками.
  // Это только первый фильтр в браузере; основная защита — на стороне приёма заявок.
  const loadedAt = Date.now();
  let lastSentAt = 0;
  const submitBtn = form.querySelector('[type="submit"]');
  const fakeOk = () => {
    status.className = "form-status ok";
    status.textContent = "Заявка отправлена (демо).";
    form.reset();
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form.elements.website.value || Date.now() - loadedAt < 2500) return fakeOk();
    if (Date.now() - lastSentAt < 30000) {
      status.className = "form-status";
      status.textContent = "Заявка уже отправлена. Повторить можно через 30 секунд.";
      return;
    }
    const name = form.elements.name.value.trim().slice(0, 80);
    const digits = form.elements.phone.value.replace(/\D/g, "");
    const consent = form.elements.consent.checked;
    setErr("name", !name);
    setErr("phone", digits.length < 10);
    setErr("consent", !consent);
    if (!name) return form.elements.name.focus();
    if (digits.length < 10) return form.elements.phone.focus();
    if (!consent) return form.elements.consent.focus();

    // textContent, а не innerHTML: введённый текст никогда не исполняется как код
    status.className = "form-status ok";
    status.textContent = "Заявка отправлена (демо). " + name + ", в рабочей версии сайта администратор перезвонит вам по номеру " + form.elements.phone.value.slice(0, 25) + ".";
    form.reset();
    lastSentAt = Date.now();
    submitBtn.disabled = true;
    setTimeout(() => { submitBtn.disabled = false; }, 30000);
  });
  ["name", "phone"].forEach((n) => form.elements[n].addEventListener("input", () => setErr(n, false)));
  form.elements.consent.addEventListener("change", () => setErr("consent", false));
})();
