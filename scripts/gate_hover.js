const fs = require('fs');

function gateHoverTargeted(css) {
  // Let's find all rules where selector contains :hover
  // We can scan through the CSS character by character
  let i = 0;
  const n = css.length;
  const replacements = [];

  while (i < n) {
    // Skip comments
    if (css.startsWith('/*', i)) {
      const endC = css.indexOf('*/', i + 2);
      i = endC === -1 ? n : endC + 2;
      continue;
    }

    // Skip @rules headers
    if (css[i] === '@') {
      const openB = css.indexOf('{', i);
      if (openB === -1) break;
      i = openB + 1;
      continue;
    }

    if (css[i] === '}' || /\s/.test(css[i])) {
      i++;
      continue;
    }

    // Start of a rule
    const ruleStart = i;
    const openBrace = css.indexOf('{', i);
    if (openBrace === -1) break;

    const selector = css.substring(ruleStart, openBrace).trim();

    // Find matching closing brace
    let braceCount = 1;
    let j = openBrace + 1;
    while (j < n && braceCount > 0) {
      if (css.startsWith('/*', j)) {
        const endC = css.indexOf('*/', j + 2);
        j = endC === -1 ? n : endC + 2;
        continue;
      }
      if (css[j] === '{') braceCount++;
      else if (css[j] === '}') braceCount--;
      j++;
    }

    const ruleEnd = j;
    const body = css.substring(openBrace + 1, ruleEnd - 1).trim();
    i = ruleEnd;

    if (!selector.includes(':hover')) {
      continue;
    }

    // This rule has :hover!
    // Split comma-separated selector
    const parts = splitSelectors(selector);
    const hoverParts = [];
    const nonHoverParts = [];
    for (const p of parts) {
      if (p.includes(':hover')) hoverParts.push(p);
      else nonHoverParts.push(p);
    }

    let replacement = '';
    if (nonHoverParts.length > 0) {
      replacement += nonHoverParts.join(',\n') + ' {\n  ' + body + '\n}\n\n';
    }

    if (hoverParts.length > 0) {
      replacement += '@media (hover: hover) and (pointer: fine) {\n  ' +
        hoverParts.join(',\n  ') + ' {\n    ' +
        body.split('\n').map(l => '  ' + l).join('\n') + '\n  }\n}\n';

      // Check if we should add :active feedback
      const activeSelectors = [];
      for (const sel of hoverParts) {
        if (sel.includes('::after') || sel.includes('::before') || sel.includes('disabled') || sel.includes('stat-card-toggle-icon') || sel.includes(' i')) {
          continue;
        }
        const base = sel.replace(/:hover\b/g, ':active');
        const isControl = /(btn|chip|swatch|option|tab|card|action|key|link|group)/i.test(base);
        const alreadyHasActive = ['.nav-link', '.icon-btn', '.reports-legend-row'].some(a => base.includes(a));
        if (isControl && !alreadyHasActive) {
          activeSelectors.push(base);
        }
      }
      if (activeSelectors.length > 0) {
        replacement += activeSelectors.join(',\n') + ' {\n  transform: scale(0.97);\n  transition: transform 120ms ease-out;\n}\n';
      }
    }

    replacements.push({
      start: ruleStart,
      end: ruleEnd,
      original: css.substring(ruleStart, ruleEnd),
      replacement: replacement
    });
  }

  // Apply replacements from back to front
  let output = css;
  for (let r = replacements.length - 1; r >= 0; r--) {
    const item = replacements[r];
    output = output.substring(0, item.start) + item.replacement + output.substring(item.end);
  }

  console.log('Hover rules replaced: ' + replacements.length);
  return output;
}

function splitSelectors(selectorStr) {
  const parts = [];
  let current = '';
  let inBracket = 0;
  let inParen = 0;

  for (let i = 0; i < selectorStr.length; i++) {
    const ch = selectorStr[i];
    if (ch === '[') inBracket++;
    else if (ch === ']') inBracket--;
    else if (ch === '(') inParen++;
    else if (ch === ')') inParen--;

    if (ch === ',' && inBracket === 0 && inParen === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

module.exports = { gateHoverTargeted };
