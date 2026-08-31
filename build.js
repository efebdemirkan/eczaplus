const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
const articlesDir = path.join(root, 'content', 'articles');

function escapeHtml(v='') {
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function parseScalar(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1,-1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}
function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    data[line.slice(0,idx).trim()] = parseScalar(line.slice(idx+1));
  }
  return { data, body: m[2] };
}
function inlineMarkdown(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
}
function markdownToHtml(md='') {
  const lines = String(md || '').replace(/\r/g,'').split('\n');
  let out = [], para = [], inUl = false, inOl = false;
  const flushPara = () => { if (para.length) { out.push(`<p>${inlineMarkdown(para.join(' '))}</p>`); para=[]; } };
  const closeLists = () => { if(inUl){out.push('</ul>');inUl=false;} if(inOl){out.push('</ol>');inOl=false;} };
  for (const line of lines) {
    if (!line.trim()) { flushPara(); closeLists(); continue; }
    let m;
    if ((m=line.match(/^(#{1,3})\s+(.+)$/))) { flushPara(); closeLists(); const n=m[1].length; out.push(`<h${n+1}>${inlineMarkdown(m[2])}</h${n+1}>`); continue; }
    if ((m=line.match(/^[-*]\s+(.+)$/))) { flushPara(); if(inOl){out.push('</ol>');inOl=false;} if(!inUl){out.push('<ul>');inUl=true;} out.push(`<li>${inlineMarkdown(m[1])}</li>`); continue; }
    if ((m=line.match(/^\d+\.\s+(.+)$/))) { flushPara(); if(inUl){out.push('</ul>');inUl=false;} if(!inOl){out.push('<ol>');inOl=true;} out.push(`<li>${inlineMarkdown(m[1])}</li>`); continue; }
    if ((m=line.match(/^>\s?(.*)$/))) { flushPara(); closeLists(); out.push(`<blockquote>${inlineMarkdown(m[1])}</blockquote>`); continue; }
    para.push(line.trim());
  }
  flushPara(); closeLists();
  return out.join('\n');
}
function fmtDate(s='') {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'long',year:'numeric'}).format(d);
}
function slugify(v='') {
  return String(v).toLocaleLowerCase('tr-TR')
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'detay';
}


function sortableTime(value='') {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const tr = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (tr) return new Date(Number(tr[3]), Number(tr[2])-1, Number(tr[1]), Number(tr[4]||0), Number(tr[5]||0)).getTime();
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function gitUpdatedAt(filePath) {
  try {
    const rel = path.relative(root, filePath).replace(/\\/g,'/');
    const out = execSync(`git log -1 --format=%cI -- \"${rel.replace(/\"/g,'\\\"')}\"`, {cwd: root, stdio:['ignore','pipe','ignore']}).toString().trim();
    return out || '';
  } catch (_) { return ''; }
}
function gitCreatedAt(filePath) {
  try {
    const rel = path.relative(root, filePath).replace(/\\/g,'/');
    const out = execSync(`git log --follow --diff-filter=A --format=%cI -- "${rel.replace(/"/g,'\\"')}"`, {cwd: root, stdio:['ignore','pipe','ignore']}).toString().trim();
    if (!out) return '';
    return out.split(/\r?\n/).filter(Boolean).pop() || '';
  } catch (_) { return ''; }
}

function cleanGeneratedDetails(section, validSlugs) {
  const dir = path.join(root, section);
  if (!fs.existsSync(dir)) return;
  const keep = new Set(validSlugs.filter(Boolean));
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (!entry.isDirectory()) continue;
    if (!keep.has(entry.name)) fs.rmSync(path.join(dir, entry.name), {recursive:true, force:true});
  }
}

function readJson(file) { return JSON.parse(fs.readFileSync(path.join(root,'content',file),'utf8')); }
function writeJson(file, data) { fs.writeFileSync(path.join(root,'content',file),JSON.stringify(data,null,2)); }
const SITE_URL_FOR_PAGES = process.env.SITE_URL || 'https://efebdemirkan.github.io/eczaplus';
function detailPage({typeLabel, backHref, backText, kicker, title, summary, body, cover, extraHtml='', pageUrl=''}) {
  const detailAsset = (v='') => String(v).startsWith('http') ? String(v) : `../../${String(v).replace(/^\.\//,'').replace(/^\//,'')}`;
  const coverHtml = cover ? `<img class="article-cover" src="${escapeHtml(detailAsset(cover))}" alt="${escapeHtml(title)}" loading="lazy">` : '';
  const content = body && String(body).trim() ? markdownToHtml(body) : `<p>${escapeHtml(summary || '')}</p>`;
  const siteJoin = (base,v='') => `${String(base).replace(/\/$/,'')}/${String(v).replace(/^\.\//,'').replace(/^\//,'')}`;
  const ogImage = cover ? (cover.startsWith('http') ? cover : siteJoin(SITE_URL_FOR_PAGES,cover)) : siteJoin(SITE_URL_FOR_PAGES,'og-image.jpg');
  const canonical = siteJoin(SITE_URL_FOR_PAGES,pageUrl);
  return `<!doctype html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(summary)}"><title>${escapeHtml(title)} | EczaPlus</title>
<link rel="canonical" href="${canonical}">
<link rel="icon" href="../../favicon.ico" sizes="any"><link rel="apple-touch-icon" href="../../apple-touch-icon.png">
<meta property="og:type" content="article"><meta property="og:site_name" content="EczaPlus"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(summary)}"><meta property="og:image" content="${ogImage}"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="tr_TR">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(summary)}"><meta name="twitter:image" content="${ogImage}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="../../styles.css"></head>
<body class="article-page"><div aria-hidden="true" class="page-loader" id="pageLoader"><div class="page-loader__inner"><img class="page-loader__logo" src="../../logo.png" alt=""><div class="page-loader__line"></div></div></div><div class="cursor-spotlight" aria-hidden="true"></div><div class="global-scroll-progress" aria-hidden="true"><span></span></div><button class="theme-toggle" id="themeToggle" type="button" aria-label="Açık/koyu tema değiştir">◐</button><header class="article-header"><a class="article-brand" href="../../index.html"><img src="../../logo.png" alt="EczaPlus"><span><strong>ECZAPLUS</strong><small>ECZACILIK TOPLULUĞU</small></span></a><a class="article-back" href="${escapeHtml(backHref)}">← ${escapeHtml(backText)}</a></header>
<main class="article-main"><article class="article-sheet"><div class="article-kicker">${escapeHtml(typeLabel)}${kicker ? ` · ${escapeHtml(kicker)}` : ''}</div><h1>${escapeHtml(title)}</h1><p class="article-summary">${escapeHtml(summary || '')}</p>${coverHtml}<div class="article-body">${content}</div>${extraHtml}<div class="article-end"><img src="../../logo.png" alt=""><span>EczaPlus</span></div></article></main>
<footer class="article-footer">© 2026 EczaPlus Eczacılık Topluluğu</footer><script src="../../script.js"></script></body></html>`;
}
function icsEscape(v='') {
  return String(v).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
}
function pad2(n){ return String(n).padStart(2,'0'); }
function toIcsDate(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}
function buildEventIcs({ title, description, dateStr, url, location }) {
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // varsayılan 2 saat süre
  const stamp = toIcsDate(new Date());
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EczaPlus//Etkinlik//TR','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${toIcsDate(start)}-${Math.random().toString(36).slice(2,8)}@eczaplus`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    description ? `DESCRIPTION:${icsEscape(description)}` : '',
    location ? `LOCATION:${icsEscape(location)}` : '',
    url ? `URL:${icsEscape(url)}` : '',
    'END:VEVENT','END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}
function buildEventJsonLd({ title, description, dateStr, url, image, capacity }) {
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    description: description || title,
    startDate: start.toISOString(),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: 'EczaPlus Etkinlik Alanı', address: 'Türkiye' },
    organizer: { '@type': 'Organization', name: 'EczaPlus', url: SITE_URL_FOR_PAGES },
    url,
  };
  if (image) data.image = image.startsWith('http') ? image : `${String(SITE_URL_FOR_PAGES).replace(/\/$/,'')}/${String(image).replace(/^\//,'')}`;
  if (capacity) data.maximumAttendeeCapacity = Number(capacity);
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function writeDetail(base, slug, html){ const dir = path.join(root,base,slug); ensureDir(dir); fs.writeFileSync(path.join(dir,'index.html'),html); }

function listingPage({typeLabel,title,intro,cardsHtml,count}){
  return `<!doctype html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | EczaPlus</title><meta name="description" content="${escapeHtml(intro)}"><link rel="icon" href="../favicon.ico"><link rel="apple-touch-icon" href="../apple-touch-icon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="../styles.css"></head><body class="archive-list-page"><div aria-hidden="true" class="page-loader" id="pageLoader"><div class="page-loader__inner"><img class="page-loader__logo" src="../logo.png" alt=""><div class="page-loader__line"></div></div></div><header class="archive-page-header"><a class="article-brand" href="../index.html"><img src="../logo.png" alt="EczaPlus"><span><strong>ECZAPLUS</strong><small>ECZACILIK TOPLULUĞU</small></span></a><a class="article-back" href="../index.html">← Ana sayfa</a></header><main class="archive-page-main"><section class="archive-page-hero"><div><p class="eyebrow">${escapeHtml(typeLabel)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></div><div class="archive-page-count"><strong>${count}</strong><span>yayın</span></div></section><div class="archive-page-grid">${cardsHtml}</div></main><footer class="article-footer">© 2026 EczaPlus Eczacılık Topluluğu</footer><script src="../script.js"></script></body></html>`;
}
function writeListing(base,html){ const dir=path.join(root,base); ensureDir(dir); fs.writeFileSync(path.join(dir,'index.html'),html); }


// --- sitemap.xml üretimi (SEO) ---
const SITE_URL = process.env.SITE_URL || 'https://efebdemirkan.github.io/eczaplus';
const sitemapUrls = [
  { loc: '/', priority: '1.0' },
  { loc: '/#hakkimizda', priority: '0.6' },
  { loc: '/#etkinlikler', priority: '0.8' },
  { loc: '/#duyurular', priority: '0.7' },
  { loc: '/#icerikler', priority: '0.7' },
  { loc: '/#dergi', priority: '0.7' },
  { loc: '/#basvuru', priority: '0.5' },
  { loc: '/#iletisim', priority: '0.5' },
];
function addSitemapUrl(loc, priority = '0.6') {
  if (loc && !String(loc).startsWith('/')) loc = '/' + loc;
  sitemapUrls.push({ loc, priority });
}
function writeSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const body = sitemapUrls
    .map(u => `  <url><loc>${String(SITE_URL).replace(/\/$/,'')}/${String(u.loc).replace(/^\//,'')}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
}

// İçerik yazıları — yalnızca CMS'deki markdown dosyaları kaynak kabul edilir.
const articleItems = [];
const articleSlugs = [];
if (fs.existsSync(articlesDir)) {
  for (const file of fs.readdirSync(articlesDir).filter(f=>f.endsWith('.md'))) {
    const fullPath = path.join(articlesDir,file);
    const raw = fs.readFileSync(fullPath,'utf8');
    const {data,body} = parseFrontmatter(raw);
    if (data.published === false) continue;
    const slug = data.slug || path.basename(file,'.md');
    const url = `./icerikler/${slug}/index.html`;
    const created_at = gitCreatedAt(fullPath) || data.created_at || data.date || '';
    const updated_at = gitUpdatedAt(fullPath) || data.updated_at || created_at || data.date || '';
    writeDetail('icerikler', slug, detailPage({typeLabel:data.category || 'İÇERİK',backHref:'../index.html',backText:'Tüm içerikler',kicker:fmtDate(data.date),title:data.title||slug,summary:data.summary||'',body,cover:data.cover||'',pageUrl:url}));
    articleItems.push({title:data.title||slug,slug,category:data.category||'',summary:data.summary||'',date:data.date||'',created_at,updated_at,cover:data.cover||'',url});
    articleSlugs.push(slug);
  }
}
cleanGeneratedDetails('icerikler', articleSlugs);
articleItems.sort((a,b)=>{
  const byCreated = sortableTime(b.created_at) - sortableTime(a.created_at);
  if (byCreated) return byCreated;
  const byUpdate = sortableTime(b.updated_at) - sortableTime(a.updated_at);
  if (byUpdate) return byUpdate;
  return sortableTime(b.date) - sortableTime(a.date);
});
for (const item of articleItems) addSitemapUrl(item.url || `/icerikler/${item.slug}/index.html`, '0.6');
writeJson('articles-index.json',{items:articleItems});
writeListing('icerikler', listingPage({typeLabel:'OKU · İZLE · ÖĞREN',title:'Tüm İçerikler',intro:'EczaPlus tarafından yayınlanan röportajlar, eczacılık notları, bilimsel içerikler ve öğrenci rehberleri.',count:articleItems.length,cardsHtml:articleItems.map(x=>`<article class="card editorial">${x.cover?`<img class="content-card-cover" src="../${escapeHtml(String(x.cover).replace(/^\.\//,''))}" alt="${escapeHtml(x.title)}" loading="lazy">`:''}<small>${escapeHtml(x.category||'İÇERİK')}</small><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.summary||'')}</p><a class="card-detail-link" href="./${escapeHtml(x.slug)}/index.html">İçeriğe git →</a></article>`).join('')}));
addSitemapUrl('/icerikler/index.html','0.8');

// Etkinlikler
const events = readJson('events.json');
const eventSlugs = [];
(events.items || []).forEach((item, i) => {
  item.slug = item.slug || slugify(item.title);
  eventSlugs.push(item.slug);
  item.updated_at = item.updated_at || gitUpdatedAt(path.join(root,'content','events.json')) || item.date || '';
  item.url = `etkinlikler/${item.slug}/index.html`;
  const absoluteUrl = `${String(SITE_URL_FOR_PAGES).replace(/\/$/,'')}/${String(item.url).replace(/^\//,'')}`;
  const jsonLd = buildEventJsonLd({ title: item.title, description: item.text || '', dateStr: item.date || '', url: absoluteUrl, image: item.cover || '', capacity: item.capacity });
  const ics = buildEventIcs({ title: item.title, description: item.text || '', dateStr: item.date || '', url: absoluteUrl });
  let icsHtml = '';
  if (ics) {
    ensureDir(path.join(root, 'etkinlikler', item.slug));
    fs.writeFileSync(path.join(root, 'etkinlikler', item.slug, 'etkinlik.ics'), ics);
    icsHtml = `<p class="detail-cta"><a class="btn btn-outline" href="etkinlik.ics" download>📅 Takvime ekle</a></p>`;
  }
  writeDetail('etkinlikler', item.slug, detailPage({typeLabel:'ETKİNLİK',backHref:'../index.html',backText:'Tüm etkinlikler',kicker:item.date || item.number || '',title:item.title,summary:item.text||'',body:item.detail||item.text||'',cover:item.cover||'',pageUrl:item.url,extraHtml:icsHtml + jsonLd}));
  addSitemapUrl(item.url, '0.7');
});
cleanGeneratedDetails('etkinlikler', eventSlugs);
writeJson('events.json',events);
writeListing('etkinlikler', listingPage({typeLabel:'BİRLİKTE ÖĞREN',title:'Tüm Etkinlikler',intro:'EczaPlus söyleşileri, mini eğitimleri ve topluluk buluşmalarının tamamını keşfet.',count:(events.items||[]).length,cardsHtml:(events.items||[]).map((x,i)=>`<article class="card"><span>${escapeHtml(x.number||String(i+1).padStart(2,'0'))}</span><small>${escapeHtml(fmtDate(x.date||''))}</small><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.text||'')}</p><a class="card-detail-link" href="./${escapeHtml(x.slug)}/index.html">Etkinliğe git →</a></article>`).join('')}));
addSitemapUrl('/etkinlikler/index.html','0.8');

// Duyurular
const announcements = readJson('announcements.json');
const announcementSlugs = [];
(announcements.items || []).forEach(item => {
  item.slug = item.slug || slugify(item.title);
  announcementSlugs.push(item.slug);
  item.updated_at = item.updated_at || gitUpdatedAt(path.join(root,'content','announcements.json')) || item.date || '';
  item.url = `duyurular/${item.slug}/index.html`;
  writeDetail('duyurular', item.slug, detailPage({typeLabel:'DUYURU',backHref:'../index.html',backText:'Tüm duyurular',kicker:item.date||'',title:item.title,summary:item.text||'',body:item.detail||item.text||'',cover:item.cover||'',pageUrl:item.url}));
  addSitemapUrl(item.url, '0.5');
});
cleanGeneratedDetails('duyurular', announcementSlugs);
writeJson('announcements.json',announcements);
writeListing('duyurular', listingPage({typeLabel:'GÜNCEL',title:'Tüm Duyurular',intro:'EczaPlus başvuruları, toplantıları, dergi çağrıları ve topluluk güncellemelerinin tamamı.',count:(announcements.items||[]).length,cardsHtml:(announcements.items||[]).map(x=>`<article class="notice-card"><small>${escapeHtml(x.date||'GÜNCEL')}</small><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.text||'')}</p><a class="card-detail-link" href="./${escapeHtml(x.slug)}/index.html">Duyuruya git →</a></article>`).join('')}));
addSitemapUrl('/duyurular/index.html','0.8');

// Dergi sayıları
const magazine = readJson('magazine.json');
const magazineDir = path.join(root,'dergi');
if (fs.existsSync(magazineDir)) {
  for (const entry of fs.readdirSync(magazineDir)) {
    const full = path.join(magazineDir, entry);
    if (entry !== 'index.html' && fs.statSync(full).isDirectory()) fs.rmSync(full,{recursive:true,force:true});
  }
}
(magazine.issues || []).forEach(issue => {
  issue.slug = issue.slug || slugify(`${issue.number}-${issue.title}`);
  issue.url = `dergi/${issue.slug}/index.html`;
  const pdfHtml = issue.pdf ? `<p class="detail-cta"><a class="btn btn-dark" href="${escapeHtml(issue.pdf)}" target="_blank" rel="noopener">PDF'yi aç →</a></p>` : '';
  writeDetail('dergi', issue.slug, detailPage({typeLabel:'ECZA+ DERGİ',backHref:'../../index.html#dergi-sayilari',backText:'Dergi arşivine dön',kicker:issue.number||'',title:issue.title,summary:issue.text||'',body:issue.detail||issue.text||'',cover:issue.cover||'',extraHtml:pdfHtml,pageUrl:issue.url}));
  addSitemapUrl(issue.url, '0.6');
});
writeJson('magazine.json',magazine);

writeSitemap();

console.log(`Generated ${articleItems.length} content pages, ${(events.items||[]).length} event pages, ${(announcements.items||[]).length} announcement pages and ${(magazine.issues||[]).length} magazine pages.`);
console.log(`sitemap.xml yazıldı (${sitemapUrls.length} adres).`);
