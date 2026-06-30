const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('.next')) {
        results = results.concat(walk(fullPath));
      }
    } else {
      // Only process text-like files
      const ext = path.extname(fullPath);
      if (['.ts', '.tsx', '.js', '.json', '.sql', '.md', '.css', '.example'].includes(ext)) {
        results.push(fullPath);
      }
    }
  });
  return results;
};

const replaceInFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Technical identifiers (camelCase, snake_case, domain names, keys)
  content = content.replace(/wacrm_session/g, 'vedmint_crm_session');
  content = content.replace(/wacrm\.theme/g, 'vedmint_crm.theme');
  content = content.replace(/wacrm\.bypass_assignee_guard/g, 'vedmint_crm.bypass_assignee_guard');
  content = content.replace(/wacrm\.tech/g, 'wa.vedmint.com');
  content = content.replace(/wacrm\.example/g, 'wa.vedmint.example');
  content = content.replace(/'wacrm'/g, "'vedmint_crm'");
  content = content.replace(/"wacrm"/g, '"vedmint_crm"');

  // 2. Human-readable text replacements (respecting casing)
  content = content.replace(/\bWACRM\b/g, 'VedMint CRM');
  content = content.replace(/\bwacrm\b/g, 'VedMint Crm');
  content = content.replace(/\bWacrm\b/g, 'VedMint Crm');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[Branding] Updated: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  }
};

const main = () => {
  const root = path.join(__dirname, '..');
  
  const files = [
    ...walk(path.join(root, 'src')),
    ...walk(path.join(root, 'supabase')),
    path.join(root, 'package.json'),
    path.join(root, 'README.md'),
    path.join(root, '.env.local.example'),
    path.join(root, 'scripts', 'migrate.js')
  ];

  console.log(`[Branding] Scanning ${files.length} files...`);
  files.forEach(replaceInFile);
  console.log('[Branding] Complete!');
};

main();
