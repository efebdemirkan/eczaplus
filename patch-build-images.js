const fs = require('fs');

const file = 'build.js';
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('article-inline-image')) {
  const marker = "function inlineMarkdown(s) {\n  return escapeHtml(s)\n";
  const replacement = "function inlineMarkdown(s) {\n  return escapeHtml(s)\n    .replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, (_, alt, src) => {\n      const normalizedSrc = String(src).startsWith('/media/')\n        ? `../../${String(src).replace(/^\\//,'')}`\n        : src;\n      return `<img class=\"article-inline-image\" src=\"${normalizedSrc}\" alt=\"${alt}\" loading=\"lazy\" style=\"display:block;width:100%;height:auto;object-fit:contain;margin:22px 0;border-radius:16px\">`;\n    })\n";

  if (!source.includes(marker)) {
    throw new Error('inlineMarkdown patch point not found in build.js');
  }

  source = source.replace(marker, replacement);
  fs.writeFileSync(file, source, 'utf8');
  console.log('Interview/content image rendering patch applied.');
} else {
  console.log('Image rendering patch already present.');
}
