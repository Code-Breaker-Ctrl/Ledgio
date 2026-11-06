const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const htmlFiles = ['index.html', 'login.html', 'signup.html', 'reset-password.html', 'privacy.html', 'terms.html', 'dashboard.html'].map(f => path.join(rootDir, f));
const cssFiles = fs.readdirSync(path.join(rootDir, 'assets', 'css'))
  .filter(f => f.endsWith('.css') && !f.endsWith('.min.css'))
  .map(f => path.join(rootDir, 'assets', 'css', f));

// Load all CSS content into one combined string
let allCss = '';
for (const file of cssFiles) {
  allCss += '\n' + fs.readFileSync(file, 'utf8');
}

// Extract classes defined in CSS
// Matches .class-name followed by space, comma, colon, bracket, brace, dot, etc.
const cssClassRegex = /\.([a-zA-Z0-9_\-]+)(?=[^\w\-]|$)/g;
const definedClasses = new Set();
let match;
while ((match = cssClassRegex.exec(allCss)) !== null) {
  definedClasses.add(match[1]);
}

// Whitelist known external / framework / runtime icon classes (FontAwesome, JS-toggled state classes, dynamic classes)
const allowedSystemClasses = new Set([
  'fa', 'fas', 'far', 'fab', 'fal', 'fad',
  // Dynamic or state classes toggled via JS
  'is-active', 'is-open', 'is-closed', 'is-hidden', 'is-appeared', 'is-revealed', 'is-scrolled',
  'active', 'show', 'open', 'hidden', 'loading', 'disabled', 'checked', 'stealth-masked',
  'desktop-only', 'mobile-only', 'sr-only', 'no-scroll', 'js', 'no-js'
]);

// FontAwesome fa-* classes
function isFontAwesome(cls) {
  return cls.startsWith('fa-') || cls === 'fas' || cls === 'far' || cls === 'fab';
}

const unstyledByFile = {};
let totalUnstyled = 0;

for (const htmlFile of htmlFiles) {
  if (!fs.existsSync(htmlFile)) continue;
  const relPath = path.relative(rootDir, htmlFile);
  const html = fs.readFileSync(htmlFile, 'utf8');
  
  // Extract all class="..." and class='...'
  const classAttrRegex = /class=["']([^"']+)["']/g;
  const fileUnstyled = new Set();

  while ((match = classAttrRegex.exec(html)) !== null) {
    const classList = match[1].trim().split(/\s+/);
    for (const cls of classList) {
      if (!cls) continue;
      if (allowedSystemClasses.has(cls)) continue;
      if (isFontAwesome(cls)) continue;
      
      if (!definedClasses.has(cls)) {
        fileUnstyled.add(cls);
      }
    }
  }

  if (fileUnstyled.size > 0) {
    unstyledByFile[relPath] = Array.from(fileUnstyled);
    totalUnstyled += fileUnstyled.size;
  }
}

console.log('=====================================================');
console.log('   Ledgio Unstyled Class Verification Gate           ');
console.log('=====================================================');
console.log(`Checked ${htmlFiles.length} HTML files against ${cssFiles.length} CSS files.`);
console.log(`Unique CSS classes defined: ${definedClasses.size}`);

if (totalUnstyled === 0) {
  console.log('\x1b[32m✔ SUCCESS: 0 unstyled classes found! All HTML classes have matching CSS.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m✘ FAILED: Found ${totalUnstyled} unstyled class references:\x1b[0m`);
  for (const [file, classes] of Object.entries(unstyledByFile)) {
    console.log(`\n  File: ${file} (${classes.length} unstyled)`);
    for (const cls of classes) {
      console.log(`    - .${cls}`);
    }
  }
  process.exit(1);
}
