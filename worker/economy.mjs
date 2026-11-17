// Trusted-server module. Never import this module into the browser.
const OWNER_UID = 'Vyd1sYXrKARaTujn0ucX0XFe0gp2';
const MAX = 1000000000;
function check(ok, message) { if (!ok) throw new Error(message); }
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const balance = n => Number.isSafeInteger(n) && n >= 0 && n <= MAX;

/** db is an Admin SDK Firestore instance. authUid MUST come from verified auth. */
async function transactEconomy(db, authUid, input, serverTimestamp) {
  check(validId(authUid), 'unauthenticated');
  check(input && ['buy', 'admin-add', 'admin-set'].includes(input.type), 'invalid-type');
  check(validId(input.operationId) && input.operationId.length >= 16, 'invalid-operation');
  const type = input.type;
  const uid = type === 'buy' ? authUid : input.targetUid;
  check(validId(uid), 'invalid-target');
  const itemId = type === 'buy' ? input.itemId : null;
  if (type === 'buy') check(validId(itemId), 'invalid-item');
  else {
    check(balance(input.amount), 'invalid-amount');
    check(type !== 'admin-add' || input.amount > 0, 'invalid-amount');
    check(typeof input.reason === 'string' && input.reason.trim().length >= 3 && input.reason.length <= 300, 'invalid-reason');
  }
  const request = {type, uid, itemId, amount:type === 'buy' ? null : input.amount, reason:type === 'buy' ? '' : input.reason.trim()};
  const fingerprint = JSON.stringify(request);
  const user = db.doc(`users/${uid}`), actor = db.doc(`users/${authUid}`);
  const wallet = db.doc(`users/${uid}/economy/wallet`);
  // Actor-scoped key prevents one administrator colliding with another's retry ID.
  const receiptId = `${authUid}_${input.operationId}`;
  const receipt = db.doc(`users/${uid}/economyOperations/${receiptId}`);
  return db.runTransaction(async tx => {
    const actorSnap = await tx.get(actor);
    const actorData = actorSnap.data() || {};
    check(actorSnap.exists && actorData.status !== 'banned', 'access-denied');
    if(type !== 'buy') check(authUid === OWNER_UID || actorData.role === 'admin', 'admin-required');
    const prior = await tx.get(receipt);
    if(prior.exists) {
      check(prior.data().fingerprint === fingerprint, 'operation-conflict');
      return prior.data().result;
    }
    const userSnap = await tx.get(user), walletSnap = await tx.get(wallet);
    check(userSnap.exists && userSnap.data().status !== 'banned', 'target-unavailable');
    check(walletSnap.exists && walletSnap.data().version === 1, 'migration-required');
    const old = walletSnap.data();
    check(balance(old.balance) && balance(old.totalEarned), 'invalid-wallet');
    let after, ownedRef, quantity, def;
    if(type === 'buy') {
      const catalog = await tx.get(db.doc(`catalog/${itemId}`));
      check(catalog.exists, 'item-unavailable');def = catalog.data();
      check(def.active === true && balance(def.price) && Number.isSafeInteger(def.maxQty) && def.maxQty > 0, 'invalid-catalog');
      ownedRef = db.doc(`users/${uid}/ownedItems/${itemId}`);
      const owned = await tx.get(ownedRef);quantity = owned.exists ? owned.data().quantity : 0;
      check(Number.isSafeInteger(quantity) && quantity >= 0 && quantity < def.maxQty, 'quantity-limit');
      check(old.balance >= def.price, 'insufficient-funds');after = old.balance - def.price;
    } else after = type === 'admin-set' ? input.amount : old.balance + input.amount;
    check(balance(after), 'balance-limit');
    const earned = old.totalEarned + Math.max(0, after-old.balance);
    check(balance(earned), 'earned-limit');
    const result = {balance:after,delta:after-old.balance,...(type==='buy'?{itemId,quantity:quantity+1}:{})};
    const createdAt = serverTimestamp();
    tx.update(wallet, {balance:after,totalEarned:earned,updatedAt:createdAt});
    if(ownedRef)tx.set(ownedRef,{quantity:quantity+1,updatedAt:createdAt});
    tx.create(receipt,{actorUid:authUid,fingerprint,request,result,createdAt});
    if(type !== 'buy') {
      tx.create(db.doc(`adminLogs/${receiptId}`),{actorUid:authUid,targetUid:uid,type,requestedValue:input.amount,before:old.balance,after,reason:request.reason,createdAt});
      tx.create(db.doc(`users/${uid}/notifications/${receiptId}`),{type:'personal',content:`Số dư được quản trị viên điều chỉnh thành ${after} xu. ${request.reason}`,createdAt});
    }
    return result;
  });
}


export {transactEconomy};
