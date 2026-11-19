import { readFile, writeFile } from 'node:fs/promises';
import { catalogPlan, planWallet } from './wallet-plan.mjs';
import { applyWallet, emulator, planSnapshot, restoreWallet, seedCatalog, snapshotWallet } from './wallet-emulator.mjs';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n', {flag:'wx', mode:0o600});
const [, , command, ...args] = process.argv;
const help = `node scripts/wallet-migration.mjs
  plan <profile.json hoặc backup.json> <plan.json>
  catalog <catalog.json>
  snapshot <demo-project> <uid> <backup.json>
  apply <backup.json>
  restore <backup.json>
  seed-catalog <demo-project>`;

try {
  if (command === 'plan' && args.length === 2) {
    const source = await readJson(args[0]);
    const plan = source.format === 1 ? planSnapshot(source) : planWallet(source);
    await save(args[1], plan);
    console.log(JSON.stringify({summary:plan.summary,warnings:plan.warnings}, null, 2));
  } else if (command === 'catalog' && args.length === 1) {
    await save(args[0], catalogPlan());
  } else if (command === 'snapshot' && args.length === 3) {
    await save(args[2], await snapshotWallet(emulator(args[0]), args[1]));
  } else if ((command === 'apply' || command === 'restore') && args.length === 1) {
    const backup = await readJson(args[0]);
    const action = command === 'apply' ? applyWallet : restoreWallet;
    const writes = await action(emulator(backup.projectId), backup);
    console.log(`${writes} thay đổi trong Firestore emulator.`);
  } else if (command === 'seed-catalog' && args.length === 1) {
    console.log(`${await seedCatalog(emulator(args[0]))} vật phẩm mới trong Firestore emulator.`);
  } else {
    console.error(help);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
