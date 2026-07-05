const fs = require('fs');
let code = fs.readFileSync('E:/code/billu/lib/actions/ai-tools.ts', 'utf8');

const regex = /await db\.query\.users\.findFirst\(\{ where: eq\(users\.username, ([a-zA-Z0-9_\.]+)\) \}\)/g;

code = code.replace(regex, (match, p1) => {
  return `await db.query.users.findFirst({ where: or(eq(users.username, ${p1}.replace('@', '')), ilike(users.displayName, \`%\${${p1}.replace('@', '')}%\`)) })`;
});

fs.writeFileSync('E:/code/billu/lib/actions/ai-tools.ts', code);
console.log('Replaced successfully');
