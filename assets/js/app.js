/* مكتبة صغار الباحثين — application script.
   Content lives in data/*.json; this file only renders it. To add documents, edit the JSON files (see README.md). */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ UI strings (Arabic; add fr/en later) */
  var UI = {
    home: "الرئيسية", search: "البحث المتقدم", lists: "قوائمي", guides: "أدلة البحث", rights: "الحقوق والحريات",
    tunisia: "ملف تونس", reports: "التقارير حول تونس", open: "فتح المصدر", pdf: "ملف PDF", fav: "المفضلة",
    addList: "إضافة إلى قائمة", cite: "الإحالة", details: "التفاصيل", showAll: "عرض الكل", showLess: "عرض أقل",
    noResults: "لا نتائج تطابق هذا البحث. جرّب كلمة أقصر، أو رمز الوثيقة، أو أزل أحد الفلاتر.",
    copied: "نُسخ", copyFail: "تعذّر النسخ تلقائيًا: حدّد النص وانسخه يدويًا"
  };
  var FILES = ["meta", "resources", "documents", "rights", "reports", "tunisia", "guides", "aliases"];
  var NAV = [
    ["home", "الرئيسية"], ["map", "خريطة المنظومة"], ["library", "الموارد"], ["docs", "فهرس التعليقات العامة"], ["section-standards", "المعايير"], ["section-treaty", "الهيئات التعاهدية"], ["section-hrc", "مجلس حقوق الإنسان"],
    ["section-caselaw", "الاجتهادات"], ["section-regional", "المنظومات الإقليمية"], ["rights", "الحقوق والحريات"],
    ["tunisia", "ملف تونس", "tn"], ["reports", "التقارير حول تونس", "tn"], ["section-tools", "أدوات البحث"],
    ["search", "البحث المتقدم"], ["lists", "قوائمي"], ["guides", "أدلة"]
  ];
  var BIND = { treaty: "f-bind", protocol: "f-bind", charter: "f-bind", judgment: "f-bind", order: "f-bind", gc: "f-interp", decision: "f-interp",
    co: "f-soft", declaration: "f-soft", guidelines: "f-soft", opinion: "f-soft", "sp-report": "f-soft", legislation: "f-bind", mandate: "f-interp",
    report: "f-res", briefing: "f-res", submission: "f-res", statement: "f-res", annual: "f-res", resource: "f-res" };

  /* ------------------------------------------------------------------ state */
  var D = {}, IDX = [], BY = {}, RIGHT = {}, SEC = {}, PUB = {};
  var main = document.getElementById("main");
  var st = {
    route: "", sq: { q: "", kind: "", type: "", publisher: "", right: "", scope: "", lang: "", section: "", yfrom: "", yto: "", sort: "rel", limit: 40 },
    rep: { topic: "", publisher: "", lang: "", type: "", q: "" }, lib: { cat: "", ar: false, tn: false, q: "" }, gd: { body: "", q: "", sort: "body" }, gcBody: "", expanded: {}, citeStyle: "chicago", filtersOpen: false
  };

  /* ------------------------------------------------------------------ storage (favorites & lists) */
  var KEY = "yrl:lists:v1";
  function loadLists() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && Array.isArray(v.fav) && Array.isArray(v.lists)) return v; } catch (e) {}
    return { fav: [], lists: [] };
  }
  var LISTS = loadLists();
  function saveLists() { try { localStorage.setItem(KEY, JSON.stringify(LISTS)); } catch (e) {} updateNavCount(); }
  function isFav(id) { return LISTS.fav.indexOf(id) >= 0; }
  function toggleFav(id) {
    var i = LISTS.fav.indexOf(id);
    if (i >= 0) { LISTS.fav.splice(i, 1); toast("أُزيلت من المفضلة"); } else { LISTS.fav.push(id); toast("أُضيفت إلى المفضلة"); }
    saveLists();
  }

  /* ------------------------------------------------------------------ helpers */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ic(name, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>'; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function ext(url, label, cls) { if (!url) return label; return '<a href="' + esc(url) + '" target="_blank" rel="noopener"' + (cls ? ' class="' + cls + '"' : "") + ">" + label + "</a>"; }
  function isSym(s) { return /^[A-Z]{1,6}(\.\d+)?\/[A-Za-z0-9.\/\-()]+$/.test(s || ""); }
  function unDoc(sym, lang) { return "https://docs.un.org/" + (lang || "ar") + "/" + sym; }
  function symLink(s) { return ext(unDoc(s), esc(s), "sym"); }
  var MONTHS_AR = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  function fmtDate(d) {
    if (!d) return "";
    var p = String(d).split("-");
    if (p.length === 1) return p[0];
    if (p.length === 2) return MONTHS_AR[+p[1] - 1] + " " + p[0];
    return (+p[2]) + " " + MONTHS_AR[+p[1] - 1] + " " + p[0];
  }
  function langNames(arr) { return (arr || []).map(function (l) { return D.meta.langs[l] || l; }).join("، "); }
  function typeName(t) { return t === "resource" ? "موقع / قاعدة بيانات" : ((D.meta.doc_types[t] || {}).name || t); }
  function forceName(t) { return t === "resource" ? "" : ((D.meta.doc_types[t] || {}).force || ""); }
  function href(id) { return "#doc-" + id; }

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[ً-ٰٟـ]/g, "").replace(/[آأإٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
      .replace(/[«»"“”'’‘()\[\]،,:;!؟?]/g, " ").replace(/\s+/g, " ").trim();
  }
  var STOP = ["المادة", "مادة", "الماده", "ماده", "article", "art", "art.", "في", "من", "و", "على", "حول", "بشان", "الى", "عن", "the", "of", "and", "de", "la", "le", "et", "des", "du", "les", "on", "in"];
  STOP = STOP.map(norm);
  function tokens(q) {
    return norm(q).split(" ").filter(function (t) { return t && STOP.indexOf(t) < 0; }).map(function (t) {
      var s = t.replace(/^(وال|بال|كال|فال|لل|ال)/, "");
      return s.length >= 3 ? s : t;
    });
  }

  /* ------------------------------------------------------------------ load */
  function load() {
    return Promise.all(FILES.map(function (n) {
      return fetch("data/" + n + ".json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(n + ".json: " + r.status); return r.json(); });
    })).then(function (arr) { FILES.forEach(function (n, i) { D[n] = arr[i]; }); build(); });
  }

  function build() {
    D.meta.sections.forEach(function (s) { SEC[s.id] = s; });
    D.rights.forEach(function (r) { RIGHT[r.id] = r; });
    PUB = D.meta.publishers;
    var topicRights = {}; D.meta.topics.forEach(function (t) { topicRights[t.id] = t.rights; });
    IDX = [];
    D.resources.forEach(function (r) {
      IDX.push({ kind: "resource", id: r.id, type: "resource", title: r.title, sub: r.title_en, url: r.url, summary: r.summary, tip: r.tip,
        langs: r.langs, scope: r.tunisia ? "tn" : "global", tunisia: r.tunisia, rights: [], year: null, date: "", publisher: host(r.url), publisher_en: "",
        sections: [[r.section, r.group]].concat(r.also || []), links: r.links || [], kindLabel: r.kind, checked: r.checked, added: r.added });
    });
    D.documents.forEach(function (d) {
      var it = Object.assign({ kind: "document", sub: d.title_orig || d.title_en || "" }, d);
      it.tunisia = d.scope === "tn";
      IDX.push(it);
    });
    D.reports.forEach(function (r) {
      var rights = []; r.topics.forEach(function (t) { (topicRights[t] || []).forEach(function (x) { if (rights.indexOf(x) < 0) rights.push(x); }); });
      var p = PUB[r.publisher] || { name: r.publisher, en: r.publisher };
      IDX.push(Object.assign({ kind: "report", sub: r.title_orig, publisher: p.name, publisher_en: p.en, publisher_url: p.url, rights: rights, tunisia: true,
        langs: r.langs, sections: [["reports", String(r.year)], ["tunisia", "الأبحاث والتقارير"]] }, r, { publisherKey: r.publisher, publisher: p.name }));
    });
    // special procedures mandates (searchable by name), derived from the rights index
    var seen = {};
    D.rights.forEach(function (r) {
      r.mechanisms.forEach(function (m) {
        var slug = (m.url.split("/").filter(Boolean).pop() || "").replace(/[^a-z0-9-]/gi, "").toLowerCase();
        var id = "mandate-" + slug;
        if (seen[id]) { if (seen[id].rights.indexOf(r.id) < 0) seen[id].rights.push(r.id); return; }
        seen[id] = { kind: "mandate", id: id, type: "mandate", title: m.name, sub: "", url: m.url, publisher: "الإجراءات الخاصة لمجلس حقوق الإنسان",
          publisher_en: "UN Special Procedures", summary: "ولاية من الإجراءات الخاصة لمجلس حقوق الإنسان. صفحتها الرسمية تتضمن التقارير المواضيعية والقطرية، والمراسلات الموجهة إلى الدول، ودعوات تقديم المساهمات، وطريقة إرسال المعلومات.",
          tip: "لمعرفة ما وجّهته هذه الولاية إلى تونس، صفِّ قاعدة المراسلات حسب البلد والولاية.", langs: [], scope: "global", rights: [r.id], year: null, date: "",
          sections: [["hrc", "الإجراءات الخاصة"]], links: [["قاعدة المراسلات", "https://spcommreports.ohchr.org/"], ["تقديم معلومات أو حالة", "https://spsubmission.ohchr.org/"]],
          checked: D.meta.updated, added: D.meta.updated };
        IDX.push(seen[id]);
      });
    });
    // aliases
    var groups = D.aliases.map(function (g) { return g.map(norm); });
    function has(text, term) {
      if (/^[a-z]{1,5}$/.test(term)) return new RegExp("(^|[^a-z])" + term + "([^a-z]|$)").test(text);
      return text.indexOf(term) >= 0;
    }
    IDX.forEach(function (it) {
      BY[it.id] = it;
      var rightsT = (it.rights || []).map(function (r) { return RIGHT[r] ? RIGHT[r].title : ""; }).join(" ");
      var secT = (it.sections || []).map(function (s) { return (SEC[s[0]] ? SEC[s[0]].name : "") + " " + s[1]; }).join(" ");
      var base = norm([it.title, it.sub, it.title_en, it.title_orig, it.summary, it.tip, it.symbol, it.publisher, it.publisher_en, it.body, it.number ? "رقم " + it.number + " no " + it.number : "",
        (it.articles || []).join(" "), typeName(it.type), it.kindLabel, it.year, rightsT, secT, it.note, it.status, it.unts, it.court].join(" "));
      var extra = [];
      groups.forEach(function (g) { for (var i = 0; i < g.length; i++) { if (g[i] && has(base, g[i])) { extra.push(g.join(" ")); break; } } });
      it._s = base + " " + extra.join(" ");
      it._t = norm([it.title, it.sub, it.symbol].join(" "));
    });
    D.rights.forEach(function (r) {
      var base = norm([r.title, r.short, r.tunisia, r.tip, r.legal.map(function (l) { return l.source + " " + l.articles; }).join(" "), r.mechanisms.map(function (m) { return m.name; }).join(" ")].join(" "));
      var extra = [];
      groups.forEach(function (g) { for (var i = 0; i < g.length; i++) { if (g[i] && has(base, g[i])) { extra.push(g.join(" ")); break; } } });
      r._s = base + " " + extra.join(" ");
      r._arts = r.legal.map(function (l) { return String(l.articles || ""); }).join(" ");
    });
  }

  /* ------------------------------------------------------------------ search engine */
  var WEIGHT = { treaty: 3, charter: 2.5, gc: 2.5, protocol: 2, judgment: 2, mandate: 2, order: 1.5, decision: 1.5, opinion: 1.5, declaration: 1.5, guidelines: 1.5, co: 1.5, resource: 1 };
  function numRe(n) { return new RegExp("(^|[^0-9])" + n + "([^0-9]|$)"); }
  function match(it, toks) {
    if (!toks.length) return 1;
    var score = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (/^\d+$/.test(t)) { if (!numRe(t).test(it._s)) return 0; score += 1; continue; }
      if (it._s.indexOf(t) < 0) return 0;
      score += it._t.indexOf(t) >= 0 ? 3 : 1;
      if (it.symbol && norm(it.symbol).indexOf(t) >= 0) score += 4;
    }
    return score + (WEIGHT[it.type] || 0);
  }
  var ART_RE = /(?:المادة|المواد|مادة|article|art\.?)\s*(\d{1,3})/i;
  function artMatch(it, n) {
    if ((it.articles || []).some(function (a) { return String(a).split("-")[0] === n; })) return true;
    return new RegExp("(الماده|article|art)\\s*" + n + "([^0-9]|$)").test(it._s);
  }
  function runSearch(q) {
    var raw = q.q || "", art = null, am = raw.match(ART_RE);
    if (am) { art = am[1]; raw = raw.replace(ART_RE, " "); }
    var toks = tokens(raw).filter(function (t) { return t.length > 1 || /^\d$/.test(t); }), out = [];
    IDX.forEach(function (it) {
      if (q.kind && it.kind !== q.kind) return;
      if (q.type && it.type !== q.type) return;
      if (q.publisher && it.publisher !== q.publisher) return;
      if (q.right && (it.rights || []).indexOf(q.right) < 0) return;
      if (q.scope && (q.scope === "tn" ? !it.tunisia : it.scope !== q.scope)) return;
      if (q.lang && (it.langs || []).indexOf(q.lang) < 0) return;
      if (q.section && !(it.sections || []).some(function (s) { return s[0] === q.section; })) return;
      if (q.yfrom && (!it.year || it.year < +q.yfrom)) return;
      if (q.yto && (!it.year || it.year > +q.yto)) return;
      if (art && !artMatch(it, art)) return;
      var s = match(it, toks) + (art ? 3 : 0);
      if (s) out.push([s, it]);
    });
    out.sort(function (a, b) {
      if (q.sort === "new") return (b[1].year || 0) - (a[1].year || 0) || b[0] - a[0];
      if (q.sort === "old") return (a[1].year || 9999) - (b[1].year || 9999);
      return b[0] - a[0] || (b[1].year || 0) - (a[1].year || 0);
    });
    var rights = (toks.length || art) ? D.rights.filter(function (r) {
      if (art && !numRe(art).test(r._arts)) return false;
      return toks.every(function (t) { return /^\d+$/.test(t) ? numRe(t).test(r._s) : r._s.indexOf(t) >= 0; });
    }) : [];
    return { items: out.map(function (x) { return x[1]; }), rights: rights };
  }

  /* ------------------------------------------------------------------ shared renderers */
  function actions(it) {
    return '<span class="actions"><button class="iconbtn" data-act="fav" data-id="' + esc(it.id) + '" aria-pressed="' + isFav(it.id) + '" title="' + UI.fav + '" aria-label="' + UI.fav + '">' + ic("star") + "</button>" +
      '<button class="iconbtn" data-act="list" data-id="' + esc(it.id) + '" title="' + UI.addList + '" aria-label="' + UI.addList + '">' + ic("list") + "</button>" +
      '<a class="iconbtn" href="' + href(it.id) + '" title="' + UI.cite + " و" + UI.details + '" aria-label="' + UI.details + '">' + ic("quote") + "</a></span>";
  }
  function forceBadge(it) {
    var f = forceName(it.type);
    return '<span class="badge ' + (BIND[it.type] || "f-res") + '">' + esc(typeName(it.type)) + (f ? " · " + esc(f) : "") + "</span>";
  }
  function resCard(r) {
    var more = "";
    if (r.links && r.links.length) {
      more = '<details class="more"' + (r.links.length <= 3 ? " open" : "") + "><summary>روابط فرعية (" + r.links.length + ")</summary><ul>" +
        r.links.map(function (m) { return "<li>" + ext(m[1], esc(m[0])) + "</li>"; }).join("") + "</ul></details>";
    }
    return '<article class="card' + (r.tunisia ? " is-tn" : "") + '"><div class="card-top"><h3>' + ext(r.url, esc(r.title)) + '<span class="en">' + esc(r.sub || "") + "</span></h3>" +
      '<span class="kind">' + esc(r.kindLabel || "") + "</span></div><p>" + esc(r.summary) + "</p>" +
      (r.tip ? '<div class="tip"><b>نصيحة:</b> ' + esc(r.tip) + "</div>" : "") + more +
      '<div class="card-foot"><div class="badges">' + ((r.langs || []).indexOf("ar") >= 0 ? '<span class="badge ar">واجهة أو نص عربي</span>' : "") +
      (r.tunisia ? '<span class="badge tn">تونس</span>' : "") + '<span class="host">' + esc(host(r.url)) + "</span></div>" + actions(r) + "</div></article>";
  }
  function docRow(d, opts) {
    opts = opts || {};
    var meta = [];
    if (opts.showType !== false) meta.push(forceBadge(d));
    if (d.publisher && d.kind !== "resource") meta.push(esc(d.publisher));
    if (d.date) meta.push('<span class="num">' + esc(fmtDate(d.date)) + "</span>");
    if (d.symbol) meta.push(symLink(d.symbol));
    if (d.status) meta.push('<span class="status">' + esc(d.status) + "</span>");
    if (d.tunisia && opts.tn !== false) meta.push('<span class="badge tn">تونس</span>');
    var titleUrl = d.kind === "resource" ? d.url : href(d.id);
    var title = d.kind === "resource" ? ext(d.url, esc(d.title)) : '<a href="' + href(d.id) + '">' + esc(d.title) + "</a>";
    if (opts.q) title = title.replace(/>([^<]*)</, function (m, t) { return ">" + hl(t, opts.q) + "<"; });
    return '<div class="row"><div class="row-main"><div class="row-title">' + title + "</div>" +
      (d.sub && d.sub !== d.title ? '<span class="en">' + esc(d.sub) + "</span>" : "") +
      '<div class="row-meta">' + meta.join("") + "</div></div>" + actions(d) + "</div>";
  }
  function hl(text, q) {
    var toks = q ? tokens(q).filter(function (t) { return /^[a-z0-9]/.test(t) && t.length > 2; }) : [];
    if (!toks.length) return text;
    var re = new RegExp("(" + toks.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"); }).join("|") + ")", "gi");
    return text.replace(re, "<mark>$1</mark>");
  }
  function rows(list, opts) { return list.length ? '<div class="rows">' + list.map(function (d) { return docRow(d, opts); }).join("") + "</div>" : '<p class="empty">لا عناصر بعد.</p>'; }
  function limited(key, list, n, renderer) {
    var open = st.expanded[key];
    var shown = open ? list : list.slice(0, n);
    var html = renderer(shown);
    if (list.length > n) html += '<button class="btn sm showall" data-act="expand" data-key="' + esc(key) + '">' + (open ? UI.showLess : UI.showAll + " (" + list.length + ")") + "</button>";
    return html;
  }
  function head(eyebrow, title, desc, extra, cls) {
    return '<div class="head' + (cls ? " " + cls : "") + '"><div><span class="eyebrow">' + esc(eyebrow) + "</span><h1>" + title + "</h1>" + (desc ? "<p>" + esc(desc) + "</p>" : "") + "</div>" + (extra || "") + "</div>";
  }
  function crumbs(parts) { return '<nav class="crumbs" aria-label="المسار">' + parts.map(function (p) { return p[1] ? '<a href="#' + p[1] + '">' + esc(p[0]) + "</a>" : "<span>" + esc(p[0]) + "</span>"; }).join("<span>›</span>") + "</nav>"; }
  function inSection(sid, group) {
    return IDX.filter(function (it) { return (it.sections || []).some(function (s) { return s[0] === sid && (group == null || s[1] === group); }); });
  }

  /* ------------------------------------------------------------------ views */
  function vHome() {
    var cards = D.meta.sections.map(function (s) {
      var n = s.id === "rights" ? D.rights.length : s.id === "reports" ? D.reports.length : inSection(s.id).length;
      return '<a class="sec-card' + (s.id === "tunisia" || s.id === "reports" ? " tn" : "") + '" href="#' + (s.id === "rights" || s.id === "reports" || s.id === "tunisia" ? s.id : "section-" + s.id) + '">' +
        '<span class="ico">' + ic(s.icon, "lg") + "</span><h2>" + esc(s.name) + '<span class="num">' + n + "</span></h2><p>" + esc(s.desc) + "</p></a>";
    }).join("");
    var latest = D.reports.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 4).map(function (r) { return BY[r.id]; });
    var hints = ["حرية التعبير", "CCPR/C/GC/34", "المادة 9 الاحتجاز", "المقرر الخاص المعني بالتعذيب", "تونس الهجرة", "CEDAW"];
    return '<section class="hero"><span class="eyebrow">' + esc(D.meta.name_en) + "</span><h1>" + esc(D.meta.name) + "</h1><p>" + esc(D.meta.tagline) + "</p>" +
      '<form class="bigsearch" id="homeSearch" role="search"><input id="hq" type="search" placeholder="ابحث بالحق، الاتفاقية، رقم المادة، رمز الوثيقة، اللجنة، المقرر الخاص…" aria-label="بحث في المكتبة" autocomplete="off">' + ic("search") +
      '<button class="btn primary" type="submit">بحث</button></form>' +
      '<div class="hints"><span>أمثلة:</span>' + hints.map(function (h) { return '<a href="#search" data-q="' + esc(h) + '">' + esc(h) + "</a>"; }).join("") +
      '<span>·</span><a href="#search">البحث المتقدم بالفلاتر</a></div></section>' +
      '<div class="tier">أقسام المكتبة</div><div class="grid-sec">' + cards + "</div>" +
      '<div class="tier">تونس أولًا</div><div class="tn-band"><div><strong>ملف تونس والتقارير الحقوقية منذ 2020</strong><p>' + esc(D.tunisia.note_court) + "</p></div>" +
      '<div class="btns"><a class="btn tn" href="#tunisia">ملف تونس</a><a class="btn" href="#reports">التقارير حول تونس</a></div></div>' +
      '<div class="tier">أحدث التقارير المُضافة</div>' + rows(latest) +
      '<div class="facts"><span><b>' + D.resources.length + "</b> موقعًا وقاعدة بيانات</span><span><b>" + D.documents.length + "</b> وثيقة مفهرسة</span><span><b>" + D.reports.length +
      "</b> تقريرًا حول تونس</span><span><b>" + D.rights.length + "</b> حقًا مفهرسًا</span><span>آخر تحديث: <b>" + esc(fmtDate(D.meta.updated)) + "</b></span></div>";
  }

  function vSection(sid) {
    var s = SEC[sid]; if (!s) return vNotFound();
    var html = crumbs([[UI.home, "home"], [s.name]]) + head("قسم", ic(s.icon, "lg") + " " + esc(s.name), s.desc,
      '<a class="btn" href="#search" data-section="' + sid + '">' + ic("search") + " البحث داخل القسم</a>");
    (s.groups || []).forEach(function (g) {
      var items = inSection(sid, g);
      if (!items.length && !(sid === "treaty" && g === "التعليقات العامة")) return;
      var res = items.filter(function (x) { return x.kind === "resource"; });
      var docs = items.filter(function (x) { return x.kind !== "resource"; });
      html += '<section><div class="tier">' + esc(g) + ' <span class="n">' + items.length + "</span></div>";
      if (sid === "treaty" && g === "التعليقات العامة") {
        var bodies = D.meta.bodies.filter(function (b) { return b.code !== "ACHPR"; });
        var gcs = docs.filter(function (d) { return d.type === "gc" && (!st.gcBody || d.body === st.gcBody || (d.number || "").indexOf(st.gcBody) >= 0); });
        html += (res.length ? '<div class="cards" style="margin-bottom:14px">' + res.map(resCard).join("") + "</div>" : "") +
          '<div class="chips group-filter"><button class="chip" data-gcbody="" aria-pressed="' + (!st.gcBody) + '">كل اللجان</button>' +
          bodies.map(function (b) { return '<button class="chip" data-gcbody="' + b.code + '" aria-pressed="' + (st.gcBody === b.code) + '">' + esc(b.name) + "</button>"; }).join("") + "</div>" +
          limited("gc-" + st.gcBody, gcs.sort(function (a, b) { return (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0); }), 12, function (l) { return rows(l, { showType: false }); });
      } else {
        if (res.length) html += '<div class="cards">' + res.map(resCard).join("") + "</div>";
        if (docs.length) html += (res.length ? '<div style="height:14px"></div>' : "") + limited(sid + g, docs, 10, function (l) { return rows(l); });
      }
      html += "</section>";
    });
    return html;
  }

  function vRights(id) {
    var r = RIGHT[id] || D.rights[0];
    var list = D.rights.map(function (x) { return '<a href="#right-' + x.id + '" aria-current="' + (x.id === r.id) + '">' + esc(x.title) + "</a>"; }).join("");
    var sel = '<select class="ctl rselect" id="rsel" aria-label="اختر الحق">' + D.rights.map(function (x) { return '<option value="' + x.id + '"' + (x.id === r.id ? " selected" : "") + ">" + esc(x.title) + "</option>"; }).join("") + "</select>";
    function part(n, title, small, body) { return '<section class="part"><h2><span class="pn">' + n + "</span>" + esc(title) + (small ? " <small>" + esc(small) + "</small>" : "") + "</h2>" + body + "</section>"; }
    // 1 legal basis
    var legal = '<div class="legal">' + r.legal.filter(function (l) { return l.binding; }).map(function (l) {
      var d = l.doc && BY[l.doc];
      return '<div class="legal-row"><span>' + (d ? '<a href="' + href(d.id) + '">' + esc(l.source) + "</a>" : esc(l.source)) + (l.regional ? ' <span class="badge">إقليمي</span>' : "") + '</span><span class="a num">' + esc(l.articles) + "</span></div>";
    }).join("") + "</div>";
    var nb = r.legal.filter(function (l) { return !l.binding; }).map(function (l) { return BY[l.doc]; }).filter(Boolean);
    // 2 interpretation
    var interp = r.interp.map(function (i) { return BY[i]; }).filter(Boolean);
    var soft = r.soft.map(function (i) { return BY[i]; }).filter(Boolean).concat(nb);
    // 3 mechanisms
    var mech = '<ul class="plain">' + r.mechanisms.map(function (m) { return "<li>" + ext(m.url, esc(m.name)) + "</li>"; }).join("") + "</ul>";
    var bodiesFor = {};
    interp.forEach(function (g) { if (g.body && g.body !== "ACHPR") bodiesFor[g.body] = g.publisher; });
    var tb = Object.keys(bodiesFor).map(function (b) { return '<a class="chip" href="#section-treaty">' + esc(bodiesFor[b]) + "</a>"; }).join("");
    // 4 case law
    var cases = IDX.filter(function (it) { return ["judgment", "order", "decision", "opinion"].indexOf(it.type) >= 0 && (it.rights || []).indexOf(r.id) >= 0; });
    var caseTools = ["juris", "hudoc", "wgad", "africanlii", "iacthr-juris"].map(function (i) { return BY[i]; }).filter(Boolean);
    // 5 recommendations
    var cos = IDX.filter(function (it) { return it.type === "co" && (it.rights || []).indexOf(r.id) >= 0; });
    // 6 national
    var leg = IDX.filter(function (it) { return it.type === "legislation" && (it.rights || []).indexOf(r.id) >= 0; });
    var visits = IDX.filter(function (it) { return it.type === "sp-report" && (it.rights || []).indexOf(r.id) >= 0; });
    var reps = IDX.filter(function (it) { return it.kind === "report" && (it.rights || []).indexOf(r.id) >= 0; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var regional = r.regional.map(function (i) { return BY[i]; }).filter(Boolean);
    var html = crumbs([[UI.home, "home"], [UI.rights, "rights"], [r.title]]) +
      '<div class="rights"><nav class="rlist" aria-label="الحقوق">' + list + "</nav><div>" + sel +
      '<article class="panel"><header><span class="eyebrow">الحقوق والحريات</span><h1>' + esc(r.title) + "</h1><p>" + esc(r.short) + "</p></header>" +
      part(1, "الأساس القانوني", "المعاهدات والاتفاقيات الملزمة والمواد ذات الصلة", legal) +
      part(2, "التفسير القانوني", "التعليقات والتوصيات العامة، ثم المعايير غير الملزمة",
        (interp.length ? rows(interp) : '<p class="empty">لا تعليق عام مخصّص لهذا الحق بعد.</p>') +
        (regional.length ? '<p class="sub">تفسيرات ومعايير إقليمية</p>' + rows(regional) : "") +
        (r.regional_notes.length ? '<ul class="plain" style="margin-top:8px">' + r.regional_notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") +
        (soft.length ? '<p class="sub">إعلانات ومبادئ وقواعد غير ملزمة</p>' + rows(soft) : "")) +
      part(3, "الآليات الدولية المختصة", "المقررون الخاصون وفرق العمل واللجان", mech + (tb ? '<p class="sub">اللجان التعاهدية المعنية</p><div class="chips">' + tb + "</div>" : "")) +
      part(4, "الاجتهادات والقرارات", "أحكام وآراء وقرارات في حالات فردية",
        (cases.length ? rows(cases) : '<p class="empty">لا قرارات مفهرسة لهذا الحق بعد. ابحث في قواعد الاجتهاد أدناه.</p>') +
        '<p class="sub">قواعد الاجتهاد</p><div class="chips">' + caseTools.map(function (t) { return ext(t.url, esc(t.title), "chip"); }).join("") + "</div>") +
      part(5, "التوصيات والملاحظات", "الملاحظات الختامية الموجهة إلى تونس، وتوصيات الآليات",
        (cos.length ? rows(cos) : '<p class="empty">لا ملاحظات ختامية مرتبطة بعد.</p>') +
        '<div class="tipbox" style="margin-top:10px">لتجميع كل التوصيات في هذا الموضوع: ' + ext("https://uhri.ohchr.org/", "الفهرس العالمي لحقوق الإنسان") + "، اختر البلد ثم الموضوع.</div>") +
      part(6, "التطبيقات الوطنية: تونس", "الوضع في تونس، التشريعات، الزيارات والتقارير",
        '<div class="tnbox">' + esc(r.tunisia) + "</div>" +
        (leg.length ? '<p class="sub">التشريعات الوطنية</p>' + rows(leg, { tn: false }) : "") +
        (visits.length ? '<p class="sub">تقارير الزيارات القطرية</p>' + rows(visits, { tn: false }) : "") +
        (reps.length ? '<p class="sub">أبحاث وتقارير حول تونس (' + reps.length + ")</p>" + limited("rep-" + r.id, reps, 5, function (l) { return rows(l, { tn: false }); }) : "")) +
      '<section class="part"><h2>نصيحة بحث</h2><div class="tipbox">' + esc(r.tip) + "</div></section>" +
      '<section class="part"><h2>حقوق متداخلة</h2><div class="related">' + r.related.filter(function (x) { return RIGHT[x]; }).map(function (x) { return '<a class="chip" href="#right-' + x + '">' + esc(RIGHT[x].title) + "</a>"; }).join("") + "</div></section>" +
      "</article></div></div>";
    return html;
  }

  function vTunisia() {
    var s = SEC.tunisia;
    var cos = D.tunisia.co.map(function (i) { return BY[i]; }).filter(Boolean).sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
    var tl = '<ol class="tl">' + D.tunisia.timeline.map(function (x) { return '<li><span class="yr">' + x[0] + "</span><span>" + esc(x[1]) + "</span></li>"; }).join("") + "</ol>";
    var html = crumbs([[UI.home, "home"], [s.name]]) + head("الأولوية", esc(s.name), s.desc, '<a class="btn tn" href="#reports">' + ic("report") + " التقارير حول تونس</a>", "tn-head") +
      '<div class="alert"><b>تغيّر مهم:</b> ' + esc(D.tunisia.note_court) + ' <a href="#guides">كيف أختار المسار؟</a></div>' +
      '<div class="grid2"><section class="box"><h2>آخر الملاحظات الختامية حسب اللجنة</h2>' + rows(cos, { tn: false, showType: false }) +
      '<p class="muted" style="font-size:13px">الرمز يفتح النسخة العربية. القائمة الكاملة في ' + ext(BY["tn-tb"].url, "صفحة تونس بقاعدة بيانات الهيئات التعاهدية") + ".</p></section>" +
      '<section class="box"><h2>الخط الزمني</h2>' + tl + "</section></div>";
    (s.groups || []).forEach(function (g) {
      if (g === "الملاحظات الختامية للجان التعاهدية") {
        var others = inSection("tunisia", g).filter(function (x) { return cos.indexOf(x) < 0; });
        if (!others.length) return;
        html += '<div class="tier">' + esc(g) + ": وثائق المتابعة وقواعد البيانات</div>" + renderMixed(others, "tng" + g);
        return;
      }
      var items = inSection("tunisia", g);
      if (!items.length) return;
      html += '<div class="tier">' + esc(g) + ' <span class="n">' + items.length + "</span></div>" + renderMixed(items, "tng" + g);
    });
    html += '<div class="tier">ما يخص تونس في كل حق</div><div class="chips">' + D.rights.map(function (t) { return '<a class="chip" href="#right-' + t.id + '">' + esc(t.title) + "</a>"; }).join("") + "</div>";
    return html;
  }
  function renderMixed(items, key) {
    var res = items.filter(function (x) { return x.kind === "resource"; }), docs = items.filter(function (x) { return x.kind !== "resource"; });
    return (res.length ? '<div class="cards">' + res.map(resCard).join("") + "</div>" : "") + (res.length && docs.length ? '<div style="height:14px"></div>' : "") +
      (docs.length ? limited(key, docs, 10, function (l) { return rows(l, { tn: false }); }) : "");
  }

  function vReports() {
    var f = st.rep, toks = tokens(f.q);
    var list = IDX.filter(function (it) {
      if (it.kind !== "report") return false;
      if (f.topic && it.topics.indexOf(f.topic) < 0) return false;
      if (f.publisher && it.publisherKey !== f.publisher) return false;
      if (f.lang && it.langs.indexOf(f.lang) < 0) return false;
      if (f.type && it.type !== f.type) return false;
      return match(it, toks) > 0;
    });
    var years = []; var maxY = Math.max(new Date().getFullYear(), D.reports.reduce(function (m, r) { return Math.max(m, r.year); }, 2020));
    for (var y = maxY; y >= 2020; y--) years.push(y);
    var pubs = {}; D.reports.forEach(function (r) { pubs[r.publisher] = (pubs[r.publisher] || 0) + 1; });
    var langs = {}; D.reports.forEach(function (r) { r.langs.forEach(function (l) { langs[l] = 1; }); });
    var types = {}; D.reports.forEach(function (r) { types[r.type] = 1; });
    function opt(v, l, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(l) + "</option>"; }
    var filters = '<form class="filters" id="repf" role="search">' +
      '<label class="fld wide" for="rq">بحث في التقارير<input class="ctl" id="rq" type="search" value="' + esc(f.q) + '" placeholder="عنوان، منظمة، كلمة مفتاحية…"></label>' +
      '<label class="fld" for="rtopic">الموضوع<select class="ctl" id="rtopic">' + opt("", "كل المواضيع", f.topic) + D.meta.topics.map(function (t) { return opt(t.id, t.name, f.topic); }).join("") + "</select></label>" +
      '<label class="fld" for="rpub">الجهة الناشرة<select class="ctl" id="rpub">' + opt("", "كل الجهات", f.publisher) + Object.keys(pubs).map(function (k) { return opt(k, (PUB[k] || {}).name + " (" + pubs[k] + ")", f.publisher); }).join("") + "</select></label>" +
      '<label class="fld" for="rlang">اللغة المتاحة<select class="ctl" id="rlang">' + opt("", "كل اللغات", f.lang) + Object.keys(langs).map(function (k) { return opt(k, D.meta.langs[k] || k, f.lang); }).join("") + "</select></label>" +
      '<label class="fld" for="rtype">نوع الوثيقة<select class="ctl" id="rtype">' + opt("", "كل الأنواع", f.type) + Object.keys(types).map(function (k) { return opt(k, typeName(k), f.type); }).join("") + "</select></label>" +
      "</form>";
    var yearnav = '<nav class="yearnav" aria-label="السنوات">' + years.map(function (y) {
      var n = list.filter(function (r) { return r.year === y; }).length;
      return '<button class="chip" data-year="' + y + '"' + (n ? "" : " disabled") + '><span class="num">' + y + '</span><span class="n">' + n + "</span></button>";
    }).join("") + "</nav>";
    var body = years.map(function (y) {
      var items = list.filter(function (r) { return r.year === y; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      return '<section class="year" id="y' + y + '"><h2>' + y + " <small>" + (items.length ? items.length + " عنصرًا" : "لا تقارير مُدرجة لهذه السنة وفق التصفية الحالية") + "</small></h2>" +
        (items.length ? '<div class="cards">' + items.map(repCard).join("") + "</div>" : "") + "</section>";
    }).join("");
    var trackers = '<div class="tier">صفحات متابعة تتحدّث باستمرار</div><div class="rows">' + D.meta.trackers.map(function (t) {
      return '<div class="row"><div class="row-main"><div class="row-title">' + ext(t.url, esc(t.title)) + '</div><div class="row-meta">' + esc((PUB[t.publisher] || {}).en || "") + " · " + esc(t.summary) + "</div></div></div>";
    }).join("") + "</div>";
    return crumbs([[UI.home, "home"], [SEC.reports.name]]) +
      head("مكتبة رقمية", esc(SEC.reports.name), SEC.reports.desc, '<span class="muted num">' + list.length + " من " + D.reports.length + "</span>") +
      '<p class="muted" style="margin:-10px 0 16px;font-size:13.5px">كل عنوان هنا تحقّقنا من وجوده على موقع الجهة الناشرة. التصنيف حسب الموضوع اجتهاد من المكتبة. البيانات الصحفية والفصول السنوية معلَّمة بنوعها حتى لا تُخلط بالتقارير البحثية.</p>' +
      filters + yearnav + body + trackers;
  }
  function repCard(r) {
    var p = PUB[r.publisherKey] || {};
    var topics = r.topics.map(function (t) { var o = D.meta.topics.filter(function (x) { return x.id === t; })[0]; return o ? o.name : t; });
    return '<article class="card rcard is-tn"><div class="card-top"><h3><a href="' + href(r.id) + '">' + esc(r.title) + '</a><span class="en">' + esc(r.title_orig) + "</span></h3></div>" +
      '<div class="badges">' + forceBadge(r) + topics.map(function (t) { return '<span class="badge">' + esc(t) + "</span>"; }).join("") + "</div>" +
      "<p>" + esc(r.summary) + "</p>" +
      "<dl><dt>الجهة الناشرة</dt><dd>" + ext(p.url, esc(p.name || r.publisher)) + ' <span class="en" style="display:inline">' + esc(p.en || "") + "</span></dd>" +
      '<dt>تاريخ النشر</dt><dd class="num">' + esc(fmtDate(r.date)) + "</dd>" +
      "<dt>اللغة الأصلية</dt><dd>" + esc(D.meta.langs[r.lang_orig] || r.lang_orig) + "</dd>" +
      "<dt>اللغات المتاحة</dt><dd>" + esc(langNames(r.langs)) + "</dd>" +
      (r.pages ? '<dt>عدد الصفحات</dt><dd class="num">' + r.pages + "</dd>" : "") + "</dl>" +
      (r.note ? '<p class="muted" style="font-size:13px">' + esc(r.note) + "</p>" : "") +
      '<div class="card-foot"><div class="links">' + ext(r.url, ic("external") + " التقرير الأصلي") + (r.pdf && r.pdf !== r.url ? ext(r.pdf, ic("download") + " PDF") : "") + "</div>" + actions(r) + "</div></article>";
  }

  /* ---- document detail */
  function vDoc(id) {
    var d = BY[id]; if (!d) return vNotFound();
    var cls = BIND[d.type] || "f-res";
    var force = forceName(d.type);
    var forceText = {
      "f-bind": "نص ملزم: " + force + ".", "f-interp": "تفسير صادر عن هيئة مختصة: " + force + ". ليس معاهدة في حد ذاته.",
      "f-soft": "غير ملزم قانونًا: " + (force || "توصيات أو مبادئ") + ". يُستعمل كمرجع تفسيري أو حجة مناصرة.",
      "f-res": d.kind === "resource" ? "مورد بحثي (موقع أو قاعدة بيانات)، ليس وثيقة قانونية." : "عمل بحثي أو بيان صادر عن منظمة غير حكومية، ليس وثيقة رسمية."
    }[cls];
    if (d.type === "mandate") forceText = "آلية أممية مستقلة: ولاية من الإجراءات الخاصة. تقاريرها ورسائلها وتوصياتها غير ملزمة قانونًا، لكنها مرجع رسمي.";
    var sec = (d.sections || [])[0] || [];
    var langLinks = "";
    if (d.symbol && isSym(d.symbol)) {
      langLinks = '<div class="links">' + ["ar", "fr", "en"].map(function (l) { return ext(unDoc(d.symbol, l), D.meta.langs[l]); }).join("") + "</div>";
    }
    var meta = "<dl class=\"meta\">" +
      "<dt>النوع</dt><dd>" + esc(typeName(d.type)) + "</dd>" +
      (d.publisher ? "<dt>الجهة المُصدِرة</dt><dd>" + (d.publisher_url ? ext(d.publisher_url, esc(d.publisher)) : esc(d.publisher)) + (d.publisher_en ? ' <span class="en" style="display:inline">' + esc(d.publisher_en) + "</span>" : "") + "</dd>" : "") +
      (d.date ? '<dt>التاريخ</dt><dd class="num">' + esc(fmtDate(d.date)) + "</dd>" : "") +
      (d.in_force ? '<dt>بدء النفاذ</dt><dd class="num">' + esc(fmtDate(d.in_force)) + "</dd>" : "") +
      (d.symbol ? "<dt>الرمز</dt><dd>" + (isSym(d.symbol) ? symLink(d.symbol) : '<span class="sym">' + esc(d.symbol) + "</span>") + "</dd>" : "") +
      (d.unts ? '<dt>مجموعة المعاهدات</dt><dd><span class="sym">' + esc(d.unts) + "</span></dd>" : "") +
      (d.lang_orig ? "<dt>اللغة الأصلية</dt><dd>" + esc(D.meta.langs[d.lang_orig] || d.lang_orig) + "</dd>" : "") +
      ((d.langs || []).length ? "<dt>اللغات المتاحة</dt><dd>" + esc(langNames(d.langs)) + "</dd>" : "") +
      (d.articles && d.articles.length ? '<dt>المواد</dt><dd class="num">' + esc(d.articles.join("، ")) + "</dd>" : "") +
      "<dt>النطاق</dt><dd>" + esc(d.tunisia ? "تونس" : (D.meta.scopes[d.scope] || "عالمي")) + "</dd>" +
      '<dt>أُضيف إلى المكتبة</dt><dd class="num">' + esc(fmtDate(d.added)) + "</dd>" +
      '<dt>آخر تحقق من الرابط</dt><dd class="num">' + esc(fmtDate(d.checked)) + "</dd></dl>";
    var rightsChips = (d.rights || []).filter(function (r) { return RIGHT[r]; }).map(function (r) { return '<a class="chip" href="#right-' + r + '">' + esc(RIGHT[r].title) + "</a>"; }).join("");
    var related = relatedOf(d).slice(0, 8);
    var topics = d.kind === "report" ? d.topics.map(function (t) { var o = D.meta.topics.filter(function (x) { return x.id === t; })[0]; return o ? '<span class="badge">' + esc(o.name) + "</span>" : ""; }).join("") : "";
    var secLink = sec[0] && SEC[sec[0]] ? [SEC[sec[0]].name, sec[0] === "reports" || sec[0] === "tunisia" ? sec[0] : "section-" + sec[0]] : [UI.search, "search"];
    return crumbs([[UI.home, "home"], secLink, [d.title.length > 60 ? d.title.slice(0, 60) + "…" : d.title]]) +
      '<div class="docgrid"><article class="panel"><header><div class="badges" style="margin-bottom:8px">' + forceBadge(d) + topics + (d.tunisia ? '<span class="badge tn">تونس</span>' : "") + "</div>" +
      "<h1>" + esc(d.title) + "</h1>" + (d.sub && d.sub !== d.title ? '<span class="en" style="font-size:14px">' + esc(d.sub) + "</span>" : "") + "</header>" +
      (d.status ? '<p class="status" style="margin-top:12px;font-size:13.5px;padding:4px 12px">' + esc(d.status) + "</p>" : "") +
      '<section class="part"><div class="force ' + cls + '">' + ic(cls === "f-bind" ? "scale" : cls === "f-interp" ? "committee" : cls === "f-soft" ? "rights" : "report") + "<span>" + esc(forceText) + "</span></div></section>" +
      (d.summary ? '<section class="part"><h2>الملخص</h2><p>' + esc(d.summary) + "</p></section>" : "") +
      (d.tip ? '<section class="part"><div class="tipbox"><b>نصيحة:</b> ' + esc(d.tip) + "</div></section>" : "") +
      (d.note ? '<section class="part"><div class="tipbox">' + esc(d.note) + "</div></section>" : "") +
      '<section class="part"><h2>الروابط</h2><div class="links">' + ext(d.url, ic("external") + " " + (d.kind === "resource" ? "فتح الموقع" : "المصدر الأصلي")) +
      (d.pdf && d.pdf !== d.url ? ext(d.pdf, ic("download") + " " + UI.pdf) : "") + (d.publisher_url && d.kind === "report" ? ext(d.publisher_url, ic("external") + " صفحة الجهة الناشرة") : "") + "</div>" +
      (langLinks ? '<p class="sub">النسخ اللغوية الرسمية</p>' + langLinks : "") +
      ((d.links || []).length ? '<p class="sub">روابط فرعية</p><ul class="plain">' + d.links.map(function (m) { return "<li>" + ext(m[1], esc(m[0])) + "</li>"; }).join("") + "</ul>" : "") + "</section>" +
      (rightsChips ? '<section class="part"><h2>الحقوق المرتبطة</h2><div class="related">' + rightsChips + "</div></section>" : "") +
      (related.length ? '<section class="part"><h2>وثائق مرتبطة</h2>' + rows(related) + "</section>" : "") +
      "</article>" +
      '<aside class="side"><div class="box"><h2>' + ic("quote") + " مولّد الإحالات</h2>" + citeBlock(d) + "</div>" +
      '<div class="box"><h2>المعلومات المرجعية</h2>' + meta + "</div>" +
      '<div class="box"><div class="toolbar"><button class="btn sm" data-act="fav" data-id="' + esc(d.id) + '" aria-pressed="' + isFav(d.id) + '">' + ic("star") + " " + (isFav(d.id) ? "في المفضلة" : "إلى المفضلة") + "</button>" +
      '<button class="btn sm" data-act="list" data-id="' + esc(d.id) + '">' + ic("list") + " " + UI.addList + "</button></div></div></aside></div>";
  }
  var TREATY_OF = { CCPR: "tr-iccpr", CESCR: "tr-icescr", CERD: "tr-icerd", CEDAW: "tr-cedaw", CAT: "tr-cat", CRC: "tr-crc", CMW: "tr-icmw", CRPD: "tr-crpd", CED: "tr-cped", ACHPR: "tr-achpr" };
  function relatedOf(d) {
    var rs = d.rights || [], first = [];
    if (d.body && TREATY_OF[d.body] && BY[TREATY_OF[d.body]] && TREATY_OF[d.body] !== d.id) first.push(BY[TREATY_OF[d.body]]);
    if (!rs.length) return first;
    var scored = [];
    IDX.forEach(function (it) {
      if (it.id === d.id || it.kind === "resource" || first.indexOf(it) >= 0) return;
      var n = 0; (it.rights || []).forEach(function (r) { if (rs.indexOf(r) >= 0) n++; });
      if (!n) return;
      if (it.type === d.type) n -= 0.5;
      if (it.tunisia && d.tunisia) n += 0.5;
      if (d.kind !== "report" && it.kind === "report") n -= 0.6;
      if (it.type === "gc" || it.type === "mandate" || it.type === "judgment" || it.type === "opinion") n += 0.4;
      if ((it.rights || []).length > 8) n -= 1;
      scored.push([n, it]);
    });
    scored.sort(function (a, b) { return b[0] - a[0] || (b[1].year || 0) - (a[1].year || 0); });
    return first.concat(scored.map(function (x) { return x[1]; }));
  }

  /* ---- citations */
  var MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_BB = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  function dparts(d) { var p = String(d || "").split("-"); return { y: p[0] || "", m: p[1] ? +p[1] : 0, d: p[2] ? +p[2] : 0 }; }
  function dEN(d, style) {
    var p = dparts(d); if (!p.y) return "";
    if (!p.m) return p.y;
    if (style === "oscola") return (p.d ? p.d + " " : "") + MONTHS_EN[p.m - 1] + " " + p.y;
    if (style === "bluebook") return MONTHS_BB[p.m - 1] + " " + (p.d ? p.d + ", " : "") + p.y;
    return MONTHS_EN[p.m - 1] + " " + (p.d ? p.d + ", " : "") + p.y;
  }
  function today() { var t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); }
  function enTitle(d) {
    if (d.title_orig) return d.title_orig;
    if (d.title_en && d.kind !== "resource") return d.title_en;
    if (d.type === "gc" && /^[0-9]/.test(d.number || "")) {
      var rec = d.body === "CEDAW" || d.body === "CERD";
      if ((d.number || "").indexOf("/") >= 0) return "Joint General " + (rec ? "Recommendation" : "Comment") + " No. " + d.number.replace(/\s+/g, " ");
      return "General " + (rec ? "Recommendation" : "Comment") + " No. " + d.number;
    }
    if (d.kind === "resource") return d.sub || d.title;
    return d.title;
  }
  function author(d) { return d.publisher_en || (d.kind === "resource" ? d.sub : "") || d.publisher || ""; }
  function cite(d, style) {
    var a = author(d), t = enTitle(d), url = d.symbol && isSym(d.symbol) ? unDoc(d.symbol, style === "arabic" ? "ar" : "en") : d.url, acc = today();
    var y = d.year || (d.date ? String(d.date).slice(0, 4) : "");
    if (style === "arabic") {
      var parts = [];
      if (d.publisher && d.kind !== "resource") parts.push(d.publisher);
      parts.push("«" + d.title + "»");
      if (d.symbol) parts.push("الوثيقة " + d.symbol);
      if (d.unts) parts.push("مجموعة معاهدات الأمم المتحدة " + d.unts);
      if (d.date) parts.push(fmtDate(d.date));
      return parts.join("، ") + "، متاح على: " + url + " (تاريخ الاطلاع: " + fmtDate(acc) + ").";
    }
    var treaty = ["treaty", "protocol", "charter"].indexOf(d.type) >= 0;
    var undoc = d.symbol && isSym(d.symbol) && !treaty;
    var isCase = ["judgment", "order", "decision"].indexOf(d.type) >= 0;
    if (style === "chicago") {
      if (treaty) return "<i>" + esc(t) + "</i>. " + dEN(d.date, "chicago") + "." + (d.unts ? " " + esc(d.unts.replace("UNTS", "U.N.T.S.")) + "." : "") + " " + esc(url) + ".";
      if (isCase) return "<i>" + esc(t) + "</i>. " + esc(a) + ", " + dEN(d.date, "chicago") + "." + (d.symbol ? " " + esc(d.symbol) + "." : "") + " " + esc(url) + ".";
      if (undoc) return esc(a) + ". “" + esc(t) + ".” " + esc(d.symbol) + ". " + (dEN(d.date, "chicago") || y) + ". " + esc(url) + ".";
      return esc(a) + ". <i>" + esc(t) + "</i>. " + (dEN(d.date, "chicago") || y) + (y ? ". " : "") + esc(url) + ".";
    }
    if (style === "oscola") {
      if (treaty) return esc(t) + " (adopted " + dEN(d.date, "oscola") + (d.in_force ? ", entered into force " + dEN(d.in_force, "oscola") : "") + ")" + (d.unts ? " " + esc(d.unts) : "");
      if (isCase) return "<i>" + esc(t.replace(/\bv\.\s/g, "v ")) + "</i> (" + esc(a) + ", " + dEN(d.date, "oscola") + ")" + (d.symbol ? " UN Doc " + esc(d.symbol) : "");
      if (undoc) return esc(a) + ", '" + esc(t.replace(/No\./g, "No")) + "' (" + (dEN(d.date, "oscola") || y) + ") UN Doc " + esc(d.symbol);
      return esc(a) + ", '" + esc(t) + "' (" + (dEN(d.date, "oscola") || y) + ") &lt;" + esc(url) + "&gt; accessed " + dEN(acc, "oscola");
    }
    // bluebook
    if (treaty) return esc(t) + ", " + dEN(d.date, "bluebook") + (d.unts ? ", " + esc(d.unts.replace("UNTS", "U.N.T.S.")) : "") + ".";
    if (isCase) return "<i>" + esc(t) + "</i>" + (d.symbol ? ", U.N. Doc. " + esc(d.symbol) : "") + " (" + dEN(d.date, "bluebook") + ").";
    if (undoc) return esc(a.replace(/^UN /, "U.N. ")) + ", " + esc(t) + ", U.N. Doc. " + esc(d.symbol) + " (" + (dEN(d.date, "bluebook") || y) + ").";
    return esc(a) + ", <i>" + esc(t) + "</i> (" + (dEN(d.date, "bluebook") || y) + "), " + esc(url) + ".";
  }
  var STYLES = [["chicago", "Chicago"], ["oscola", "OSCOLA"], ["bluebook", "Bluebook"], ["arabic", "عربي"]];
  function citeBlock(d) {
    var s = st.citeStyle;
    return '<div class="cite"><div class="cite-tabs" role="tablist">' + STYLES.map(function (x) { return '<button class="chip" role="tab" data-cstyle="' + x[0] + '" aria-pressed="' + (x[0] === s) + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<div class="cite-out' + (s === "arabic" ? "" : " l") + '" id="citeOut" data-id="' + esc(d.id) + '">' + cite(d, s) + "</div>" +
      '<div class="toolbar"><button class="btn sm" data-act="copycite">' + ic("copy") + " نسخ الإحالة</button>" +
      '<button class="btn sm" data-act="bib" data-id="' + esc(d.id) + '">BibTeX</button></div>' +
      (s !== "arabic" && /[؀-ۿ]/.test(enTitle(d)) ? '<p class="muted" style="font-size:12.5px">العنوان متاح بالعربية فقط في المكتبة؛ ترجمه أو استعمل عنوان النسخة الإنجليزية الرسمية.</p>' : "") + "</div>";
  }
  function plain(html) { var t = document.createElement("div"); t.innerHTML = html; return t.textContent; }

  /* ---- search view */
  function vSearch() {
    var q = st.sq, r = runSearch(q);
    function opt(v, l, cur) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + esc(l) + "</option>"; }
    var pubs = {}; IDX.forEach(function (it) { if (it.kind !== "resource" && it.publisher) pubs[it.publisher] = (pubs[it.publisher] || 0) + 1; });
    var types = {}; IDX.forEach(function (it) { types[it.type] = (types[it.type] || 0) + 1; });
    var years = []; for (var y = new Date().getFullYear(); y >= 1948; y--) years.push(y);
    var langs = {}; IDX.forEach(function (it) { (it.langs || []).forEach(function (l) { langs[l] = 1; }); });
    var activeN = ["kind", "type", "publisher", "right", "scope", "lang", "section", "yfrom", "yto"].filter(function (k) { return q[k]; }).length;
    var f = '<form class="sfilters' + (st.filtersOpen ? "" : " collapsed") + '" id="sf" aria-label="فلاتر البحث">' +
      '<label class="fld" for="f-kind">فئة المحتوى<select class="ctl" id="f-kind">' + opt("", "الكل", q.kind) + opt("document", "وثائق", q.kind) + opt("report", "تقارير حول تونس", q.kind) + opt("resource", "مواقع وقواعد بيانات", q.kind) + opt("mandate", "ولايات الإجراءات الخاصة", q.kind) + "</select></label>" +
      '<label class="fld" for="f-type">نوع الوثيقة<select class="ctl" id="f-type">' + opt("", "كل الأنواع", q.type) + Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).map(function (k) { return opt(k, typeName(k) + " (" + types[k] + ")", q.type); }).join("") + "</select></label>" +
      '<label class="fld" for="f-right">الحق موضوع البحث<select class="ctl" id="f-right">' + opt("", "كل الحقوق", q.right) + D.rights.map(function (x) { return opt(x.id, x.title, q.right); }).join("") + "</select></label>" +
      '<label class="fld" for="f-pub">المؤسسة الناشرة<select class="ctl" id="f-pub">' + opt("", "كل المؤسسات", q.publisher) + Object.keys(pubs).sort().map(function (k) { return opt(k, k + " (" + pubs[k] + ")", q.publisher); }).join("") + "</select></label>" +
      '<label class="fld" for="f-scope">الدولة أو النطاق<select class="ctl" id="f-scope">' + opt("", "الكل", q.scope) + Object.keys(D.meta.scopes).map(function (k) { return opt(k, D.meta.scopes[k], q.scope); }).join("") + "</select></label>" +
      '<label class="fld" for="f-lang">اللغة<select class="ctl" id="f-lang">' + opt("", "كل اللغات", q.lang) + Object.keys(langs).map(function (k) { return opt(k, D.meta.langs[k] || k, q.lang); }).join("") + "</select></label>" +
      '<label class="fld" for="f-sec">القسم<select class="ctl" id="f-sec">' + opt("", "كل الأقسام", q.section) + D.meta.sections.filter(function (s) { return s.id !== "rights"; }).map(function (s) { return opt(s.id, s.name, q.section); }).join("") + "</select></label>" +
      '<div class="yr"><label class="fld" for="f-yfrom">من سنة<select class="ctl" id="f-yfrom">' + opt("", "—", q.yfrom) + years.map(function (y) { return opt(y, y, q.yfrom); }).join("") + "</select></label>" +
      '<label class="fld" for="f-yto">إلى سنة<select class="ctl" id="f-yto">' + opt("", "—", q.yto) + years.map(function (y) { return opt(y, y, q.yto); }).join("") + "</select></label></div>" +
      '<button class="btn sm" type="button" data-act="clearf">مسح الفلاتر</button></form>';
    var res = r.items.slice(0, q.limit);
    var rightsHtml = r.rights.length ? '<div class="rgroup"><h2>حقوق مطابقة</h2><div class="chips">' + r.rights.map(function (x) { return '<a class="chip" href="#right-' + x.id + '">' + esc(x.title) + "</a>"; }).join("") + "</div></div>" : "";
    var symHint = isSym(q.q.trim().toUpperCase()) ? '<div class="tipbox" style="margin-bottom:14px">يبدو أنك أدخلت رمز وثيقة أممية: ' + symLink(q.q.trim().toUpperCase()) + " (يفتح النسخة العربية مباشرة)</div>" : "";
    return crumbs([[UI.home, "home"], [UI.search]]) + head("محرك البحث", "البحث المتقدم", "ابحث بالعربية أو الفرنسية أو الإنجليزية: اسم الحق، الاتفاقية، رقم المادة، رمز الوثيقة، اللجنة، المقرر الخاص، الدولة، نوع الوثيقة أو السنة. اجمع بين أكثر من فلتر.") +
      '<div class="sgrid">' + f + "<div>" +
      '<form class="qbar" id="sq" role="search"><input id="q" type="search" value="' + esc(q.q) + '" placeholder="مثال: CEDAW العنف، المادة 19، A/HRC/WGAD/2024/35، rapporteur torture" aria-label="عبارة البحث" autocomplete="off">' + ic("search") + "</form>" +
      '<div class="resbar"><span class="muted num">' + r.items.length + " نتيجة" + (activeN ? " · " + activeN + " فلتر نشط" : "") + "</span>" +
      '<span class="toolbar"><button class="btn sm filtertoggle" data-act="togglef" aria-expanded="' + st.filtersOpen + '">الفلاتر' + (activeN ? " (" + activeN + ")" : "") + "</button>" +
      '<label class="fld" for="f-sort" style="display:flex;gap:6px;align-items:center">الترتيب<select class="ctl" id="f-sort">' + opt("rel", "الأكثر صلة", q.sort) + opt("new", "الأحدث", q.sort) + opt("old", "الأقدم", q.sort) + "</select></label></span></div>" +
      symHint + rightsHtml +
      (res.length ? rows(res, { q: q.q }) : '<p class="empty">' + UI.noResults + "</p>") +
      (r.items.length > q.limit ? '<button class="btn showall" data-act="more">عرض المزيد (' + (r.items.length - q.limit) + ")</button>" : "") +
      "</div></div>";
  }

  /* ---- lists */
  function vLists() {
    function box(id, name, ids, removable) {
      var items = ids.map(function (i) { return BY[i]; }).filter(Boolean);
      return '<section class="listbox" data-list="' + esc(id) + '"><header><h2>' + ic(id === "fav" ? "star" : "list") + " " + esc(name) + ' <span class="muted num" style="font-size:14px">(' + items.length + ")</span></h2>" +
        '<div class="toolbar">' + (items.length ? '<button class="btn sm" data-act="copyall" data-list="' + esc(id) + '">' + ic("copy") + " نسخ الإحالات</button>" +
        '<button class="btn sm" data-act="exp" data-fmt="doc" data-list="' + esc(id) + '">' + ic("download") + " Word</button>" +
        '<button class="btn sm" data-act="exp" data-fmt="csv" data-list="' + esc(id) + '">CSV</button>' +
        '<button class="btn sm" data-act="exp" data-fmt="bib" data-list="' + esc(id) + '">BibTeX</button>' : "") +
        (removable ? '<button class="btn sm" data-act="dellist" data-list="' + esc(id) + '">حذف القائمة</button>' : "") + "</div></header>" +
        (removable && st.confirmDel === id ? '<div class="alert" style="margin:0">حذف القائمة «' + esc(name) + '» نهائيًا؟ <button class="btn sm tn" data-act="dellist-yes" data-list="' + esc(id) + '">نعم، احذف</button> <button class="btn sm" data-act="dellist-no">إلغاء</button></div>' : "") +
        (items.length ? '<div class="rows">' + items.map(function (d) {
          return '<div class="row"><div class="row-main"><div class="row-title"><a href="' + href(d.id) + '">' + esc(d.title) + '</a></div><div class="row-meta">' + forceBadge(d) + (d.date ? '<span class="num">' + esc(fmtDate(d.date)) + "</span>" : "") + "</div></div>" +
            '<span class="actions"><button class="iconbtn" data-act="rm" data-list="' + esc(id) + '" data-id="' + esc(d.id) + '" aria-label="إزالة من القائمة" title="إزالة">' + ic("x") + "</button></span></div>";
        }).join("") + "</div>" : '<p class="empty">القائمة فارغة. أضف وثائق بزر النجمة أو زر القائمة على أي وثيقة.</p>') + "</section>";
    }
    return crumbs([[UI.home, "home"], [UI.lists]]) + head("أدوات الباحث", "المفضلة وقوائم البحث", "احفظ الوثائق التي تعود إليها، ورتّبها في قوائم حسب موضوع بحثك، ثم صدّر مراجعها. القوائم محفوظة في متصفحك على هذا الجهاز فقط.") +
      '<div class="toolbar" style="margin-bottom:14px"><span class="muted">نمط الإحالة في التصدير والنسخ:</span>' + STYLES.map(function (x) { return '<button class="chip" data-cstyle="' + x[0] + '" aria-pressed="' + (x[0] === st.citeStyle) + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<form class="newlist" id="newlist" style="margin-bottom:18px"><input class="ctl" id="nl-name" maxlength="80" placeholder="اسم قائمة جديدة، مثلًا: بحث حول المرسوم 54" aria-label="اسم القائمة الجديدة"><button class="btn primary" type="submit">' + ic("plus") + " إنشاء قائمة</button></form>" +
      '<div class="lists">' + box("fav", "المفضلة", LISTS.fav, false) + LISTS.lists.map(function (l) { return box(l.id, l.name, l.items, true); }).join("") + "</div>";
  }

  /* ---- guides */
  function vGuides() {
    var guides = D.guides.map(function (h) {
      return '<article class="guide" id="g-' + h.id + '"><h2>' + esc(h.title) + "</h2><ol>" + h.steps.map(function (s) { return "<li><span>" + esc(s) + "</span></li>"; }).join("") +
        '</ol><div class="gl-links">' + h.links.map(function (l) { return ext(l[1], esc(l[0])); }).join("") + "</div></article>";
    }).join("");
    return crumbs([[UI.home, "home"], [UI.guides]]) + head("أدلة عملية", "كيف أبحث؟", "مسارات مجرّبة لأكثر المهام تكرارًا في عمل الباحث والناشط، خطوة بخطوة.") +
      '<section class="tool"><h2>من الرمز إلى الوثيقة</h2><p class="muted">الصق رمز أي وثيقة أممية لتحصل على رابطها الدائم بالعربية أو بلغة أخرى.</p>' +
      '<div class="tool-row"><input id="symIn" value="CCPR/C/GC/34" aria-label="رمز الوثيقة" spellcheck="false"><div class="chips">' +
      ["ar", "fr", "en"].map(function (l, i) { return '<button class="chip" data-lang="' + l + '" aria-pressed="' + (i === 0) + '">' + D.meta.langs[l] + "</button>"; }).join("") +
      '</div></div><div class="tool-row"><output id="symOut"></output><button class="btn sm" data-act="symcopy" type="button">' + ic("copy") + " نسخ الرابط</button></div></section>" +
      '<div class="guides">' + guides + "</div>";
  }
  function updSym() {
    var inp = document.getElementById("symIn"); if (!inp) return;
    var b = main.querySelector("[data-lang][aria-pressed=\"true\"]"); var lang = b ? b.dataset.lang : "ar";
    var s = inp.value.trim().replace(/^https?:\/\/[^/]+\/(ar|en|fr|es|ru|zh)\//i, "").replace(/\s+/g, "");
    var out = document.getElementById("symOut");
    if (!s) { out.innerHTML = '<span class="muted">أدخل رمزًا مثل A/HRC/RES/53/4</span>'; return; }
    out.innerHTML = ext(unDoc(s, lang), esc(unDoc(s, lang)));
  }


  /* ---- restored views from the first version: map, resources, general comments index */
  function resIn(sid) { return IDX.filter(function (it) { return it.kind === "resource" && (it.sections || []).some(function (x) { return x[0] === sid; }); }); }
  var MAPCATS = ["standards", "treaty", "hrc", "caselaw", "regional", "tools", "tunisia"];
  function vMap() {
    function node(id, wide) {
      var s = SEC[id], items = resIn(id);
      return '<button class="node sec-card' + (id === "tunisia" ? " tn" : "") + (wide ? " wide" : "") + '" data-node="' + id + '" style="text-align:right;font:inherit;cursor:pointer">' +
        '<span class="ico">' + ic(s.icon, "lg") + "</span><h2>" + esc(s.name) + '<span class="num">' + items.length + "</span></h2><p>" + esc(s.desc) + "</p>" +
        '<ul class="plain" style="grid-column:2;color:var(--ink);font-size:13.5px">' + items.slice(0, 4).map(function (r) { return "<li>" + esc(r.title) + "</li>"; }).join("") + "</ul></button>";
    }
    function row(ids) { return '<div class="grid-sec" style="grid-template-columns:repeat(' + ids.length + ',minmax(0,1fr))">' + ids.map(function (i) { return node(i, ids.length === 1); }).join("") + "</div>"; }
    return crumbs([[UI.home, "home"], ["خريطة المنظومة"]]) + head("من أين أبدأ؟", "خريطة منظومة حماية حقوق الإنسان",
      "كل مربع يمثل جزءًا من المنظومة ويفتح موارده. المعايير في الأعلى، ثم الآليات التي تراقب تطبيقها، ثم الاجتهادات والمنظومات الإقليمية، ثم أدوات البحث التي تجمع الوثائق.") +
      '<div class="tn-band"><div><strong>تونس أولًا</strong><p>' + esc(D.tunisia.note_court) + '</p></div><div class="btns"><a class="btn tn" href="#tunisia">ملف تونس</a><a class="btn" href="#reports">التقارير حول تونس</a></div></div>' +
      '<div class="tier">المعايير</div>' + row(["standards"]) +
      '<div class="tier">آليات الرقابة الأممية</div>' + row(["treaty", "hrc"]) +
      '<div class="tier">الاجتهادات والمنظومات الإقليمية</div>' + row(["caselaw", "regional"]) +
      '<div class="tier">البحث في الوثائق</div>' + row(["tools"]) +
      '<div class="facts"><span><b>' + D.resources.length + "</b> موقعًا وقاعدة بيانات</span><span><b>" + D.rights.length + "</b> حقًا مفهرسًا</span><span><b>" +
      D.documents.filter(function (d) { return d.type === "gc"; }).length + "</b> تعليقًا وتوصية عامة</span><span><b>" + D.guides.length + "</b> أدلة بحث عملية</span></div>";
  }
  function vLibrary() {
    var f = st.lib, toks = tokens(f.q);
    var all = IDX.filter(function (it) { return it.kind === "resource"; });
    var list = all.filter(function (r) {
      if (f.cat && !(r.sections || []).some(function (x) { return x[0] === f.cat; })) return false;
      if (f.ar && (r.langs || []).indexOf("ar") < 0) return false;
      if (f.tn && !r.tunisia) return false;
      return match(r, toks) > 0;
    });
    var chips = '<button class="chip" data-libcat="" aria-pressed="' + (!f.cat) + '">الكل<span class="n">' + all.length + "</span></button>" +
      MAPCATS.map(function (c) { return '<button class="chip' + (c === "tunisia" ? " tn" : "") + '" data-libcat="' + c + '" aria-pressed="' + (f.cat === c) + '">' + esc(SEC[c].name) + '<span class="n">' + resIn(c).length + "</span></button>"; }).join("");
    return crumbs([[UI.home, "home"], ["الموارد"]]) + head("قاعدة الموارد", "المواقع وقواعد البيانات", f.cat ? SEC[f.cat].desc : "كل الموارد مع وصف ما تحتويه ونصيحة استعمال عملية.", '<span class="muted num">' + list.length + " نتيجة</span>") +
      '<div class="chips" style="margin-bottom:12px">' + chips + "</div>" +
      '<div class="chips" style="margin-bottom:18px"><button class="chip" data-act="libar" aria-pressed="' + f.ar + '">بالعربية فقط</button><button class="chip tn" data-act="libtn" aria-pressed="' + f.tn + '">تخص تونس</button>' +
      '<input class="ctl" id="lq" type="search" placeholder="تصفية…" value="' + esc(f.q) + '" aria-label="تصفية الموارد"></div>' +
      (list.length ? '<div class="cards">' + list.map(resCard).join("") + "</div>" : '<p class="empty">لا موارد تطابق هذه التصفية.</p>');
  }
  var BODY_ORDER = ["CCPR", "CESCR", "CERD", "CEDAW", "CAT", "CRC", "CMW", "CRPD", "CED", "ACHPR"];
  function vDocs() {
    var f = st.gd, toks = tokens(f.q);
    var list = IDX.filter(function (d) { return d.type === "gc" && (!f.body || d.body === f.body) && match(d, toks) > 0; });
    list.sort(function (a, b) {
      if (f.sort === "year") return (b.year || 0) - (a.year || 0);
      return BODY_ORDER.indexOf(a.body) - BODY_ORDER.indexOf(b.body) || (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0);
    });
    function opt(v, l, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(l) + "</option>"; }
    var rowsHtml = list.map(function (g) {
      var th = (g.rights || []).filter(function (r) { return RIGHT[r]; }).map(function (r) { return '<a href="#right-' + r + '">' + esc(RIGHT[r].title) + "</a>"; }).join("، ");
      return '<tr><td><span class="sym">' + esc(g.body) + '</span></td><td class="num">' + esc(g.number) + '</td><td><a href="' + href(g.id) + '">' + esc(g.title) + "</a>" +
        (g.status ? ' <span class="status">' + esc(g.status) + "</span>" : "") + "</td><td>" + (g.symbol ? symLink(g.symbol) : ext(g.url, "عبر صفحة اللجنة")) +
        '</td><td class="num">' + esc(g.year || "") + "</td><td>" + th + "</td><td>" + actions(g) + "</td></tr>";
    }).join("");
    return crumbs([[UI.home, "home"], ["فهرس التعليقات العامة"]]) + head("فهرس الوثائق", "التعليقات والتوصيات العامة",
      "التعليقات العامة للجان الأممية واللجنة الإفريقية، مرتبطة بالحقوق التي تفسّرها. الرمز يفتح النسخة العربية مباشرة؛ الوثائق القديمة بلا رمز منفرد تفتح قائمة اللجنة.", '<span class="muted num">' + list.length + " وثيقة</span>") +
      '<div class="chips" style="margin-bottom:16px"><select class="ctl" id="gd-body" aria-label="اللجنة">' + opt("", "كل اللجان", f.body) +
      D.meta.bodies.map(function (b) { return opt(b.code, b.name, f.body); }).join("") + "</select>" +
      '<select class="ctl" id="gd-sort" aria-label="الترتيب">' + opt("body", "حسب اللجنة والرقم", f.sort) + opt("year", "الأحدث أولًا", f.sort) + "</select>" +
      '<input class="ctl" id="gd-q" type="search" placeholder="ابحث في العناوين والرموز…" value="' + esc(f.q) + '" aria-label="بحث في الفهرس"></div>' +
      '<div class="tablewrap"><table class="gdocs"><thead><tr><th>الهيئة</th><th>الرقم</th><th>الموضوع</th><th>الرمز (عربي)</th><th>السنة</th><th>الحق المرتبط</th><th><span class="sr">إجراءات</span></th></tr></thead><tbody>' +
      (rowsHtml || '<tr><td colspan="7" class="empty">لا وثائق تطابق البحث.</td></tr>') + "</tbody></table></div>";
  }
  function vNotFound() { return head("", "الصفحة غير موجودة", "ربما تغيّر الرابط. ابحث في المكتبة أو عُد إلى الرئيسية.", '<a class="btn primary" href="#home">الرئيسية</a>'); }

  /* ------------------------------------------------------------------ export */
  function listItems(listId) {
    var ids = listId === "fav" ? LISTS.fav : ((LISTS.lists.filter(function (l) { return l.id === listId; })[0] || {}).items || []);
    return ids.map(function (i) { return BY[i]; }).filter(Boolean);
  }
  function listName(listId) { return listId === "fav" ? "المفضلة" : ((LISTS.lists.filter(function (l) { return l.id === listId; })[0] || {}).name || "قائمة"); }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(items) {
    var h = ["id", "العنوان", "العنوان الأصلي", "الجهة", "التاريخ", "النوع", "القيمة القانونية", "الرمز", "الرابط", "PDF", "اللغات", "آخر تحقق"];
    var lines = [h.join(",")].concat(items.map(function (d) {
      return [d.id, d.title, d.sub || "", d.publisher || "", d.date || "", typeName(d.type), forceName(d.type), d.symbol || "", d.url || "", d.pdf || "", (d.langs || []).join(" "), d.checked || ""].map(csvCell).join(",");
    }));
    return "﻿" + lines.join("\r\n");
  }
  function bibKey(d) { return (d.id || "ref").replace(/[^A-Za-z0-9]/g, "") + (d.year || ""); }
  function bibEsc(s) { return String(s || "").replace(/[{}]/g, ""); }
  function toBib(d) {
    var type = d.kind === "report" && d.type === "report" ? "techreport" : "misc";
    var f = ["  title = {{" + bibEsc(enTitle(d)) + "}}", "  author = {{" + bibEsc(author(d)) + "}}"];
    if (type === "techreport") f.push("  institution = {{" + bibEsc(author(d)) + "}}");
    if (d.year) f.push("  year = {" + d.year + "}");
    if (d.date && String(d.date).length >= 7) f.push("  month = {" + MONTHS_EN[+String(d.date).slice(5, 7) - 1].slice(0, 3).toLowerCase() + "}");
    if (d.symbol) f.push("  note = {UN Doc. " + bibEsc(d.symbol) + "}");
    f.push("  url = {" + (d.symbol && isSym(d.symbol) ? unDoc(d.symbol, "en") : d.url) + "}", "  urldate = {" + today() + "}");
    if (/[؀-ۿ]/.test(enTitle(d))) f.push("  language = {arabic}");
    return "@" + type + "{" + bibKey(d) + ",\n" + f.join(",\n") + "\n}";
  }
  function toDoc(items, name) {
    var s = st.citeStyle, rtl = s === "arabic";
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(name) + "</title>" +
      "<style>body{font-family:'Times New Roman',serif;font-size:12pt}h1{font-size:16pt}li{margin-bottom:8pt}</style></head><body dir=\"" + (rtl ? "rtl" : "ltr") + "\">" +
      '<h1 dir="rtl">' + esc(name) + "</h1><p dir=\"rtl\">قائمة مراجع من مكتبة صغار الباحثين، نمط " + esc(STYLES.filter(function (x) { return x[0] === s; })[0][1]) + "، بتاريخ " + esc(fmtDate(today())) + "</p><ol>" +
      items.map(function (d) { return "<li>" + cite(d, s) + "</li>"; }).join("") + "</ol></body></html>";
  }
  function download(name, mime, content) {
    try {
      var blob = new Blob([content], { type: mime }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      toast("جُهّز الملف " + name);
    } catch (e) { toast("تعذّر التنزيل في هذا المتصفح: استعمل زر نسخ الإحالات"); }
  }
  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || UI.copied); };
    var fallback = function () {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove(); toast(ok ? (okMsg || UI.copied) : UI.copyFail);
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  /* ------------------------------------------------------------------ sheet (add to list) & toast */
  var sheet = document.getElementById("sheet"), lastFocus = null;
  function openSheet(id) {
    var d = BY[id]; if (!d) return;
    lastFocus = document.activeElement;
    sheet.innerHTML = '<div class="sheet-back" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t" data-stop="1"><h2 id="sh-t">' + UI.addList + "</h2>" +
      '<p class="muted" style="font-size:13.5px">' + esc(d.title) + "</p><div class=\"opts\">" +
      '<label class="opt"><input type="checkbox" data-sl="fav"' + (isFav(id) ? " checked" : "") + "> المفضلة</label>" +
      LISTS.lists.map(function (l) { return '<label class="opt"><input type="checkbox" data-sl="' + esc(l.id) + '"' + (l.items.indexOf(id) >= 0 ? " checked" : "") + "> " + esc(l.name) + "</label>"; }).join("") + "</div>" +
      '<form class="newlist" id="sheetnew"><input class="ctl" id="sh-name" maxlength="80" placeholder="قائمة جديدة" aria-label="اسم قائمة جديدة"><button class="btn sm" type="submit">' + ic("plus") + " إنشاء وإضافة</button></form>" +
      '<div class="toolbar"><button class="btn primary sm" data-act="closesheet">تم</button><a class="btn sm" href="#lists" data-act="closesheet">قوائمي</a></div></div></div>';
    sheet.hidden = false; sheet.dataset.id = id;
    var first = sheet.querySelector("input"); if (first) first.focus();
  }
  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); render(true); }
  sheet.addEventListener("click", function (e) {
    if (e.target.classList.contains("sheet-back")) { closeSheet(); return; }
    var a = e.target.closest(".sheet [data-act=closesheet]");
    if (!a) return;
    if (a.tagName !== "A") e.preventDefault();
    closeSheet();
  });
  sheet.addEventListener("change", function (e) {
    var cb = e.target.closest("[data-sl]"); if (!cb) return;
    var id = sheet.dataset.id, l = cb.dataset.sl;
    if (l === "fav") { if (cb.checked !== isFav(id)) toggleFav(id); return; }
    var list = LISTS.lists.filter(function (x) { return x.id === l; })[0]; if (!list) return;
    var i = list.items.indexOf(id);
    if (cb.checked && i < 0) list.items.push(id); else if (!cb.checked && i >= 0) list.items.splice(i, 1);
    saveLists(); toast(cb.checked ? "أُضيفت إلى «" + list.name + "»" : "أُزيلت من «" + list.name + "»");
  });
  sheet.addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = document.getElementById("sh-name"), name = inp.value.trim(); if (!name) { inp.focus(); return; }
    var l = { id: "l" + Date.now().toString(36), name: name, items: [sheet.dataset.id] };
    LISTS.lists.push(l); saveLists(); toast("أُنشئت القائمة «" + name + "»"); openSheet(sheet.dataset.id);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
  var toastEl = document.getElementById("toast"), tt;
  function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(function () { toastEl.hidden = true; }, 2600); }
  function updateNavCount() {
    var a = document.querySelector('.nav a[data-r="lists"]'); if (!a) return;
    var n = LISTS.fav.length + LISTS.lists.reduce(function (s, l) { return s + l.items.length; }, 0);
    a.innerHTML = esc("قوائمي") + (n ? ' <span class="count">' + n + "</span>" : "");
  }

  /* ------------------------------------------------------------------ routing */
  var LEGACY = { howto: "guides" };
  function parse() {
    var h = (location.hash || "").replace(/^#/, "");
    if (LEGACY[h]) return LEGACY[h];
    if (/^r-/.test(h)) return "right-" + h.slice(2);
    if (/^c-/.test(h)) {
      var c = h.slice(2), m = { tn: "tunisia", norms: "standards", tb: "treaty", hrc: "hrc", sp: "hrc", search: "tools", agencies: "tools", africa: "regional", arab: "regional", comp: "tools" };
      st.lib.cat = m[c] || ""; return "library";
    }
    return h || "home";
  }
  function render(keepScroll) {
    var r = parse(), html;
    st.route = r;
    try {
      if (r === "home") html = vHome();
      else if (r.indexOf("section-") === 0) html = vSection(r.slice(8));
      else if (r === "rights") html = vRights(D.rights[0].id);
      else if (r.indexOf("right-") === 0) html = vRights(r.slice(6));
      else if (r === "tunisia") html = vTunisia();
      else if (r === "reports") html = vReports();
      else if (r.indexOf("doc-") === 0) html = vDoc(r.slice(4));
      else if (r === "search") html = vSearch();
      else if (r === "lists") html = vLists();
      else if (r === "guides") html = vGuides();
      else if (r === "map") html = vMap();
      else if (r === "library") html = vLibrary();
      else if (r === "docs") html = vDocs();
      else if (r === "main") return;
      else html = vNotFound();
    } catch (err) {
      html = '<div class="error-box"><b>حدث خطأ أثناء عرض هذه الصفحة.</b><code>' + esc(err.message) + "</code></div>";
      if (window.console) console.error(err);
    }
    var y = window.scrollY;
    main.innerHTML = '<div class="view">' + html + "</div>";
    if (r === "guides") updSym();
    document.querySelectorAll(".nav a").forEach(function (a) {
      var t = a.dataset.r, cur = t === r || (t === "rights" && r.indexOf("right-") === 0) || (t === "search" && r.indexOf("doc-") === 0 && false);
      if (cur) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var titleMap = { home: D.meta.name };
    var h1 = main.querySelector("h1");
    document.title = (r === "home" ? D.meta.name : (h1 ? h1.textContent.trim() + " · " : "") + D.meta.name);
    if (keepScroll) window.scrollTo(0, y);
  }
  function go(hash) { if (location.hash === "#" + hash) render(); else location.hash = hash; }
  window.addEventListener("hashchange", function () { render(); window.scrollTo(0, 0); });

  /* ------------------------------------------------------------------ events */
  document.getElementById("mastSearch").addEventListener("submit", function (e) {
    e.preventDefault(); var v = document.getElementById("mq").value.trim();
    st.sq = Object.assign({}, st.sq, { q: v, limit: 40 }); go("search"); document.getElementById("mq").value = "";
  });
  document.querySelector(".skip").addEventListener("click", function (e) { e.preventDefault(); main.focus(); });

  main.addEventListener("submit", function (e) {
    var id = e.target.id; e.preventDefault();
    if (id === "homeSearch") { st.sq = Object.assign({}, st.sq, { q: document.getElementById("hq").value.trim(), limit: 40 }); go("search"); }
    else if (id === "sq") { st.sq.q = document.getElementById("q").value.trim(); render(true); }
    else if (id === "newlist") {
      var inp = document.getElementById("nl-name"), name = inp.value.trim(); if (!name) { inp.focus(); return; }
      LISTS.lists.push({ id: "l" + Date.now().toString(36), name: name, items: [] }); saveLists(); toast("أُنشئت القائمة «" + name + "»"); render(true);
    }
  });
  var qt;
  main.addEventListener("input", function (e) {
    var id = e.target.id;
    if (id === "q") { clearTimeout(qt); qt = setTimeout(function () { st.sq.q = e.target.value; st.sq.limit = 40; rerenderKeep("q"); }, 220); }
    else if (id === "rq") { clearTimeout(qt); qt = setTimeout(function () { st.rep.q = e.target.value; rerenderKeep("rq"); }, 220); }
    else if (id === "symIn") updSym();
    else if (id === "lq") { st.lib.q = e.target.value; rerenderKeep("lq"); }
    else if (id === "gd-q") { st.gd.q = e.target.value; rerenderKeep("gd-q"); }
  });
  main.addEventListener("change", function (e) {
    var id = e.target.id, v = e.target.value;
    var map = { "f-kind": "kind", "f-type": "type", "f-right": "right", "f-pub": "publisher", "f-scope": "scope", "f-lang": "lang", "f-sec": "section", "f-yfrom": "yfrom", "f-yto": "yto", "f-sort": "sort" };
    if (map[id]) { st.sq[map[id]] = v; st.sq.limit = 40; rerenderKeep(id); return; }
    if (id === "gd-body") { st.gd.body = v; rerenderKeep(id); return; }
    if (id === "gd-sort") { st.gd.sort = v; rerenderKeep(id); return; }
    var rmap = { rtopic: "topic", rpub: "publisher", rlang: "lang", rtype: "type" };
    if (rmap[id]) { st.rep[rmap[id]] = v; rerenderKeep(id); return; }
    if (id === "rsel") go("right-" + v);
  });
  function rerenderKeep(id) {
    var el = document.getElementById(id), pos = el && el.selectionStart;
    render(true);
    var n = document.getElementById(id); if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) {} }
  }
  main.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act], [data-q], [data-section], [data-gcbody], [data-cstyle], [data-year], [data-lang], [data-libcat], [data-node]");
    if (!el) return;
    if (el.dataset.node) { st.lib.cat = el.dataset.node; go("library"); return; }
    if (el.dataset.libcat != null) { st.lib.cat = el.dataset.libcat; render(true); return; }
    if (el.dataset.q != null && el.tagName === "A") { e.preventDefault(); st.sq = Object.assign({}, st.sq, { q: el.dataset.q, limit: 40 }); go("search"); return; }
    if (el.dataset.section) { e.preventDefault(); st.sq = Object.assign({}, st.sq, { section: el.dataset.section, q: "", limit: 40 }); st.filtersOpen = true; go("search"); return; }
    if (el.dataset.gcbody != null && !el.dataset.act) { st.gcBody = el.dataset.gcbody; render(true); return; }
    if (el.dataset.cstyle) { st.citeStyle = el.dataset.cstyle; render(true); return; }
    if (el.dataset.year) { var y = document.getElementById("y" + el.dataset.year); if (y) y.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (el.dataset.lang && !el.dataset.act) { main.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === el)); }); updSym(); return; }
    var act = el.dataset.act, id = el.dataset.id, list = el.dataset.list;
    if (act === "fav") { toggleFav(id); render(true); }
    else if (act === "list") openSheet(id);
    else if (act === "expand") { st.expanded[el.dataset.key] = !st.expanded[el.dataset.key]; render(true); }
    else if (act === "more") { st.sq.limit += 40; render(true); }
    else if (act === "togglef") { st.filtersOpen = !st.filtersOpen; render(true); }
    else if (act === "clearf") { st.sq = { q: st.sq.q, kind: "", type: "", publisher: "", right: "", scope: "", lang: "", section: "", yfrom: "", yto: "", sort: "rel", limit: 40 }; render(true); }
    else if (act === "copycite") { var o = document.getElementById("citeOut"); copyText(o.textContent, "نُسخت الإحالة"); }
    else if (act === "bib") copyText(toBib(BY[id]), "نُسخت بيانات BibTeX");
    else if (act === "symcopy") copyText(document.getElementById("symOut").textContent, "نُسخ الرابط");
    else if (act === "copyall") copyText(listItems(list).map(function (d, i) { return (i + 1) + ". " + plain(cite(d, st.citeStyle)); }).join("\n"), "نُسخت الإحالات");
    else if (act === "exp") {
      var items = listItems(list), nm = listName(list), base = "yrl-" + (list === "fav" ? "favorites" : list);
      if (el.dataset.fmt === "csv") download(base + ".csv", "text/csv;charset=utf-8", toCSV(items));
      else if (el.dataset.fmt === "bib") download(base + ".bib", "application/x-bibtex;charset=utf-8", items.map(toBib).join("\n\n"));
      else download(base + ".doc", "application/msword", "﻿" + toDoc(items, nm));
    }
    else if (act === "rm") {
      if (list === "fav") toggleFav(id);
      else { var l = LISTS.lists.filter(function (x) { return x.id === list; })[0]; if (l) { l.items = l.items.filter(function (x) { return x !== id; }); saveLists(); } }
      render(true);
    }
    else if (act === "libar") { st.lib.ar = !st.lib.ar; render(true); }
    else if (act === "libtn") { st.lib.tn = !st.lib.tn; render(true); }
    else if (act === "dellist") { st.confirmDel = list; render(true); }
    else if (act === "dellist-no") { st.confirmDel = null; render(true); }
    else if (act === "dellist-yes") { LISTS.lists = LISTS.lists.filter(function (x) { return x.id !== list; }); st.confirmDel = null; saveLists(); toast("حُذفت القائمة"); render(true); }
  });

  /* ------------------------------------------------------------------ boot */
  var nav = document.getElementById("nav");
  nav.innerHTML = NAV.map(function (n) { return '<a href="#' + n[0] + '" data-r="' + n[0] + '"' + (n[2] ? ' class="tn"' : "") + ">" + esc(n[1]) + (n[2] === "tn" && n[0] === "tunisia" ? '<span class="dot" aria-hidden="true"></span>' : "") + "</a>"; }).join("");
  updateNavCount();
  load().then(function () {
    document.getElementById("upd").textContent = fmtDate(D.meta.updated);
    render();
  }).catch(function (err) {
    main.innerHTML = '<div class="error-box"><b>تعذّر تحميل بيانات المكتبة.</b><p>إن فتحت الملف مباشرة من جهازك (file://)، فالمتصفح يمنع قراءة ملفات البيانات. شغّل خادمًا محليًا من مجلد المشروع:</p><code>python3 -m http.server 8000</code><p>ثم افتح http://localhost:8000. على GitHub Pages تعمل المكتبة مباشرة.</p><code>' + esc(err.message) + "</code></div>";
  });
})();
