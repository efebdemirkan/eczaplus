const fs = require('fs');

const buildFile = 'build.js';
let source = fs.readFileSync(buildFile, 'utf8');

// 1) Markdown image support for article/interview bodies.
if (!source.includes('article-inline-image')) {
  const marker = "function inlineMarkdown(s) {\n  return escapeHtml(s)\n";
  const replacement = "function inlineMarkdown(s) {\n  return escapeHtml(s)\n    .replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, (_, alt, src) => {\n      const normalizedSrc = String(src).startsWith('/media/')\n        ? `../../${String(src).replace(/^\\//,'')}`\n        : src;\n      return `<img class=\"article-inline-image\" src=\"${normalizedSrc}\" alt=\"${alt}\" loading=\"lazy\">`;\n    })\n";

  if (!source.includes(marker)) {
    throw new Error('inlineMarkdown patch point not found in build.js');
  }
  source = source.replace(marker, replacement);
}

// 2) Load image-fixes.css after the main stylesheet on generated pages.
source = source.replace(
  '<link rel="stylesheet" href="../../styles.css">',
  '<link rel="stylesheet" href="../../styles.css"><link rel="stylesheet" href="../../image-fixes.css?v=20260901-1">'
);
source = source.replace(
  '<link rel="stylesheet" href="../styles.css">',
  '<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../image-fixes.css?v=20260901-1">'
);

fs.writeFileSync(buildFile, source, 'utf8');

// 3) Also load the fix stylesheet on the home page.
const indexFile = 'index.html';
if (fs.existsSync(indexFile)) {
  let index = fs.readFileSync(indexFile, 'utf8');
  if (!index.includes('image-fixes.css')) {
    index = index.replace(
      '<link href="styles.css" rel="stylesheet"/>',
      '<link href="styles.css" rel="stylesheet"/><link href="image-fixes.css?v=20260901-1" rel="stylesheet"/>'
    );
  }
  fs.writeFileSync(indexFile, index, 'utf8');
}

console.log('EczaPlus image rendering and no-crop fixes applied.');
