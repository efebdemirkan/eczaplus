const fs = require('fs');

const file = 'build.js';
let source = fs.readFileSync(file, 'utf8');

const target = '${coverHtml}<div class="article-body">${content}</div>';
const replacement = '<div class="article-body">${content}</div>';

if (source.includes(target)) {
  source = source.replace(target, replacement);
  fs.writeFileSync(file, source, 'utf8');
  console.log('Detail page cover image removed; listing/card covers remain.');
} else {
  console.log('Detail page cover image already removed or patch point not present.');
}
