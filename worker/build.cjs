const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const economy=fs.readFileSync(path.join(root,'../server/economy.cjs'),'utf8').replace('module.exports={transactEconomy};','');
fs.writeFileSync(path.join(root,'economy.mjs'),economy+'\nexport {transactEconomy};\n');
const transport=fs.readFileSync(path.join(root,'transport.mjs'),'utf8').replace(/export /g,'');
const main=fs.readFileSync(path.join(root,'index.mjs'),'utf8').replace(/^import .*;\n/gm,'');
fs.writeFileSync(path.join(root,'worker.js'),economy+'\n'+transport+'\n'+main);
