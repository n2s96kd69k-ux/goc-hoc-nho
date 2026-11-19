const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const modules = [
 ['study-rewards', 'studyRewards,studyDate'],
 ['economy', 'transactEconomy'],
 ['focus', 'transactFocus'],
 ['tasks', 'transactTask,parseTaskFields'],
];
const server = modules.map(([name, exports]) => {
 const source = fs.readFileSync(path.join(root, '../server', name + '.cjs'), 'utf8')
  .replace(`module.exports={${exports}};`, '');
 const internalImport = /^const \{studyRewards, studyDate\} = require\('\.\/study-rewards\.cjs'\);\n/m;
 fs.writeFileSync(path.join(root, name + '.mjs'), source.replace(internalImport,
  "import {studyRewards, studyDate} from './study-rewards.mjs';\n") + '\nexport {' + exports + '};\n');
 return source.replace(internalImport, '');
});
const transport = fs.readFileSync(path.join(root, 'transport.mjs'), 'utf8').replace(/export /g, '');
const main = fs.readFileSync(path.join(root, 'index.mjs'), 'utf8').replace(/^import .*;\n/gm, '');
fs.writeFileSync(path.join(root, 'worker.js'), [...server, transport, main].join('\n'));
