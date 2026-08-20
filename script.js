const heroCanvas = document.getElementById('threeLogoCanvas');
const heroShell = document.getElementById('threeLogoShell');
const headerCanvas = document.getElementById('headerLogoCanvas');
const headerShell = document.getElementById('headerLogoShell');

function createLayered3DLogo(canvas, shell, options = {}) {
  if (!canvas || !shell || !window.THREE) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.pixelRatio || 2));
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
    const layers = options.layers || 30;
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
    if (eventsGrid) eventsGrid.innerHTML = (events.items || []).map(item => `<article class="card"><span>${escapeHtml(item.number)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><a class="card-detail-link" href="${escapeHtml(item.url || `/etkinlikler/${item.slug}/`)}">Etkinliğe git →</a></article>`).join('');

    // Announcements
    setText('#duyurular .eyebrow', announcements.eyebrow);
    setText('#duyurular h2', announcements.title);
    setLink('#duyurular .text-link', announcements.action_text, announcements.action_link);
    const noticeGrid = document.querySelector('#duyurular .notice-grid');
    if (noticeGrid) noticeGrid.innerHTML = (announcements.items || []).map(item => `<article class="notice-card"><small>${escapeHtml(item.date)}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><a class="card-detail-link" href="${escapeHtml(item.url || `/duyurular/${item.slug}/`)}">Duyuruya git →</a></article>`).join('');

    // Contents
    setText('#icerikler .eyebrow', contents.eyebrow);
    setText('#icerikler h2', contents.title);
    const contentsGrid = document.querySelector('#icerikler .cards');
    if (contentsGrid) contentsGrid.innerHTML = (articles.items || []).map(item => `<article class="card editorial">${item.cover ? `<img class="content-card-cover" src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}">` : ''}<small>${escapeHtml(item.category)}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><a href="${escapeHtml(item.url)}">İçeriğe git →</a></article>`).join('');

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
    setText('#arsiv .eyebrow', magazine.archive_eyebrow);
    setText('#arsiv h2', magazine.archive_title);
    const archiveGrid = document.querySelector('#arsiv .archive-grid');
    if (archiveGrid) archiveGrid.innerHTML = (magazine.issues || []).map(issue => `<article class="archive-card">${issue.cover ? `<img class="content-card-cover" src="${escapeHtml(issue.cover)}" alt="${escapeHtml(issue.title)}">` : ''}<span>${escapeHtml(issue.number)}</span><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.text)}</p><a class="card-detail-link" href="${escapeHtml(issue.url || `/dergi/${issue.slug}/`)}">Dergiyi incele →</a>${issue.pdf ? `<a class="secondary-card-link" href="${escapeHtml(issue.pdf)}" target="_blank" rel="noopener">${escapeHtml(issue.link_text || "PDF'yi aç →")}</a>` : ''}</article>`).join('');

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
