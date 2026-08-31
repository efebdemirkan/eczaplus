
function localSafeUrl(url) {
  if (!url) return '#';
  if (window.location.protocol === 'file:' && url.startsWith('/')) return '.' + url;
  return url;
}

const heroCanvas = document.getElementById('threeLogoCanvas');
const heroShell = document.getElementById('threeLogoShell');
const headerCanvas = document.getElementById('headerLogoCanvas');
const headerShell = document.getElementById('headerLogoShell');

function createLayered3DLogo(canvas, shell, options = {}) {
  if (!canvas || !shell || !window.THREE) return null;
  const lowPower = matchMedia('(max-width: 760px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.15 : (options.pixelRatio || 2)));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(options.fov || 34, 1, 0.1, 100);
  camera.position.set(0, 0, options.cameraZ || 6.2);

  scene.add(new THREE.AmbientLight(0xffffff, options.ambient || 2.3));
  const key = new THREE.DirectionalLight(0xffffff, options.key || 3.6);
  key.position.set(3.8, 4.6, 5.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xded8ce, options.rim || 2.0);
  rim.position.set(-4.5, -1, 2.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, options.fill || 1.2);
  fill.position.set(0, 0, 6);
  scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);

  const shadowGeometry = new THREE.PlaneGeometry(3.8, 4.8);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.07 });
  const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowMesh.position.set(0, -0.16, -0.95);
  shadowMesh.scale.set(0.96, 0.9, 1);
  group.add(shadowMesh);

  let targetX = options.startX ?? -0.34;
  let targetY = options.startY ?? 0.52;
  let pointerDown = false;
  let userInteracting = false;
  let lastX = 0;
  let lastY = 0;
  let loaded = false;

  const logoSource = shell.querySelector('img')?.src || document.querySelector('.three-logo-fallback img')?.src || 'logo.png';
  const loader = new THREE.TextureLoader();
  loader.load(logoSource, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const geometry = new THREE.PlaneGeometry(options.width || 3.25, options.height || 4.05);
    const layers = lowPower ? Math.min(options.layers || 30, 10) : (options.layers || 30);
    const depthRange = options.depth || 0.95;

    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const depth = -depthRange / 2 + t * depthRange;
      const isFront = i === layers - 1;
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.05,
        color: isFront ? 0xffffff : (options.sideColor || 0x505050),
        roughness: isFront ? 0.55 : 0.78,
        metalness: isFront ? 0.08 : 0.18,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.z = depth;
      mesh.scale.setScalar(1 - Math.abs(depth) * 0.005);
      group.add(mesh);
    }

    const sheenGeo = new THREE.PlaneGeometry((options.width || 3.25) * 1.02, (options.height || 4.05) * 1.02);
    const sheenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04 });
    const sheen = new THREE.Mesh(sheenGeo, sheenMat);
    sheen.position.z = depthRange / 2 + 0.02;
    group.add(sheen);

    loaded = true;
    shell.classList.add('webgl-ready');
  });

  function resize() {
    const r = shell.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (options.interactive !== false) {
    shell.addEventListener('pointerdown', e => {
      pointerDown = true;
      userInteracting = true;
      lastX = e.clientX;
      lastY = e.clientY;
      shell.setPointerCapture?.(e.pointerId);
    });
    shell.addEventListener('pointermove', e => {
      const r = shell.getBoundingClientRect();
      if (pointerDown) {
        targetY += (e.clientX - lastX) * 0.015;
        targetX += (e.clientY - lastY) * 0.012;
        targetY = Math.max(-1.3, Math.min(1.3, targetY));
        targetX = Math.max(-0.95, Math.min(0.95, targetX));
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        targetY = (options.startY ?? 0.52) + nx * 0.9;
        targetX = (options.startX ?? -0.34) - ny * 0.7;
      }
    });
    ['pointerup', 'pointercancel'].forEach(evt => shell.addEventListener(evt, () => { pointerDown = false; }));
    shell.addEventListener('pointerleave', () => {
      if (!pointerDown) {
        targetX = options.startX ?? -0.34;
        targetY = options.startY ?? 0.52;
      }
    });
  } else {
    window.addEventListener('pointermove', e => {
      targetY = (options.startY ?? 0.36) + ((e.clientX / Math.max(innerWidth, 1)) - 0.5) * 0.32;
      targetX = (options.startX ?? -0.22) - ((e.clientY / Math.max(innerHeight, 1)) - 0.5) * 0.18;
    }, { passive: true });
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    if (!pointerDown && !userInteracting) {
      targetY = (options.startY ?? 0.52) + Math.sin(t * (options.idleSpeedY || 0.75)) * (options.idleAmpY || 0.14);
      targetX = (options.startX ?? -0.34) + Math.cos(t * (options.idleSpeedX || 0.6)) * (options.idleAmpX || 0.10);
    }
    group.rotation.x += (targetX - group.rotation.x) * 0.11;
    group.rotation.y += (targetY - group.rotation.y) * 0.11;
    group.rotation.z = Math.sin(t * (options.spinSpeed || 0.45)) * (options.zFloat || 0.028);
    group.position.y = Math.sin(t * (options.floatSpeed || 1.0)) * (options.floatAmount || 0.05);
    if (loaded) renderer.render(scene, camera);
  }
  animate();

  return {
    reset() {
      userInteracting = false;
      targetX = options.startX ?? -0.34;
      targetY = options.startY ?? 0.52;
    }
  };
}

const hero3D = createLayered3DLogo(heroCanvas, heroShell, {
  layers: 34,
  depth: 1.08,
  cameraZ: 6.4,
  interactive: true,
  pixelRatio: 2,
  startX: -0.42,
  startY: 0.78,
  idleAmpX: 0.12,
  idleAmpY: 0.16,
  floatAmount: 0.055,
  zFloat: 0.03,
  sideColor: 0x505050,
  width: 3.25,
  height: 4.05
});

const header3D = createLayered3DLogo(headerCanvas, headerShell, {
  layers: 22,
  depth: 0.9,
  cameraZ: 5.95,
  fov: 36,
  interactive: false,
  pixelRatio: 1.7,
  startX: -0.26,
  startY: 0.42,
  idleAmpX: 0.06,
  idleAmpY: 0.08,
  floatAmount: 0.02,
  zFloat: 0.02,
  spinSpeed: 0.75,
  sideColor: 0x535353,
  width: 3.2,
  height: 4.0
});


const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.nav');
const navLinks = document.querySelectorAll('.nav a');
const sections = [...document.querySelectorAll('main section[id]')];

menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navLinks.forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { threshold: 0.45 });

sections.forEach(section => observer.observe(section));

const applicationForm = document.getElementById('applicationForm');
const formStatus = document.getElementById('formStatus');

if (applicationForm) {
  applicationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = applicationForm.querySelector('.submit-button');
    const data = new FormData(applicationForm);
    if (data.get('_honey')) return;
    if (!data.get('kvkk_onay')) {
      formStatus.className = 'form-status error';
      formStatus.textContent = 'Devam etmek için KVKK Aydınlatma Metni onay kutusunu işaretlemelisin.';
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = 'Gönderiliyor…';
    formStatus.className = 'form-status';
    formStatus.textContent = 'Başvurun güvenli şekilde gönderiliyor…';
    try {
      const response = await fetch('https://formsubmit.co/ajax/eczaplus0@gmail.com', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: data
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === 'false') throw new Error(result.message || 'Gönderim başarısız');
      formStatus.className = 'form-status success';
      formStatus.textContent = 'Başvurun gönderildi. Teşekkürler!';
      applicationForm.reset();
    } catch (error) {
      console.error(error);
      formStatus.className = 'form-status error';
      formStatus.textContent = 'Başvuru şu an gönderilemedi. Lütfen tekrar dene veya eczaplus0@gmail.com adresine yaz.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Başvuruyu Gönder →';
    }
  });
}

// === KAYDIRMA İLE BELİREN (SCROLL REVEAL) ANİMASYONLAR ===
const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })
  : null;

function observeReveals(root = document) {
  const targets = root.querySelectorAll('.reveal:not(.is-visible), .reveal-group:not(.is-visible)');
  if (!revealObserver) {
    targets.forEach(el => el.classList.add('is-visible')); // gözlemci yoksa doğrudan göster
    return;
  }
  targets.forEach(el => revealObserver.observe(el));
}
observeReveals();

const floatingLogo = document.querySelector('.page-floating-logo img');
let ticking = false;
function updateFloatingLogo() {
  if (!floatingLogo) return;
  const y = window.scrollY || window.pageYOffset || 0;
  const shift = Math.min(180, y * 0.12);
  document.documentElement.style.setProperty('--logo-shift', `${shift}px`);
  ticking = false;
}
function onScrollMoveLogo() {
  if (!ticking) {
    window.requestAnimationFrame(updateFloatingLogo);
    ticking = true;
  }
}
window.addEventListener('scroll', onScrollMoveLogo, { passive: true });
updateFloatingLogo();


const heroLogoStage = document.getElementById('heroLogoStage');
if (heroLogoStage) {
  heroLogoStage.addEventListener('pointermove', (e) => {
    const rect = heroLogoStage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    heroLogoStage.style.setProperty('--spot-x', `${x}%`);
    heroLogoStage.style.setProperty('--spot-y', `${y}%`);
  });
  heroLogoStage.addEventListener('pointerleave', () => {
    heroLogoStage.style.setProperty('--spot-x', '50%');
    heroLogoStage.style.setProperty('--spot-y', '45%');
  });
}


// === ECZAPLUS CMS CONTENT LOADER ===
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

// === Takvime ekle (.ics) — ana sayfa etkinlik kartları için ===
function icsQuickLink(item) {
  const start = new Date(item.date);
  if (Number.isNaN(start.getTime())) return '';
  const pad2 = n => String(n).padStart(2, '0');
  const toIcs = d => `${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`;
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const esc = v => String(v || '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  const body = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EczaPlus//Etkinlik//TR','BEGIN:VEVENT',
    `UID:${toIcs(start)}-${Math.random().toString(36).slice(2,8)}@eczaplus`,
    `DTSTAMP:${toIcs(new Date())}`, `DTSTART:${toIcs(start)}`, `DTEND:${toIcs(end)}`,
    `SUMMARY:${esc(item.title)}`, item.text ? `DESCRIPTION:${esc(item.text)}` : '',
    'END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
  const href = `data:text/calendar;charset=utf8,${encodeURIComponent(body)}`;
  return `<a class="card-ics-link" download="${escapeHtml(item.slug || 'etkinlik')}.ics" href="${href}">📅 Takvime ekle</a>`;
}

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`İçerik yüklenemedi: ${path}`);
  return response.json();
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el && value !== undefined && value !== null) el.textContent = value;
}
function setLink(selector, text, href) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (text !== undefined) el.textContent = text;
  if (href !== undefined) el.setAttribute('href', href || '#');
}

function parseFeedDate(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  const tr = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (tr) return new Date(Number(tr[3]), Number(tr[2]) - 1, Number(tr[1]), Number(tr[4] || 0), Number(tr[5] || 0)).getTime();
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function hydrateCmsContent() {
  try {
    const [general, events, announcements, contents, articles, team, magazine, contact] = await Promise.all([
      loadJson('content/general.json'),
      loadJson('content/events.json'),
      loadJson('content/announcements.json'),
      loadJson('content/contents.json'),
      loadJson('content/articles-index.json'),
      loadJson('content/team.json'),
      loadJson('content/magazine.json'),
      loadJson('content/contact.json')
    ]);

    // Hero
    setText('#anasayfa .eyebrow', general.hero?.eyebrow);
    setText('#anasayfa h1', general.hero?.title);
    setText('#anasayfa .subtitle', general.hero?.subtitle);
    const lead = document.querySelector('#anasayfa .lead');
    if (lead) lead.innerHTML = `<strong>${escapeHtml(general.hero?.lead_label || '')}</strong> ${escapeHtml(general.hero?.lead_text || '')}`;
    setText('#anasayfa .description', general.hero?.description);
    const heroButtons = document.querySelectorAll('#anasayfa .hero-actions a');
    if (heroButtons[0]) { heroButtons[0].innerHTML = `${escapeHtml(general.hero?.primary_text || '')} <span>→</span>`; heroButtons[0].href = general.hero?.primary_link || '#'; }
    if (heroButtons[1]) { heroButtons[1].textContent = general.hero?.secondary_text || ''; heroButtons[1].href = general.hero?.secondary_link || '#'; }

    // Events
    setText('#etkinlikler .eyebrow', events.eyebrow);
    setText('#etkinlikler h2', events.title);
    const eventsGrid = document.querySelector('#etkinlikler .cards');
    if (eventsGrid) {
      const latestEvents = [...(events.items || [])]
        .sort((a,b) => parseFeedDate(b.updated_at || b.date) - parseFeedDate(a.updated_at || a.date))
        .slice(0,3);
      eventsGrid.innerHTML = latestEvents.map(item => `<article class="card"><span>${escapeHtml(item.number || '')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><a class="card-detail-link" href="${escapeHtml(item.url || `etkinlikler/${item.slug}/index.html`)}">Etkinliğe git →</a>${icsQuickLink(item)}${item.registration_open !== false ? `<button type="button" class="event-register-btn" data-event-slug="${escapeHtml(item.slug||'')}" data-event-title="${escapeHtml(item.title||'')}" data-capacity="${escapeHtml(item.capacity||50)}" data-certificate="${item.certificate_enabled?'true':'false'}">Kayıt Ol →</button>` : ''}</article>`).join('');
    }


    if (!(events.items || []).length) {
      const nextTitle = document.getElementById('nextEventTitle');
      const nextMeta = document.getElementById('nextEventMeta');
      if (nextTitle) nextTitle.textContent = 'Henüz etkinlik eklenmedi';
      if (nextMeta) nextMeta.textContent = 'Yeni bir etkinlik eklediğinde burada ve takvimde otomatik görünecek.';
      document.querySelectorAll('#eventCountdown strong').forEach(el => el.textContent = '--');
      const firstReg = document.getElementById('openFirstEventRegistration');
      if (firstReg) { firstReg.disabled = true; firstReg.setAttribute('aria-disabled','true'); }
    } else {
      const firstReg = document.getElementById('openFirstEventRegistration');
      if (firstReg) { firstReg.disabled = false; firstReg.removeAttribute('aria-disabled'); }
    }

    // Announcements
    setText('#duyurular .eyebrow', announcements.eyebrow);
    setText('#duyurular h2', announcements.title);
    setLink('#duyurular .text-link', announcements.action_text, announcements.action_link);
    const noticeGrid = document.querySelector('#duyurular .notice-grid');
    if (noticeGrid) {
      const latestAnnouncements = [...(announcements.items || [])]
        .sort((a,b) => (parseFeedDate(b.updated_at || b.date) - parseFeedDate(a.updated_at || a.date)))
        .slice(0,3);
      noticeGrid.innerHTML = latestAnnouncements.map(item => `<article class="notice-card home-feed-card"><div class="home-card-meta"><small>${escapeHtml(item.date || 'GÜNCEL')}</small><span>DUYURU</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><a class="card-detail-link" href="${escapeHtml(localSafeUrl(item.url || `duyurular/${item.slug}/index.html`))}">Duyuruya git →</a></article>`).join('');
      noticeGrid.classList.toggle('is-single', latestAnnouncements.length === 1);
      noticeGrid.classList.toggle('is-double', latestAnnouncements.length === 2);
    }

    // Contents
    setText('#icerikler .eyebrow', contents.eyebrow);
    setText('#icerikler h2', contents.title);
    const contentsGrid = document.querySelector('#icerikler .cards');
    if (contentsGrid) {
      const latestArticles = [...(articles.items || [])]
        .filter(item => item.published !== false)
        .sort((a,b) => {
          const byCreated = parseFeedDate(b.created_at || b.date) - parseFeedDate(a.created_at || a.date);
          if (byCreated) return byCreated;
          return parseFeedDate(b.updated_at || b.date) - parseFeedDate(a.updated_at || a.date);
        })
        .slice(0,3);
      contentsGrid.innerHTML = latestArticles.map(item => `<article class="card editorial home-feed-card">${item.cover ? `<img class="content-card-cover" src="${escapeHtml(localSafeUrl(item.cover))}" alt="${escapeHtml(item.title)}">` : `<div class="content-card-cover content-card-cover-placeholder"><span>${escapeHtml(item.category || 'ECZAPLUS')}</span></div>`}<div class="home-card-meta"><small>${escapeHtml(item.category || 'İÇERİK')}</small>${item.date ? `<span>${escapeHtml(item.date)}</span>` : ''}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary || '')}</p><a class="card-detail-link" href="${escapeHtml(localSafeUrl(item.url || `icerikler/${item.slug}/index.html`))}">İçeriğe git →</a></article>`).join('');
    }

    // Team
    setText('#ekibimiz .eyebrow', team.eyebrow);
    setText('#ekibimiz h2', team.title);
    setText('#ekibimiz .section-note', team.note);
    const teamGrid = document.querySelector('#ekibimiz .team-grid');
    if (teamGrid) teamGrid.innerHTML = (team.items || []).map(item => {
      const avatar = item.image ? `<div class="team-avatar team-avatar-photo"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></div>` : `<div class="team-avatar">${escapeHtml(item.initials || '')}</div>`;
      return `<article class="team-card${item.founder ? ' founder-card' : ''}">${avatar}<h3>${escapeHtml(item.role)}</h3><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p></article>`;
    }).join('');

    // About
    setText('#hakkimizda .eyebrow', general.about?.eyebrow);
    setText('#hakkimizda h2', general.about?.title);
    const aboutPs = document.querySelectorAll('#hakkimizda .about-grid p');
    if (aboutPs[0]) aboutPs[0].textContent = general.about?.paragraph_1 || '';
    if (aboutPs[1]) aboutPs[1].textContent = general.about?.paragraph_2 || '';
    const pillRow = document.querySelector('#hakkimizda .pill-row');
    if (pillRow) pillRow.innerHTML = (general.about?.pills || []).map(pill => `<span>${escapeHtml(pill)}</span>`).join('');

    // Magazine
    setText('#dergi .eyebrow', magazine.eyebrow);
    const magTitle = document.querySelector('#dergi h2');
    if (magTitle) magTitle.innerHTML = `${escapeHtml(magazine.title_line_1 || '')}<br>${escapeHtml(magazine.title_line_2 || '')}`;
    setText('#dergi > div:first-of-type > p:not(.eyebrow)', magazine.description);
    setLink('#dergi .btn-light', magazine.button_text, magazine.button_link);
    setText('#dergi .magazine-cover strong', magazine.cover_title);
    setText('#dergi .magazine-cover small', magazine.cover_issue);
    setText('#dergi-sayilari .eyebrow', magazine.archive_eyebrow);
    setText('#dergi-sayilari h2', magazine.archive_title);
    const archiveGrid = document.querySelector('#dergi-sayilari .archive-grid');
    if (archiveGrid) { const issues = magazine.issues || []; archiveGrid.innerHTML = issues.map(issue => `<article class="archive-card">${issue.cover ? `<img class="content-card-cover" src="${escapeHtml(issue.cover)}" alt="${escapeHtml(issue.title)}">` : ''}<span>${escapeHtml(issue.number)}</span><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.text)}</p><a class="card-detail-link" href="${escapeHtml(issue.url || `/dergi/${issue.slug}/`)}">Dergiyi incele →</a>${issue.pdf ? `<a class="secondary-card-link" href="${escapeHtml(issue.pdf)}" target="_blank" rel="noopener">${escapeHtml(issue.link_text || "PDF'yi aç →")}</a>` : ''}</article>`).join(''); }

    // Application + contact
    setText('#basvuru .eyebrow', contact.application_eyebrow);
    setText('#basvuru h2', contact.application_title);
    setText('#basvuru .form-intro', contact.application_intro);
    setText('#iletisim .eyebrow', contact.contact_eyebrow);
    setText('#iletisim h2', contact.contact_title);
    const contactText = document.querySelector('#iletisim > p');
    if (contactText) contactText.textContent = contact.contact_text || '';
    const contactLinks = document.querySelectorAll('#iletisim .contact-links a');
    if (contactLinks[0]) { contactLinks[0].textContent = contact.email || ''; contactLinks[0].href = `mailto:${contact.email || ''}`; }
    if (contactLinks[1]) { contactLinks[1].textContent = `Instagram · ${contact.instagram_handle || ''}`; contactLinks[1].href = contact.instagram_url || '#'; }

    document.documentElement.classList.add('cms-content-loaded');
    observeReveals(); // CMS'ten gelen yeni kartları da gözleme al
  } catch (error) {
    console.warn('CMS içeriği yüklenemedi; HTML içeriği kullanılmaya devam ediyor.', error);
  }
}

hydrateCmsContent();

if (window.netlifyIdentity) {
  window.netlifyIdentity.on('init', user => {
    if (!user && window.location.hash.includes('invite_token')) window.netlifyIdentity.open('signup');
  });
}

// === EczaPlus premium interaction layer ===
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // Theme
  const themeToggle = $('#themeToggle');
  const storedTheme = localStorage.getItem('eczaplus-theme');
  if (storedTheme === 'dark' || (!storedTheme && matchMedia('(prefers-color-scheme: dark)').matches)) document.body.classList.add('dark');
  themeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('eczaplus-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });

  // Cursor spotlight + scroll progress
  addEventListener('pointermove', e => { document.documentElement.style.setProperty('--mx', `${e.clientX}px`); document.documentElement.style.setProperty('--my', `${e.clientY}px`); }, {passive:true});
  const scrollBar = $('.global-scroll-progress span');
  const updateScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (scrollBar) scrollBar.style.width = `${max > 0 ? Math.min(100, scrollY / max * 100) : 0}%`;
  };
  addEventListener('scroll', updateScroll, {passive:true}); updateScroll();

  // Main page content discovery
  const contentCards = $$('#contentGrid .editorial');
  if (contentCards.length) {
    const featured = $('#featuredContent');
    if (featured) {
      const [first, ...rest] = contentCards;
      const cardData = c => ({title:$('h3',c)?.textContent.trim()||'', summary:$('p',c)?.textContent.trim()||'', category:$('small',c)?.textContent.trim()||'İçerik', href:$('a',c)?.getAttribute('href')||'#', image:$('img',c)?.getAttribute('src')||''});
      const a = cardData(first);
      featured.innerHTML = `<article class="featured-primary">${a.image?`<img src="${a.image}" alt="">`:''}<span class="featured-kicker">${a.category}</span><h3>${a.title}</h3><p>${a.summary}</p><a href="${a.href}">İçeriği oku →</a></article><div class="featured-side">${rest.slice(0,2).map(c=>{const d=cardData(c);return `<article class="featured-mini">${d.image?`<img class="mini-thumb" src="${d.image}" alt="">`:''}<small>${d.category}</small><h3>${d.title}</h3><p>${d.summary}</p><a href="${d.href}">Oku →</a></article>`}).join('')}</div>`;
    }

    const cats=[...new Set(contentCards.map(c=>c.dataset.category).filter(Boolean))];
    const filters=$('#categoryFilters');
    cats.forEach(cat=>{const b=document.createElement('button');b.type='button';b.dataset.filter=cat;b.textContent=cat;filters?.appendChild(b)});
    let active='all'; const input=$('#contentSearch');
    const apply=()=>{const q=(input?.value||'').toLocaleLowerCase('tr-TR').trim();let shown=0;contentCards.forEach(c=>{const okCat=active==='all'||c.dataset.category===active;const okQ=!q||(c.dataset.search||'').includes(q);c.hidden=!(okCat&&okQ);if(!c.hidden)shown++});const n=$('#contentNoResults');if(n)n.hidden=shown!==0};
    filters?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;active=b.dataset.filter;$$('button',filters).forEach(x=>x.classList.toggle('active',x===b));apply()});
    input?.addEventListener('input',apply);

    const interviewCard=contentCards.find(c=>(c.dataset.category||'').toLocaleLowerCase('tr-TR').includes('röportaj') || (c.dataset.category||'').toLowerCase().includes('roportaj'));
    const show=$('#interviewShowcase');
    if(show && interviewCard){const d=cardData(interviewCard);show.innerHTML=`<article class="interview-main">${d.image?`<img src="${d.image}" alt="${d.title}">`:`<div class="team-avatar">3×3</div>`}<div><small>${d.category}</small><h3>${d.title}</h3><p>${d.summary}</p><a href="${d.href}">Röportajı oku →</a></div></article><article class="interview-quote"><span>ECZA+ / 3 SORU 3 CEVAP</span><blockquote>“Mesleğin farklı yollarını, o yolu yürüyenlerden dinliyoruz.”</blockquote><a href="${d.href}">Son röportaja git →</a></article>`;}
  }

  // Real stats from existing published cards
  const setNum=(id,n)=>{const el=$(id);if(el)el.textContent=n};
  setNum('#statContents',$$('#contentGrid .editorial').length);
  setNum('#statInterviews',$$('#contentGrid .editorial').filter(c=>(c.dataset.category||'').toLocaleLowerCase('tr-TR').includes('röportaj')).length);
  setNum('#statEvents',$$('#etkinlikler .cards > article').length);
  setNum('#statIssues',$$('#arsiv .archive-card').length);

  // Calendar / next event (uses current month, marks announcement dates if parseable)
  const calendar=$('#eventCalendar');
  if(calendar){
    const now=new Date(); const y=now.getFullYear(),m=now.getMonth();
    const mn=new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(now); $('#calendarMonth').textContent=mn[0].toLocaleUpperCase('tr-TR')+mn.slice(1);
    ['Pt','Sa','Ça','Pe','Cu','Ct','Pa'].forEach(x=>{const s=document.createElement('span');s.className='day-name';s.textContent=x;calendar.appendChild(s)});
    const first=(new Date(y,m,1).getDay()+6)%7, days=new Date(y,m+1,0).getDate();
    for(let i=0;i<first;i++){const s=document.createElement('span');s.className='muted-day';calendar.appendChild(s)}
    const marked=new Set([1,15,25]);
    for(let d=1;d<=days;d++){const s=document.createElement('span');s.textContent=d;if(marked.has(d))s.className='has-event';calendar.appendChild(s)}
  }
  // Choose next 1 Sep 19:00 local as demo from current published announcement, roll next year if passed
  const countdown=$('#eventCountdown');
  if(countdown){let target=new Date(new Date().getFullYear(),8,1,19,0,0);if(target<Date.now())target=new Date(new Date().getFullYear()+1,8,1,19,0,0);const tick=()=>{const diff=Math.max(0,target-Date.now()),days=Math.floor(diff/86400000),hours=Math.floor(diff/3600000)%24,mins=Math.floor(diff/60000)%60;const vals=[days,hours,mins];$$('strong',countdown).forEach((e,i)=>e.textContent=String(vals[i]).padStart(2,'0'));};tick();setInterval(tick,60000);$('#nextEventTitle').textContent='İlk Tanışma Toplantısı';$('#nextEventMeta').textContent='1 Eylül · 19.00 · Çevrim içi';}

  // Article enhancements
  if(document.body.classList.contains('article-page')){
    const body=$('.article-body'), sheet=$('.article-sheet');
    if(body && sheet){
      const words=body.textContent.trim().split(/\s+/).filter(Boolean).length; const mins=Math.max(1,Math.ceil(words/200));
      const meta=document.createElement('div');meta.className='article-meta-row';meta.innerHTML=`<span>${mins} dk okuma</span><span>${words} kelime</span>`;const summary=$('.article-summary');summary?.insertAdjacentElement('afterend',meta);
      const share=document.createElement('div');share.className='article-share';share.innerHTML=`<button type="button" data-share="native">Paylaş</button><a data-share="whatsapp" target="_blank" rel="noopener">WhatsApp</a><a data-share="linkedin" target="_blank" rel="noopener">LinkedIn</a><button type="button" data-share="copy">Linki kopyala</button>`;body.insertAdjacentElement('afterend',share);
      const url=encodeURIComponent(location.href),title=encodeURIComponent(document.title);$('[data-share="whatsapp"]',share).href=`https://wa.me/?text=${title}%20${url}`;$('[data-share="linkedin"]',share).href=`https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
      $('[data-share="native"]',share).onclick=()=>navigator.share?navigator.share({title:document.title,url:location.href}):navigator.clipboard.writeText(location.href);
      $('[data-share="copy"]',share).onclick=async e=>{await navigator.clipboard.writeText(location.href);e.currentTarget.textContent='Kopyalandı ✓'};
      const related=document.createElement('section');related.className='related-section';related.innerHTML='<p class="eyebrow">DEVAM ET</p><h2>Benzer içerikler</h2><div class="related-grid" id="relatedGrid"><span>İçerikler yükleniyor…</span></div>';sheet.appendChild(related);
      fetch('../../content/articles-index.json').then(r=>r.json()).then(data=>{const items=(data.items||[]).filter(x=>!location.pathname.includes(`/${x.slug}/`)).slice(0,3);const grid=$('#relatedGrid');grid.innerHTML=items.map(x=>`<a class="related-card" href="../${x.slug}/index.html"><small>${x.category||'İçerik'}</small><strong>${x.title}</strong><p>${x.summary||''}</p></a>`).join('')||'<span>Yakında yeni içerikler.</span>'}).catch(()=>{});
    }
  }

  // PWA registration
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();

// === EczaPlus Platform features: smart search, map, registrations, certificate, Instagram, flipbook, news ===
(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=(v='')=>String(v).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const load=async file=>{try{const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw 0;return await r.json()}catch(_){return null}};

  // SMART GLOBAL SEARCH
  const gInput=$('#globalSearch'), gResults=$('#globalSearchResults');
  let globalIndex=[];
  async function buildGlobalIndex(){
    const dom=[];
    $$('#contentGrid .editorial').forEach(c=>dom.push({type:'İçerik',title:$('h3',c)?.textContent||'',text:$('p',c)?.textContent||'',url:$('a',c)?.getAttribute('href')||'#'}));
    $$('#etkinlikler .cards .card').forEach(c=>dom.push({type:'Etkinlik',title:$('h3',c)?.textContent||'',text:$('p',c)?.textContent||'',url:$('a',c)?.getAttribute('href')||'#'}));
    $$('#duyurular .notice-card').forEach(c=>dom.push({type:'Duyuru',title:$('h3',c)?.textContent||'',text:$('p',c)?.textContent||'',url:$('a',c)?.getAttribute('href')||'#'}));
    $$('#arsiv .archive-card').forEach(c=>dom.push({type:'Dergi',title:$('h3',c)?.textContent||'',text:$('p',c)?.textContent||'',url:$('a',c)?.getAttribute('href')||'#'}));
    globalIndex=dom;
    const [articles,events,ann,mag,news]=await Promise.all([load('content/articles-index.json'),load('content/events.json'),load('content/announcements.json'),load('content/magazine.json'),load('content/news.json')]);
    const add=(items,type,urlFn)=>{(items||[]).forEach(x=>globalIndex.push({type,title:x.title||x.number||'',text:x.summary||x.text||x.detail||'',url:x.url ? (String(x.url).startsWith('.')?x.url:`./${x.url}`) : urlFn?.(x)||'#'}))};
    add(articles?.items,'İçerik',x=>`./icerikler/${x.slug}/index.html`); add(events?.items,'Etkinlik',x=>`./etkinlikler/${x.slug}/index.html`); add(ann?.items,'Duyuru',x=>`./duyurular/${x.slug}/index.html`); add(mag?.issues,'Dergi',x=>`./dergi/${x.slug}/index.html`); add(news?.items,'Haber',x=>x.url||'#');
    const seen=new Set(); globalIndex=globalIndex.filter(x=>{const k=`${x.type}|${x.title}`;if(seen.has(k))return false;seen.add(k);return true});
  }
  buildGlobalIndex();
  function renderSearch(){if(!gInput||!gResults)return;const q=norm(gInput.value.trim());if(q.length<2){gResults.innerHTML='<div class="search-empty">En az 2 harf yaz. İçerik, etkinlik, duyuru, haber ve dergi aynı anda aranır.</div>';return}const tokens=q.split(/\s+/);const hits=globalIndex.map(x=>({...x,hay:norm(`${x.type} ${x.title} ${x.text}`)})).filter(x=>tokens.every(t=>x.hay.includes(t))).slice(0,12);gResults.innerHTML=hits.length?hits.map(x=>`<a class="global-result" href="${esc(x.url)}"><small>${esc(x.type)}</small><strong>${esc(x.title)}</strong><p>${esc(x.text).slice(0,150)}${String(x.text).length>150?'…':''}</p></a>`).join(''):'<div class="search-empty">Bu aramayla eşleşen sonuç bulunamadı.</div>'}
  gInput?.addEventListener('input',renderSearch); $$('.smart-search-hints button').forEach(b=>b.addEventListener('click',()=>{gInput.value=b.textContent;gInput.focus();renderSearch()}));

  // NEWS BOARD — only automated external news sources.
  async function initNews(){const grid=$('#newsGrid'),ticker=$('#newsTickerText');if(!grid)return;grid.innerHTML='<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';const news=await load('content/news.json');const items=[...(news?.items||[])].sort((a,b)=>parseFeedDate(b.published_at||b.date)-parseFeedDate(a.published_at||a.date));if(!items.length){if(ticker)ticker.textContent='Haber akışı ilk güncellemesini bekliyor';grid.innerHTML='<p class="search-empty"><strong>Haber akışı hazırlanıyor</strong><span>Haber kaynakları kontrol edildiğinde burada otomatik görünecek.</span></p>';return}if(ticker)ticker.textContent=items[0].title||'';grid.innerHTML=items.slice(0,6).map(x=>`<article class="news-card"><div class="news-card-meta"><small>${esc(x.date||'GÜNCEL')}</small>${x.category?`<span class="news-category">${esc(x.category)}</span>`:''}</div><h3>${esc(x.title||'')}</h3>${x.text?`<p>${esc(x.text)}</p>`:''}<div class="news-card-foot">${x.source?`<span class="news-source">${esc(x.source)}</span>`:''}${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Haberi kaynağında aç →</a>`:''}</div></article>`).join('')}
  initNews();

  // UNIVERSITY REPRESENTATIVES MAP
  async function initReps(){
    const repListLoading=$('#repList');
    if(repListLoading) repListLoading.innerHTML='<div class="skeleton-line"></div><div class="skeleton-line short"></div>';

    const fallbackPharmacyCities=[{"city":"Adana","x":50.6,"y":76.5,"universities":["Çukurova Üniversitesi"]},{"city":"Adıyaman","x":64.8,"y":66.3,"universities":["Adıyaman Üniversitesi"]},{"city":"Afyonkarahisar","x":27.5,"y":53.2,"universities":["Afyonkarahisar Sağlık Bilimleri Üniversitesi"]},{"city":"Ankara","x":38.7,"y":37.7,"universities":["Hacettepe Üniversitesi","Ankara Üniversitesi","Gazi Üniversitesi","Başkent Üniversitesi","Ankara Medipol Üniversitesi","Sağlık Bilimleri Üniversitesi (Gülhane Eczacılık Fakültesi)","Lokman Hekim Üniversitesi"]},{"city":"Ağrı","x":87.8,"y":40.5,"universities":["Ağrı İbrahim Çeçen Üniversitesi"]},{"city":"Diyarbakır","x":74.2,"y":64.4,"universities":["Dicle Üniversitesi"]},{"city":"Düzce","x":30.5,"y":25.6,"universities":["Düzce Üniversitesi"]},{"city":"Edirne","x":8.4,"y":14.6,"universities":["Trakya Üniversitesi"]},{"city":"Elazığ","x":69.4,"y":54.3,"universities":["Fırat Üniversitesi"]},{"city":"Erzincan","x":70.7,"y":40.1,"universities":["Erzincan Binali Yıldırım Üniversitesi"]},{"city":"Erzurum","x":79.2,"y":38.0,"universities":["Atatürk Üniversitesi"]},{"city":"Eskişehir","x":27.5,"y":39.7,"universities":["Anadolu Üniversitesi"]},{"city":"Isparta","x":27.6,"y":66.3,"universities":["Süleyman Demirel Üniversitesi"]},{"city":"Kayseri","x":51.4,"y":53.7,"universities":["Erciyes Üniversitesi"]},{"city":"Kocaeli","x":24.7,"y":26.6,"universities":["Kocaeli Sağlık ve Teknoloji Üniversitesi"]},{"city":"Konya","x":37.0,"y":64.9,"universities":["Selçuk Üniversitesi"]},{"city":"Malatya","x":65.0,"y":58.5,"universities":["İnönü Üniversitesi"]},{"city":"Mersin","x":47.3,"y":78.9,"universities":["Mersin Üniversitesi"]},{"city":"Samsun","x":55.4,"y":19.7,"universities":["Ondokuz Mayıs Üniversitesi"]},{"city":"Sivas","x":58.7,"y":40.1,"universities":["Sivas Cumhuriyet Üniversitesi"]},{"city":"Tokat","x":56.5,"y":32.6,"universities":["Tokat Gaziosmanpaşa Üniversitesi"]},{"city":"Trabzon","x":71.8,"y":23.5,"universities":["Karadeniz Teknik Üniversitesi"]},{"city":"Van","x":89.4,"y":56.6,"universities":["Van Yüzüncü Yıl Üniversitesi"]},{"city":"Zonguldak","x":33.6,"y":17.5,"universities":["Zonguldak Bülent Ecevit Üniversitesi"]},{"city":"İstanbul","x":20.0,"y":23.4,"universities":["Acıbadem Mehmet Ali Aydınlar Üniversitesi","Yeditepe Üniversitesi","İstanbul Üniversitesi","Bahçeşehir Üniversitesi","İstanbul Medipol Üniversitesi","Marmara Üniversitesi","İstanbul Üniversitesi-Cerrahpaşa","Bezmialem Vakıf Üniversitesi","İstanbul Aydın Üniversitesi","Biruni Üniversitesi","İstinye Üniversitesi","Altınbaş Üniversitesi","İstanbul Sağlık ve Teknoloji Üniversitesi","İstanbul Okan Üniversitesi","İstanbul Kent Üniversitesi","Fenerbahçe Üniversitesi","İstanbul Yeni Yüzyıl Üniversitesi","Sağlık Bilimleri Üniversitesi (Hamidiye Eczacılık Fakültesi)"]},{"city":"İzmir","x":11.2,"y":57.6,"universities":["Ege Üniversitesi","İzmir Katip Çelebi Üniversitesi"]},{"city":"Şanlıurfa","x":67.3,"y":74.2,"universities":["Harran Üniversitesi"]}];

    const data=await load('content/university-reps.json');
    const raw=data?.items||[];

    // "universities" alanı olan kayıtlar şehir/fakülte kataloğu,
    // name + university alanı olan kayıtlar ise gerçek aktif temsilci olarak kabul edilir.
    const catalogRaw=raw.filter(x=>Array.isArray(x.universities)&&x.universities.length);
    const repRaw=raw.filter(x=>x.name&&x.university);

    const catalog=(catalogRaw.length?catalogRaw:fallbackPharmacyCities).map(item=>({
      ...item,
      universities:Array.isArray(item.universities)?item.universities:[],
      x:Number(item.x||50),
      y:Number(item.y||50)
    })).sort((a,b)=>String(a.city||'').localeCompare(String(b.city||''),'tr'));

    const normalize=s=>String(s||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();
    const repMap=new Map();
    repRaw.forEach(rep=>{
      const key=normalize(rep.university);
      if(!key)return;
      repMap.set(key,{
        name:rep.name,
        role:rep.role||'Üniversite Temsilcisi',
        city:rep.city||'',
        image:rep.image||''
      });
    });

    const cities=catalog.map(city=>({
      ...city,
      universityRows:city.universities.map(name=>{
        const rep=repMap.get(normalize(name));
        return {name, represented:!!rep, rep};
      })
    }));

    const markers=$('#mapMarkers'), list=$('#repList'), count=$('#repCount'), empty=$('#mapEmpty');
    const select=$('#repCitySelect'), apply=$('#repApplyBtn'), panelApply=$('#repPanelApply');
    const cityCard=$('#mapCityCard'), cityMeta=$('#mapCityMeta'), cityTitle=$('#mapCityTitle'), cityText=$('#mapCityText'), cityUniversities=$('#mapCityUniversities');

    if(count) count.textContent=String(repRaw.length);
    if(empty) empty.hidden=true;

    const renderUniversityRow=row=>{
      const repText=row.represented
        ? `<span class="uni-rep-person">${esc(row.rep?.name||'Ecza+ temsilcisi')}</span>`
        : `<span class="uni-rep-cta">Temsilci başvurusu açık</span>`;
      return `<li class="uni-status-row ${row.represented?'has-rep':'no-rep'}">
        <div class="uni-status-main">
          <strong>${esc(row.name)}</strong>
          ${repText}
        </div>
        <span class="uni-status-badge ${row.represented?'is-active':'is-empty'}">
          <i></i>${row.represented?'Temsilci var':'Temsilci yok'}
        </span>
      </li>`;
    };

    const cardHtml=city=>{
      const active=city.universityRows.filter(x=>x.represented).length;
      return `<article class="rep-item" data-rep-card="${esc(city.city||'')}">
        <div class="rep-item-head">
          <div>
            <strong>${esc(city.city||'')}</strong>
            <small>${city.universityRows.length} eczacılık programı</small>
          </div>
          <span class="city-rep-summary ${active?'has-active':'no-active'}">${active ? `${active} temsilcili` : 'Henüz temsilci yok'}</span>
        </div>
        <ul class="rep-universities rep-university-status-list">
          ${city.universityRows.map(renderUniversityRow).join('')}
        </ul>
      </article>`;
    };

    if(list) list.innerHTML=cities.map(cardHtml).join('');

    if(markers) markers.innerHTML=cities.map((city,index)=>{
      const active=city.universityRows.some(x=>x.represented);
      const size=Math.min(32,16+(city.universityRows.length*1.15));
      return `<button class="map-marker ${active?'has-representative':'no-representative'}" style="--x:${city.x}%;--y:${city.y}%;--size:${size}px" data-city="${esc(city.city||'')}" data-rep-index="${index}" aria-label="${esc(city.city||'Şehir')}: ${active?'aktif temsilci var':'temsilci yok'}">
        <span class="map-marker-pulse"></span><span class="map-marker-core"></span><span class="map-marker-count">${city.universityRows.length}</span>
      </button>`;
    }).join('');

    function highlight(city, shouldScroll=true){
      if(!city)return;
      markers?.querySelectorAll('.map-marker').forEach(el=>el.classList.toggle('active',el.dataset.city===city.city));
      list?.querySelectorAll('.rep-item').forEach(el=>el.classList.toggle('active',el.dataset.repCard===city.city));
      const activeCard=list?.querySelector(`[data-rep-card="${CSS.escape(city.city)}"]`);
      if(shouldScroll) activeCard?.scrollIntoView({block:'nearest',behavior:'smooth'});

      const activeCount=city.universityRows.filter(x=>x.represented).length;
      if(cityCard&&cityMeta&&cityTitle&&cityText&&cityUniversities){
        cityCard.hidden=false;
        cityMeta.textContent=`${city.universityRows.length} üniversite · ${activeCount} aktif temsilcilik`;
        cityTitle.textContent=city.city||'Şehir';
        cityText.textContent=activeCount
          ? 'Yeşil etiketli üniversitelerde aktif Ecza+ temsilcisi bulunuyor.'
          : 'Bu şehirde henüz aktif Ecza+ üniversite temsilcisi bulunmuyor.';
        cityUniversities.innerHTML=city.universityRows.map(renderUniversityRow).join('');
      }
      if(select) select.value=city.city||'';
    }

    markers?.addEventListener('click',e=>{
      const button=e.target.closest('.map-marker');
      if(!button)return;
      highlight(cities[Number(button.dataset.repIndex)]);
    });
    list?.addEventListener('click',e=>{
      const card=e.target.closest('.rep-item');
      if(!card)return;
      highlight(cities.find(x=>x.city===card.dataset.repCard));
    });

    if(select) select.innerHTML='<option value="">Şehir seç</option>'+cities.map(x=>`<option value="${esc(x.city)}">${esc(x.city)}</option>`).join('');

    const goApply=(city='')=>{
      const form=$('#applicationForm'),team=form?.querySelector('[name="team"]'),cityInput=$('#applicationCity');
      if(team)team.value='Üniversite Temsilciliği';
      if(cityInput&&city)cityInput.value=city;
      form?.scrollIntoView({behavior:'smooth',block:'start'});
      setTimeout(()=>form?.querySelector('[name="university"]')?.focus(),500);
      if(typeof showToast==='function')showToast(city?`${city} için temsilcilik başvurusu seçildi.`:'Üniversite temsilciliği başvurusu seçildi.','success');
    };
    apply?.addEventListener('click',()=>{
      if(!select?.value){
        if(typeof showToast==='function')showToast('Önce temsilcilik için bir şehir seç.','info');
        select?.focus();
        return;
      }
      goApply(select.value);
    });
    panelApply?.addEventListener('click',e=>{e.preventDefault();goApply(select?.value||'')});

    if(cities.length)highlight(cities.find(x=>x.city==='Ankara')||cities[0], false);
  }
  initReps();

  // INSTAGRAM: CMS URLs + optional uploaded thumbnails. No token required.
  async function initInstagram(){const grid=$('#instagramGrid');if(!grid)return;grid.innerHTML='<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';const data=await load('content/instagram.json');const items=[...(data?.items||[])].sort((a,b)=>(Date.parse(b.timestamp||'')||0)-(Date.parse(a.timestamp||'')||0));if(!items.length){grid.innerHTML=`<article class="instagram-placeholder"><span>◎</span><h3>Instagram gönderileri hazırlanıyor</h3><p>Otomatik bağlantı kurulana kadar gönderileri Pages CMS → Instagram bölümünden ekleyebilirsin.</p><a href="${esc(data?.profile_url||'https://www.instagram.com/ecz.plus/')}" target="_blank" rel="noopener">@ecz.plus profilini aç →</a></article>`;return}grid.innerHTML=items.slice(0,6).map(x=>x.embed===true&&x.url?`<blockquote class="instagram-media" data-instgrm-permalink="${esc(x.url)}" data-instgrm-version="14"></blockquote>`:`<article class="instagram-card">${x.image?`<a class="instagram-image-link" href="${esc(x.url||data.profile_url)}" target="_blank" rel="noopener"><img src="${esc(x.image)}" alt="EczaPlus Instagram gönderisi" loading="lazy"></a>`:''}<small>INSTAGRAM</small><p>${esc(x.caption||'EczaPlus Instagram gönderisi')}</p><a href="${esc(x.url||data.profile_url||'https://www.instagram.com/ecz.plus/')}" target="_blank" rel="noopener">Gönderiyi aç →</a></article>`).join('');setTimeout(()=>window.instgrm?.Embeds?.process?.(),100)}
  initInstagram();

  // EVENT REGISTRATION + shared Supabase database + local fallback + email notification
  const getEventModal=()=>$('#eventRegistrationModal'), getEventForm=()=>$('#eventRegistrationForm'), getEventStatus=()=>$('#eventRegistrationStatus'); let currentEvent={};
  const registrations=()=>{try{return JSON.parse(localStorage.getItem('eczaplus-event-registrations')||'[]')}catch(_){return[]}};
  const saveRegs=x=>localStorage.setItem('eczaplus-event-registrations',JSON.stringify(x));
  const notify=(msg,type='success',title='EczaPlus')=>window.eczaToast?.(msg,type,title);
  let _supabaseClient;
  function sharedDb(){
    const cfg=window.ECZAPLUS_SUPABASE||{};
    if(!cfg.url||!cfg.anonKey||!window.supabase?.createClient)return null;
    if(!_supabaseClient)_supabaseClient=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    return _supabaseClient;
  }
  function setDbStatus(mode='checking'){
    const el=$('#liveDbStatus'); if(!el)return;
    const text=$('span:last-child',el);
    el.dataset.mode=mode;
    if(text) text.textContent = mode==='live' ? 'Canlı kontenjan · tüm cihazlar ortak' : mode==='fallback' ? 'Yerel mod · veritabanı henüz bağlı değil' : 'Canlı kayıt sistemi kontrol ediliyor…';
  }
  function renderMyRegs(){const box=$('#myRegistrationsList');if(!box)return;const regs=registrations();box.innerHTML=regs.length?regs.map((r,i)=>`<div class="registration-chip"><span><strong>${esc(r.eventTitle)}</strong><small>${esc(r.name)} · ${new Date(r.createdAt).toLocaleDateString('tr-TR')}</small></span>${r.certificateEnabled?`<button class="certificate-btn" type="button" data-cert-index="${i}">PDF Sertifika</button>`:''}</div>`).join(''):'<p class="search-empty">Bu cihazda kayıt yok.</p>'}
  function setSubmitAvailability(count){const f=getEventForm(),b=f?.querySelector('button[type="submit"]');if(!b)return;const full=Number.isFinite(count)&&count>=currentEvent.capacity;b.disabled=full;b.dataset.full=full?'true':'false';if(full)b.textContent='Kontenjan Doldu';else if(b.textContent==='Kontenjan Doldu')b.textContent='Kaydı Tamamla →';}
  function renderCapacityText(localUsed,shared){const capTxt=$('#eventCapacityText');if(!capTxt)return;if(shared==null){const remain=Math.max(0,currentEvent.capacity-localUsed);capTxt.textContent=`${remain} / ${currentEvent.capacity}`;setSubmitAvailability(null);setDbStatus('fallback');}else{capTxt.textContent=`${Math.max(0,currentEvent.capacity-shared)} / ${currentEvent.capacity} kontenjan kaldı`;setSubmitAvailability(shared);setDbStatus('live');}}
  async function fetchSharedCount(slug){
    const db=sharedDb();
    if(db){try{const {data,error}=await db.rpc('get_event_count',{p_slug:slug});if(error)throw error;return Number(data||0)}catch(err){console.warn('EczaPlus DB count fallback:',err)}}
    try{const r=await fetch(`./api/count?slug=${encodeURIComponent(slug)}`);if(!r.ok)return null;const d=await r.json();return (d&&d.ok&&typeof d.count==='number')?d.count:null}catch(_){return null}
  }
  async function registerShared(reg,capacity){
    const db=sharedDb();
    if(!db)return null;
    const {data,error}=await db.rpc('register_for_event',{
      p_slug:reg.slug,p_title:reg.eventTitle,p_email:reg.email,p_full_name:reg.name,p_university:reg.university,p_class_name:reg.className,p_capacity:capacity
    });
    if(error)throw error;
    return data;
  }
  function openEvent(btn){currentEvent={slug:btn.dataset.eventSlug||'',title:btn.dataset.eventTitle||'Etkinlik',capacity:Number(btn.dataset.capacity||50),certificateEnabled:btn.dataset.certificate==='true'};$('#eventModalTitle').textContent=currentEvent.title;$('#registrationEventName').value=currentEvent.title;$('#registrationEventSlug').value=currentEvent.slug;const used=registrations().filter(x=>x.slug===currentEvent.slug).length;setDbStatus('checking');renderCapacityText(used,null);const modal=getEventModal();modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderMyRegs();fetchSharedCount(currentEvent.slug).then(shared=>{if(currentEvent.slug===btn.dataset.eventSlug)renderCapacityText(used,shared)})}
  document.addEventListener('click',e=>{const b=e.target.closest('.event-register-btn');if(b)openEvent(b);if(e.target.closest('[data-close-event-modal]')){const modal=getEventModal();modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');document.body.style.overflow=''};const cert=e.target.closest('.certificate-btn');if(cert)generateCertificate(registrations()[Number(cert.dataset.certIndex)])});
  $('#openFirstEventRegistration')?.addEventListener('click',()=>{const b=$('.event-register-btn');if(b)openEvent(b)});
  const eventForm=getEventForm(); const eventStatus=getEventStatus();
  eventForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(eventForm),name=fd.get('Ad_Soyad')||'';
    const reg={slug:currentEvent.slug,eventTitle:currentEvent.title,name:String(name).trim(),email:String(fd.get('Eposta')||'').trim().toLowerCase(),university:String(fd.get('Universite')||'').trim(),className:String(fd.get('Sinif')||''),certificateEnabled:currentEvent.certificateEnabled,createdAt:new Date().toISOString()};
    const regs=registrations();
    if(regs.some(x=>x.slug===reg.slug&&String(x.email).toLowerCase()===reg.email)){eventStatus.textContent='Bu e-posta ile bu etkinliğe daha önce kayıt yapılmış.';notify('Bu e-posta ile bu etkinliğe zaten kayıt yapılmış.','info');return}
    const btn=$('button[type="submit"]',eventForm);btn.disabled=true;btn.textContent='Kaydediliyor…';
    let sharedResult=null, dbSucceeded=false;
    try{
      if(sharedDb()){
        sharedResult=await registerShared(reg,currentEvent.capacity);
        if(sharedResult?.ok===false&&sharedResult.code==='duplicate'){eventStatus.textContent='Bu e-posta ile bu etkinliğe daha önce kayıt yapılmış.';notify('Bu e-posta ile zaten kayıtlısın.','info');return}
        if(sharedResult?.ok===false&&sharedResult.code==='full'){eventStatus.textContent='Bu etkinliğin kontenjanı doldu.';renderCapacityText(regs.filter(x=>x.slug===reg.slug).length,Number(sharedResult.count||currentEvent.capacity));notify('Bu etkinliğin kontenjanı doldu.','error','Kayıt alınamadı');return}
        if(!sharedResult?.ok)throw new Error('Veritabanı kaydı tamamlanamadı');
        dbSucceeded=true;
      }

      // Veritabanı ayarlı değilse eski e-posta akışı ana kayıt kanalı olarak kalır.
      if(!dbSucceeded){
        const r=await fetch('https://formsubmit.co/ajax/eczaplus0@gmail.com',{method:'POST',headers:{Accept:'application/json'},body:fd});
        if(!r.ok)throw new Error('E-posta servisi başarısız');
      } else {
        // DB başarılıysa e-posta sadece bildirim amaçlıdır; başarısız olması kaydı bozmaz.
        fetch('https://formsubmit.co/ajax/eczaplus0@gmail.com',{method:'POST',headers:{Accept:'application/json'},body:fd}).catch(()=>{});
      }

      regs.push(reg);saveRegs(regs);
      eventStatus.textContent=dbSucceeded?'Kaydın alındı ✓ Canlı kontenjana işlendi.':'Kaydın alındı ✓ EczaPlus ekibine iletildi.';
      notify(dbSucceeded?'Kaydın canlı sisteme işlendi.':'Kaydın başarıyla alındı.','success');
      eventForm.reset();$('#registrationEventName').value=currentEvent.title;$('#registrationEventSlug').value=currentEvent.slug;renderMyRegs();
      if(dbSucceeded&&typeof sharedResult?.count==='number')renderCapacityText(regs.filter(x=>x.slug===currentEvent.slug).length,Number(sharedResult.count));
      else fetch('./api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:reg.slug,email:reg.email,capacity:currentEvent.capacity})}).then(rr=>rr.json()).then(d=>{if(d&&d.ok&&typeof d.count==='number')renderCapacityText(regs.filter(x=>x.slug===currentEvent.slug).length,d.count)}).catch(()=>{});
    }catch(err){
      console.warn('EczaPlus registration error:',err);
      eventStatus.textContent='Kayıt şu an tamamlanamadı. İnternet bağlantını ve veritabanı ayarlarını kontrol et.';
      notify('Kayıt tamamlanamadı. Lütfen tekrar dene.','error','Bağlantı sorunu');
    }finally{if(btn.dataset.full!=='true'){btn.disabled=false;btn.textContent='Kaydı Tamamla →'}}
  });
  async function refreshEventCardCounts(){
    const buttons=$$('.event-register-btn');
    await Promise.all(buttons.map(async btn=>{
      const slug=btn.dataset.eventSlug||'',cap=Number(btn.dataset.capacity||50); if(!slug)return;
      let line=btn.parentElement?.querySelector('.event-live-count');
      if(!line){line=document.createElement('small');line.className='event-live-count';btn.insertAdjacentElement('afterend',line)}
      const count=await fetchSharedCount(slug);
      if(count==null){line.textContent=sharedDb()?'Canlı kontenjan yüklenemedi':'Canlı veritabanı bağlandığında ortak kontenjan görünür';line.dataset.mode='fallback';return}
      const left=Math.max(0,cap-count);line.textContent=`${left} kontenjan kaldı · canlı`;line.dataset.mode='live';
      if(left<=0){btn.disabled=true;btn.textContent='Kontenjan Doldu'}
    }));
  }
  renderMyRegs();
  refreshEventCardCounts();

  function generateCertificate(reg){if(!reg)return;const jsPDF=window.jspdf?.jsPDF;if(!jsPDF){alert('PDF modülü yüklenemedi. Sayfayı internet bağlantısıyla yeniden aç.');return}const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});const W=297,H=210;doc.setFillColor(246,244,237);doc.rect(0,0,W,H,'F');doc.setDrawColor(62,88,72);doc.setLineWidth(1.3);doc.rect(10,10,W-20,H-20);doc.setDrawColor(180,176,165);doc.setLineWidth(.35);doc.rect(15,15,W-30,H-30);doc.setTextColor(36,39,34);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('ECZAPLUS',W/2,35,{align:'center'});doc.setFontSize(10);doc.setTextColor(85,105,91);doc.text('ECZACILIK TOPLULUGU',W/2,43,{align:'center'});doc.setTextColor(36,39,34);doc.setFont('helvetica','normal');doc.setFontSize(13);doc.text('KATILIM SERTIFIKASI',W/2,67,{align:'center'});doc.setFont('helvetica','bold');doc.setFontSize(26);doc.text(String(reg.name||'Katilimci').replace(/[ğĞüÜşŞıİöÖçÇ]/g,c=>({'ğ':'g','Ğ':'G','ü':'u','Ü':'U','ş':'s','Ş':'S','ı':'i','İ':'I','ö':'o','Ö':'O','ç':'c','Ç':'C'}[c])),W/2,93,{align:'center'});doc.setFont('helvetica','normal');doc.setFontSize(13);doc.text('EczaPlus tarafindan duzenlenen',W/2,112,{align:'center'});doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(String(reg.eventTitle||'Etkinlik'),W/2,126,{align:'center',maxWidth:230});doc.setFont('helvetica','normal');doc.setFontSize(12);doc.text('etkinligine katilimi dolayisiyla bu belgeyi almaya hak kazanmistir.',W/2,141,{align:'center'});doc.setFontSize(10);doc.setTextColor(95,95,90);doc.text(new Date().toLocaleDateString('tr-TR'),34,174);doc.text('EczaPlus Eczacilik Toplulugu',W-34,174,{align:'right'});doc.save(`EczaPlus-Sertifika-${norm(reg.name).replace(/[^a-z0-9]+/g,'-')}.pdf`)}

  // FLIPBOOK: dergi sayısı yoksa gizlenir
  async function initFlipbook(){
    const book=$('#flipbook');
    if(!book) return;
    const data=await load('content/magazine.json');
    const issues=data?.issues||[];
    if(!issues.length){ $('#flipbookShell')?.remove(); return; }
    const issue=issues[0]||{};
    const pages=(issue.pages||[]).filter(Boolean).map((src,i)=>({image:src,title:`${issue.number||'Dergi'} · ${i+1}. sayfa`}));
    if(!pages.length){ $('#flipbookShell')?.remove(); return; }
    const counter=$('#flipCounter');
    book.innerHTML=pages.map((p,i)=>`<article class="flip-page ${i===0?'active':''}"><img src="${esc(p.image)}" alt="${esc(p.title)}"><div class="page-overlay"><small>ECZA+ DERGİ</small><h3>${esc(p.title)}</h3></div></article>`).join('');
    let idx=0;
    const update=()=>{ $$('.flip-page',book).forEach((page,i)=>{page.classList.toggle('active',i===idx);page.classList.toggle('prev',i<idx)}); if(counter) counter.textContent=`${idx+1} / ${pages.length}`; };
    $('#flipPrev')?.addEventListener('click',()=>{idx=(idx-1+pages.length)%pages.length;update()});
    $('#flipNext')?.addEventListener('click',()=>{idx=(idx+1)%pages.length;update()});
    update();
  }
  initFlipbook();
})();

// === EczaPlus v3: event filters, monthly calendar and toast notifications ===
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // Toast API (works on every page, container is created when missing)
  function showToast(message, type='success', title='EczaPlus') {
    let stack = $('#toastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toastStack';
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live','polite');
      document.body.appendChild(stack);
    }
    const icons = {success:'✓', error:'!', info:'i'};
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon">${icons[type] || 'i'}</div><div class="toast-copy"><strong>${title}</strong><span>${message}</span></div>`;
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const remove = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 260); };
    const timer = setTimeout(remove, 3600);
    toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
    return toast;
  }
  window.eczaToast = showToast;

  // Turn existing status texts into elegant toast feedback without changing forms.
  const watchStatus = (selector) => {
    const el = $(selector); if (!el) return;
    let previous = el.textContent.trim();
    new MutationObserver(() => {
      const text = el.textContent.trim();
      if (!text || text === previous) return;
      previous = text;
      if (/gönderildi|alındı|hoş geldin|başar/i.test(text)) showToast(text, 'success');
      else if (/hata|gönderilemedi|işaretlemelisin|kontrol et|daha önce/i.test(text)) showToast(text, 'error', 'İşlem tamamlanamadı');
    }).observe(el, {childList:true, subtree:true, characterData:true});
  };
  watchStatus('#formStatus');
  watchStatus('#eventRegistrationStatus');

  // Share/copy feedback on article pages.
  document.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-share="copy"]');
    if (copy) setTimeout(() => showToast('İçerik bağlantısı panoya kopyalandı.', 'success', 'Link kopyalandı'), 80);
    const cert = e.target.closest('.certificate-btn');
    if (cert) setTimeout(() => showToast('Sertifika PDF dosyası hazırlanıyor.', 'info', 'Sertifika'), 80);
  });

  const grid = $('#eventsGrid') || $('#etkinlikler .cards');
  const toolbar = $('#eventToolbar');
  const calendar = $('#eventCalendar');
  if (!grid && !calendar) return;

  let eventData = [];
  let activeFilter = 'all';
  let viewDate = new Date();

  const parseDate = v => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const statusOf = item => {
    const explicit = String(item.status || '').toLowerCase();
    if (['past','open','upcoming'].includes(explicit)) return explicit;
    const d = parseDate(item.date);
    if (d && dayStart(d) < dayStart(new Date())) return 'past';
    if (item.registration_open !== false) return 'open';
    return 'upcoming';
  };
  const statusLabel = s => ({open:'Kayıt Açık', upcoming:'Yaklaşan', past:'Geçmiş'}[s] || 'Etkinlik');
  const dateLabel = d => d ? new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d) : 'Tarih yakında';

  function annotateCards() {
    if (!grid) return;
    const cards = $$('.card', grid);
    cards.forEach((card, index) => {
      const btn = $('.event-register-btn', card);
      const href = $('.card-detail-link', card)?.getAttribute('href') || '';
      const slug = btn?.dataset.eventSlug || (href.match(/etkinlikler\/([^/]+)/)||[])[1] || '';
      const title = $('h3', card)?.textContent.trim() || '';
      const item = eventData.find(x => x.slug === slug) || eventData.find(x => x.title === title) || eventData[index] || {};
      const st = statusOf(item);
      card.dataset.eventStatus = st;
      if (!$('.event-status-badge', card)) {
        const badge = document.createElement('span');
        badge.className = `event-status-badge ${st}`;
        badge.textContent = statusLabel(st);
        const h3 = $('h3', card);
        card.insertBefore(badge, h3 || card.firstChild);
      } else {
        const badge = $('.event-status-badge', card);
        badge.className = `event-status-badge ${st}`;
        badge.textContent = statusLabel(st);
      }
      const d = parseDate(item.date);
      let line = $('.event-date-line', card);
      if (d) {
        if (!line) { line=document.createElement('small'); line.className='event-date-line'; $('h3',card)?.insertAdjacentElement('afterend',line); }
        line.textContent = dateLabel(d);
      }
      if (btn && (st === 'past' || item.registration_open === false)) {
        btn.disabled = true;
        btn.textContent = st === 'past' ? 'Etkinlik Tamamlandı' : 'Kayıt Kapalı';
      }
    });
    applyFilter();
  }

  function applyFilter() {
    if (!grid) return;
    let shown = 0;
    $$('.card', grid).forEach(card => {
      const st = card.dataset.eventStatus || 'upcoming';
      const visible = activeFilter === 'all' || st === activeFilter || (activeFilter === 'upcoming' && st === 'open');
      card.hidden = !visible;
      if (visible) shown++;
    });
    let empty = $('#eventFilterEmpty');
    if (!shown) {
      if (!empty) { empty=document.createElement('div'); empty.id='eventFilterEmpty'; empty.className='event-filter-empty'; grid.insertAdjacentElement('afterend',empty); }
      empty.textContent = activeFilter === 'past' ? 'Henüz geçmiş etkinlik bulunmuyor.' : 'Bu filtrede etkinlik bulunmuyor.';
      empty.hidden = false;
    } else if (empty) empty.hidden = true;
  }

  toolbar?.addEventListener('click', e => {
    const b = e.target.closest('[data-event-filter]'); if (!b) return;
    activeFilter = b.dataset.eventFilter;
    $$('[data-event-filter]', toolbar).forEach(x => x.classList.toggle('active', x===b));
    applyFilter();
    showToast(`${b.textContent.trim()} etkinlikleri gösteriliyor.`, 'info', 'Etkinlik filtresi');
  });

  function renderCalendar() {
    if (!calendar) return;
    calendar.innerHTML = '';
    const y=viewDate.getFullYear(), m=viewDate.getMonth();
    const monthTitle = new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(viewDate);
    const titleEl=$('#calendarMonth'); if(titleEl) titleEl.textContent=monthTitle.charAt(0).toLocaleUpperCase('tr-TR')+monthTitle.slice(1);
    ['Pt','Sa','Ça','Pe','Cu','Ct','Pa'].forEach(x=>{const s=document.createElement('span');s.className='day-name';s.textContent=x;calendar.appendChild(s)});
    const first=(new Date(y,m,1).getDay()+6)%7;
    const days=new Date(y,m+1,0).getDate();
    for(let i=0;i<first;i++){const s=document.createElement('span');s.className='muted-day';calendar.appendChild(s)}
    const byDay = new Map();
    eventData.forEach(item => { const d=parseDate(item.date); if(d && d.getFullYear()===y && d.getMonth()===m){ const arr=byDay.get(d.getDate())||[]; arr.push(item); byDay.set(d.getDate(),arr); } });
    const now=new Date();
    for(let day=1;day<=days;day++){
      const events=byDay.get(day)||[];
      const el=document.createElement(events.length?'button':'span');
      if(events.length) el.type='button';
      el.className='calendar-day'+(events.length?' has-event':'')+(now.getFullYear()===y&&now.getMonth()===m&&now.getDate()===day?' today':'');
      el.textContent=day;
      if(events.length){
        el.setAttribute('aria-label',`${day} ${monthTitle}: ${events.map(x=>x.title).join(', ')}`);
        el.addEventListener('click',()=>showCalendarEvents(events));
      }
      calendar.appendChild(el);
    }
    const list=$('#calendarEventList');
    const monthEvents=eventData.filter(item=>{const d=parseDate(item.date);return d&&d.getFullYear()===y&&d.getMonth()===m});
    if(list && !monthEvents.length) list.innerHTML='<small>Bu ay için planlanmış etkinlik bulunmuyor.</small>';
    else if(list && monthEvents.length) list.innerHTML=`<small>Bu ay ${monthEvents.length} etkinlik var. Yeşil günlerden birine dokun.</small>`;
  }
  function showCalendarEvents(items){
    const list=$('#calendarEventList'); if(!list) return;
    list.innerHTML=items.map(item=>{const d=parseDate(item.date);const url=item.url||`./etkinlikler/${item.slug}/index.html`;return `<div class="calendar-event-item"><span><strong>${item.title}</strong><small>${dateLabel(d)} · ${statusLabel(statusOf(item))}</small></span><a href="${url}">Detay →</a></div>`}).join('');
  }
  $('#calendarPrev')?.addEventListener('click',()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);renderCalendar()});
  $('#calendarNext')?.addEventListener('click',()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);renderCalendar()});
  $('#calendarToday')?.addEventListener('click',()=>{viewDate=new Date();renderCalendar()});

  function updateCountdown() {
    const now=Date.now();
    const upcoming=eventData.map(x=>({item:x,date:parseDate(x.date)})).filter(x=>x.date&&x.date.getTime()>=now).sort((a,b)=>a.date-b.date)[0];
    if(!upcoming) return;
    const title=$('#nextEventTitle'), meta=$('#nextEventMeta'), cd=$('#eventCountdown');
    if(title) title.textContent=upcoming.item.title;
    if(meta) meta.textContent=dateLabel(upcoming.date);
    if(!cd) return;
    const tick=()=>{const diff=Math.max(0,upcoming.date-Date.now());const vals=[Math.floor(diff/86400000),Math.floor(diff/3600000)%24,Math.floor(diff/60000)%60];$$('strong',cd).forEach((el,i)=>el.textContent=String(vals[i]).padStart(2,'0'))};tick();setInterval(tick,60000);
  }

  fetch('content/events.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
    eventData=data.items||[];
    annotateCards();
    renderCalendar();
    updateCountdown();
    // Dynamic CMS render can replace the cards shortly after page load.
    if(grid) new MutationObserver(()=>annotateCards()).observe(grid,{childList:true});
  }).catch(()=>{
    // Local file fallback: keep filters usable even when fetch is blocked.
    eventData=$$('.card',grid||document).map((card,i)=>({title:$('h3',card)?.textContent||`Etkinlik ${i+1}`,slug:$('.event-register-btn',card)?.dataset.eventSlug||'',registration_open:!!$('.event-register-btn',card)}));
    annotateCards(); renderCalendar();
  });
})();


// === EczaPlus Design System v4: branded cover templates + smart empty states ===
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm = (v='') => String(v).toLocaleLowerCase('tr-TR')
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

  function coverClass(category='') {
    const n = norm(category);
    if (!n) return 'default';
    if (n.includes('roportaj')) return 'roportaj';
    if (n.includes('farmakoloji')) return 'farmakoloji';
    if (n.includes('beslenme')) return 'beslenme';
    if (n.includes('kariyer')) return 'kariyer';
    if (n.includes('eczacilik')) return 'eczacilik';
    if (n.includes('duyuru')) return 'duyuru';
    if (n.includes('etkinlik')) return 'event';
    return n;
  }

  function makeCoverMarkup(title, category, variant='card') {
    const cls = coverClass(category);
    return `<div class="content-cover content-cover--${cls} content-cover--${variant}" aria-hidden="true">
      <span class="content-cover__badge">${esc(category || 'EczaPlus')}</span>
      <h3 class="content-cover__title">${esc(title || 'EczaPlus')}</h3>
      <div class="content-cover__meta"><span>ECZAPLUS</span><span>ECZACILIK TOPLULUĞU</span></div>
      <i class="content-cover__plus">+</i>
    </div>`;
  }

  function injectCardCovers(scope=document) {
    $$('.card.editorial', scope).forEach(card => {
      if (card.dataset.coverEnhanced === 'true') return;
      const title = $('h3', card)?.textContent.trim() || 'İçerik';
      const category = $('small', card)?.textContent.trim() || card.dataset.category || 'İçerik';
      const uploaded = card.querySelector('.content-card-cover');
      if (uploaded?.getAttribute('src')) {
        const src = uploaded.getAttribute('src');
        uploaded.remove();
        card.insertAdjacentHTML('afterbegin', `<div class="content-cover-photo">
          <img src="${esc(src)}" alt="${esc(title)}" loading="lazy">
          <div class="content-cover-photo__shade"></div>
          <span class="content-cover__badge">${esc(category || 'EczaPlus')}</span>
          <div class="content-cover-photo__brand"><strong>ECZAPLUS</strong><span>ECZACILIK TOPLULUĞU</span></div>
        </div>`);
      } else {
        uploaded?.remove();
        card.insertAdjacentHTML('afterbegin', makeCoverMarkup(title, category, 'card'));
      }
      card.dataset.coverEnhanced = 'true';
    });

    $$('.featured-primary', scope).forEach(card => {
      if (card.dataset.coverEnhanced === 'true') return;
      const title = $('h3', card)?.textContent.trim() || 'Öne çıkan içerik';
      const category = $('.featured-kicker', card)?.textContent.trim() || 'İçerik';
      const uploaded = card.querySelector('img');
      if (uploaded?.getAttribute('src')) {
        const src = uploaded.getAttribute('src');
        uploaded.remove();
        card.insertAdjacentHTML('afterbegin', `<div class="content-cover-photo content-cover-photo--featured">
          <img src="${esc(src)}" alt="${esc(title)}" loading="lazy">
          <div class="content-cover-photo__shade"></div>
          <span class="content-cover__badge">${esc(category || 'EczaPlus')}</span>
          <div class="content-cover-photo__brand"><strong>ECZAPLUS</strong><span>ECZACILIK TOPLULUĞU</span></div>
        </div>`);
      } else {
        card.insertAdjacentHTML('afterbegin', makeCoverMarkup(title, category, 'featured'));
      }
      card.dataset.coverEnhanced = 'true';
    });

    $$('.featured-mini', scope).forEach(card => {
      if (card.dataset.coverEnhanced === 'true') return;
      const title = $('h3', card)?.textContent.trim() || 'İçerik';
      const category = $('small', card)?.textContent.trim() || 'İçerik';
      const uploaded = card.querySelector('img');
      if (uploaded?.getAttribute('src')) {
        const src = uploaded.getAttribute('src');
        uploaded.remove();
        card.insertAdjacentHTML('afterbegin', `<div class="content-cover-photo content-cover-photo--mini">
          <img src="${esc(src)}" alt="${esc(title)}" loading="lazy">
          <div class="content-cover-photo__shade"></div>
          <span class="content-cover__badge">${esc(category || 'EczaPlus')}</span>
          <div class="content-cover-photo__brand"><strong>ECZAPLUS</strong></div>
        </div>`);
      } else {
        card.insertAdjacentHTML('afterbegin', makeCoverMarkup(title, category, 'mini'));
      }
      card.dataset.coverEnhanced = 'true';
    });

    if (document.body.classList.contains('article-page') && !$('.article-cover') && !$('.article-cover-template')) {
      const title = $('.article-sheet h1')?.textContent.trim() || 'EczaPlus';
      const category = ($('.article-kicker')?.textContent || 'İçerik').split('·')[0].trim();
      const summary = $('.article-summary');
      if (summary) {
        const wrap = document.createElement('div');
        wrap.className = 'article-cover-template';
        wrap.innerHTML = makeCoverMarkup(title, category, 'article');
        summary.insertAdjacentElement('afterend', wrap);
      }
    }
  }

  // Search + no results wording polish
  function polishEmptyStates() {
    const searchShell = $('#globalSearchResults .search-empty');
    if (searchShell && !searchShell.querySelector('strong')) {
      const text = searchShell.textContent.trim();
      if (/en az 2 harf/i.test(text)) searchShell.innerHTML = `<strong>Aramaya başla</strong><span>En az 2 harf yazarak içerik, etkinlik, duyuru, haber ve dergiyi aynı anda tarayabilirsin.</span>`;
      else if (/eşleşen sonuç/i.test(text)) searchShell.innerHTML = `<strong>Sonuç bulunamadı</strong><span>Farklı bir kelime dene ya da üst menüden ilgili arşiv sayfalarına göz at.</span>`;
    }
    const newsEmpty = $('#newsGrid .search-empty');
    if (newsEmpty && !newsEmpty.querySelector('strong')) newsEmpty.innerHTML = `<strong>Henüz haber yok</strong><span>Yeni gelişmeler eklendiğinde haber panosu burada güncellenecek.</span>`;
    const regEmpty = $('#myRegistrationsList .search-empty');
    if (regEmpty && !regEmpty.querySelector('strong')) regEmpty.innerHTML = `<strong>Henüz kayıt yok</strong><span>Bu cihazdan yaptığın etkinlik kayıtları burada listelenecek.</span>`;
    const filterEmpty = $('#eventFilterEmpty');
    if (filterEmpty && !filterEmpty.querySelector('strong')) {
      const t = filterEmpty.textContent.trim();
      filterEmpty.innerHTML = `<strong>${/geçmiş/i.test(t) ? 'Geçmiş etkinlik bulunamadı' : 'Bu filtrede etkinlik yok'}</strong><span>Farklı bir filtre seçebilir veya tüm etkinliklere dönebilirsin.</span>`;
    }
    const mapEmpty = $('#mapEmpty');
    if (mapEmpty) mapEmpty.hidden = true;
    $$('.rep-list > p').forEach(p => { if (!p.querySelector('strong')) p.innerHTML = `<strong>Temsilci bulunmuyor</strong><span>${esc(p.textContent.trim())}</span>`; });
  }

  injectCardCovers();
  polishEmptyStates();
  setTimeout(() => { injectCardCovers(); polishEmptyStates(); }, 120);
  setTimeout(() => { injectCardCovers(); polishEmptyStates(); }, 700);

  const watched = ['#featuredContent', '#globalSearchResults', '#newsGrid', '#repList', '#myRegistrationsList', '#etkinlikler'];
  watched.forEach(sel => {
    const el = $(sel);
    if (!el) return;
    new MutationObserver(() => { injectCardCovers(el); polishEmptyStates(); }).observe(el, { childList:true, subtree:true });
  });
})();

// === EczaPlus top-bar search interaction ===
(() => {
  const root = document.getElementById('headerSearch');
  const toggle = root?.querySelector('.header-search-toggle');
  const panel = document.getElementById('headerSearchPanel');
  const input = document.getElementById('globalSearch');
  if (!root || !toggle || !panel) return;
  const close = () => { root.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); };
  const open = () => { root.classList.add('open'); toggle.setAttribute('aria-expanded','true'); setTimeout(()=>input?.focus(),60); };
  toggle.addEventListener('click', e => { e.stopPropagation(); root.classList.contains('open') ? close() : open(); });
  panel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
  });
})();


// === EczaPlus V3 visuals: intro loader + active map marker polish ===
document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    const closeLoader = () => setTimeout(() => loader.classList.add('is-hidden'), 430);
    if (document.readyState === 'complete') closeLoader();
    else window.addEventListener('load', closeLoader, { once: true });
    setTimeout(() => loader.classList.add('is-hidden'), 760);
  }

  const markerWrap = document.getElementById('mapMarkers');
  if (markerWrap) {
    markerWrap.addEventListener('click', (e) => {
      const marker = e.target.closest('.map-marker');
      if (!marker) return;
      markerWrap.querySelectorAll('.map-marker').forEach(el => el.classList.remove('active'));
      marker.classList.add('active');
    });
  }
});



// === EczaPlus Easter Egg: tap/click the logo 5 times ===
(() => {
  const targets = [document.getElementById('headerLogoShell'), document.getElementById('threeLogoShell')].filter(Boolean);
  if (!targets.length) return;

  let taps = 0;
  let resetTimer;
  let progressTimer;

  const ensureProgress = () => {
    let el = document.getElementById('logoSecretProgress');
    if (!el) {
      el = document.createElement('div');
      el.id = 'logoSecretProgress';
      el.className = 'logo-secret-progress';
      document.body.appendChild(el);
    }
    return el;
  };

  const createOverlay = () => {
    let overlay = document.getElementById('eczaQuoteOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'eczaQuoteOverlay';
    overlay.className = 'ecza-quote-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="ecza-quote-backdrop" aria-hidden="true"></div>
      <div class="ecza-quote-card" role="dialog" aria-modal="true" aria-label="EczaPlus gizli mesajı">
        <button class="ecza-easter-x" type="button" aria-label="Kapat">×</button>
        <div class="ecza-quote-logo-wrap">
          <span class="ecza-quote-halo halo-one"></span>
          <span class="ecza-quote-halo halo-two"></span>
          <img src="logo.png" alt="EczaPlus" class="ecza-quote-main-logo">
        </div>
        <blockquote class="ecza-quote-text">“<span id="eczaQuoteType"></span>”</blockquote>
        <div class="ecza-quote-line" aria-hidden="true"></div>
        <div class="ecza-quote-actions">
          <button class="story-mini-btn" data-quote-action="replay" type="button">Tekrar oynat</button>
          <button class="ecza-easter-close" type="button">Kapat</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const line = 'İlacı zehirden ayıran dozudur.';
    let typeTimer;

    overlay._replay = () => {
      clearInterval(typeTimer);
      const type = overlay.querySelector('#eczaQuoteType');
      const logo = overlay.querySelector('.ecza-quote-main-logo');
      const quote = overlay.querySelector('.ecza-quote-text');
      const lineEl = overlay.querySelector('.ecza-quote-line');
      if (type) type.textContent = '';
      [logo, quote, lineEl].forEach(el => el?.classList.remove('play'));
      void overlay.offsetWidth;
      [logo, quote, lineEl].forEach(el => el?.classList.add('play'));
      setTimeout(() => {
        let i = 0;
        typeTimer = setInterval(() => {
          i += 1;
          if (type) type.textContent = line.slice(0, i);
          if (i >= line.length) clearInterval(typeTimer);
        }, 42);
      }, 620);
    };

    overlay._open = () => {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      overlay._replay();
    };

    overlay._close = () => {
      clearInterval(typeTimer);
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('.ecza-easter-x') || e.target.closest('.ecza-easter-close')) {
        overlay._close();
        return;
      }
      if (e.target.closest('[data-quote-action="replay"]')) overlay._replay();
    });

    document.addEventListener('keydown', e => {
      if (!overlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') overlay._close();
      if (e.key.toLowerCase() === 'r') overlay._replay();
    });

    return overlay;
  };

  const openSecret = () => {
    taps = 0;
    const overlay = createOverlay();
    overlay._open?.();
    if (navigator.vibrate) navigator.vibrate([22, 18, 32]);
    window.eczaToast?.('Gizli mesaj açıldı ✦', 'success', 'Easter egg');
  };

  const onTap = () => {
    clearTimeout(resetTimer);
    taps += 1;
    const p = ensureProgress();
    if (taps >= 2 && taps < 5) {
      p.textContent = `${taps}/5 · gizli mesaj yaklaşıyor…`;
      p.classList.add('show');
      clearTimeout(progressTimer);
      progressTimer = setTimeout(() => p.classList.remove('show'), 850);
    }
    if (taps >= 5) {
      p.classList.remove('show');
      openSecret();
      return;
    }
    resetTimer = setTimeout(() => {
      taps = 0;
      p.classList.remove('show');
    }, 2800);
  };

  targets.forEach(el => el.addEventListener('click', onTap));
})();




// === EczaPlus V7 Premium UI interactions ===
(() => {
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.nav');
  const menuButton = document.querySelector('.menu-button');
  const mobileBottomLinks = [...document.querySelectorAll('.mobile-bottom-nav a')];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let lastY = window.scrollY;
  let raf = 0;

  // Mobil menüyü daha kontrollü bir panel gibi davranacak şekilde iyileştir.
  const syncMenuState = () => {
    if (!nav || !menuButton) return;
    const open = nav.classList.contains('open');
    document.body.classList.toggle('mobile-menu-open', open && innerWidth <= 760);
    menuButton.textContent = open ? '×' : '☰';
    menuButton.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  };
  menuButton?.addEventListener('click', () => requestAnimationFrame(syncMenuState));
  nav?.addEventListener('click', e => {
    if (e.target.closest('a')) requestAnimationFrame(syncMenuState);
  });
  document.addEventListener('click', e => {
    if (innerWidth > 760 || !nav?.classList.contains('open')) return;
    if (e.target.closest('.nav') || e.target.closest('.menu-button')) return;
    nav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded','false');
    syncMenuState();
  });
  window.addEventListener('resize', () => {
    if (innerWidth > 760 && nav?.classList.contains('open')) {
      nav.classList.remove('open');
      menuButton?.setAttribute('aria-expanded','false');
    }
    syncMenuState();
  }, { passive:true });

  // Mobilde aşağı kaydırırken header saklanır, yukarı kaydırırken geri gelir.
  const updateScrollPolish = () => {
    raf = 0;
    const y = window.scrollY || 0;
    if (header) {
      header.classList.toggle('header-compact', y > 28);
      const shouldHide = innerWidth <= 760 && y > 150 && y > lastY + 4 && !nav?.classList.contains('open');
      if (shouldHide) header.classList.add('header-hidden');
      else if (y < lastY - 3 || y < 120) header.classList.remove('header-hidden');
    }

    if (!reduceMotion) {
      const hero = document.getElementById('heroLogoStage');
      if (hero) hero.style.setProperty('--hero-parallax', `${Math.min(18, y * .025)}px`);
      document.querySelectorAll('.watermark-section').forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > innerHeight) return;
        const delta = Math.max(-12, Math.min(12, (rect.top - innerHeight * .45) * -.012));
        section.style.setProperty('--section-parallax', `${delta}px`);
      });
    }

    // Alt navigasyonda kullanıcının bulunduğu bölümü belirt.
    if (innerWidth <= 760 && mobileBottomLinks.length) {
      let current = 'anasayfa';
      document.querySelectorAll('main section[id]').forEach(section => {
        const r = section.getBoundingClientRect();
        if (r.top <= innerHeight * .38 && r.bottom > innerHeight * .25) current = section.id;
      });
      mobileBottomLinks.forEach(a => {
        const href = a.getAttribute('href') || '';
        const same = href === `#${current}` || (current === 'icerikler' && href.includes('icerikler')) || (current === 'dergi' && href === '#dergi') || (current === 'basvuru' && href === '#basvuru') || (current === 'iletisim' && href === '#iletisim');
        a.classList.toggle('is-active', same);
      });
    }
    lastY = y;
  };
  const queueScroll = () => {
    if (!raf) raf = requestAnimationFrame(updateScrollPolish);
  };
  addEventListener('scroll', queueScroll, { passive:true });
  updateScrollPolish();

  // Klavye kullanıcıları için kart hover davranışını focus ile eşleştir.
  document.querySelectorAll('.card,.notice-card,.archive-card,.team-card').forEach(card => {
    card.addEventListener('focusin', () => card.classList.add('is-keyboard-focus'));
    card.addEventListener('focusout', () => card.classList.remove('is-keyboard-focus'));
  });
})();


  // Normal site entry: start at the top. Internal anchor links still work normally.
  if (!location.hash) {
    window.addEventListener('load', () => {
      requestAnimationFrame(() => window.scrollTo({top:0,left:0,behavior:'auto'}));
    }, {once:true});
  }
