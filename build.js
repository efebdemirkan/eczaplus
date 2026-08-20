const fs = require('fs');
const path = require('path');

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
function readJson(file) { return JSON.parse(fs.readFileSync(path.join(root,'content',file),'utf8')); }
function writeJson(file, data) { fs.writeFileSync(path.join(root,'content',file),JSON.stringify(data,null,2)); }
function detailPage({typeLabel, backHref, backText, kicker, title, summary, body, cover, extraHtml=''}) {
  const coverHtml = cover ? `<img class="article-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(title)}">` : '';
  const content = body && String(body).trim() ? markdownToHtml(body) : `<p>${escapeHtml(summary || '')}</p>`;
  return `<!doctype html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(summary)}"><title>${escapeHtml(title)} | EczaPlus</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"></head>
<body class="article-page"><header class="article-header"><a class="article-brand" href="/"><img src="/logo.png" alt="EczaPlus"><span><strong>ECZAPLUS</strong><small>ECZACILIK TOPLULUĞU</small></span></a><a class="article-back" href="${escapeHtml(backHref)}">← ${escapeHtml(backText)}</a></header>
<main class="article-main"><article class="article-sheet"><div class="article-kicker">${escapeHtml(typeLabel)}${kicker ? ` · ${escapeHtml(kicker)}` : ''}</div><h1>${escapeHtml(title)}</h1><p class="article-summary">${escapeHtml(summary || '')}</p>${coverHtml}<div class="article-body">${content}</div>${extraHtml}<div class="article-end"><img src="/logo.png" alt=""><span>EczaPlus</span></div></article></main>
<footer class="article-footer">© 2026 EczaPlus Eczacılık Topluluğu</footer></body></html>`;
}
function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function writeDetail(base, slug, html){ const dir = path.join(root,base,slug); ensureDir(dir); fs.writeFileSync(path.join(dir,'index.html'),html); }

// İçerik yazıları
const articleItems = [];
if (fs.existsSync(articlesDir)) {
  for (const file of fs.readdirSync(articlesDir).filter(f=>f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(articlesDir,file),'utf8');
    const {data,body} = parseFrontmatter(raw);
    if (data.published === false) continue;
    const slug = data.slug || path.basename(file,'.md');
    const url = `/icerikler/${slug}/`;
    writeDetail('icerikler', slug, detailPage({typeLabel:data.category || 'İÇERİK',backHref:'/#icerikler',backText:'İçeriklere dön',kicker:fmtDate(data.date),title:data.title||slug,summary:data.summary||'',body,cover:data.cover||''}));
    articleItems.push({title:data.title||slug,slug,category:data.category||'',summary:data.summary||'',date:data.date||'',cover:data.cover||'',url});
  }
}
articleItems.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
writeJson('articles-index.json',{items:articleItems});

// Etkinlikler
const events = readJson('events.json');
(events.items || []).forEach((item, i) => {
  item.slug = item.slug || slugify(item.title);
  item.url = `/etkinlikler/${item.slug}/`;
  writeDetail('etkinlikler', item.slug, detailPage({typeLabel:'ETKİNLİK',backHref:'/#etkinlikler',backText:'Etkinliklere dön',kicker:item.date || item.number || '',title:item.title,summary:item.text||'',body:item.detail||item.text||'',cover:item.cover||''}));
});
writeJson('events.json',events);

// Duyurular
const announcements = readJson('announcements.json');
(announcements.items || []).forEach(item => {
  item.slug = item.slug || slugify(item.title);
  item.url = `/duyurular/${item.slug}/`;
  writeDetail('duyurular', item.slug, detailPage({typeLabel:'DUYURU',backHref:'/#duyurular',backText:'Duyurulara dön',kicker:item.date||'',title:item.title,summary:item.text||'',body:item.detail||item.text||'',cover:item.cover||''}));
});
writeJson('announcements.json',announcements);

// Dergi sayıları
const magazine = readJson('magazine.json');
(magazine.issues || []).forEach(issue => {
  issue.slug = issue.slug || slugify(`${issue.number}-${issue.title}`);
  issue.url = `/dergi/${issue.slug}/`;
  const pdfHtml = issue.pdf ? `<p class="detail-cta"><a class="btn btn-dark" href="${escapeHtml(issue.pdf)}" target="_blank" rel="noopener">PDF'yi aç →</a></p>` : '';
  writeDetail('dergi', issue.slug, detailPage({typeLabel:'ECZA+ DERGİ',backHref:'/#arsiv',backText:'Dergi arşivine dön',kicker:issue.number||'',title:issue.title,summary:issue.text||'',body:issue.detail||issue.text||'',cover:issue.cover||'',extraHtml:pdfHtml}));
});
writeJson('magazine.json',magazine);

console.log(`Generated ${articleItems.length} content pages, ${(events.items||[]).length} event pages, ${(announcements.items||[]).length} announcement pages and ${(magazine.issues||[]).length} magazine pages.`);
