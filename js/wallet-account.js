import { collection, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, getAccountAccess, getCurrentUser, onAccountAccessChange } from './cloud.js';
import { sendWalletCommand } from './wallet-api.js';

let account = null;
const listeners = new Set();
const inFlight = new Set();
const terminal = new Set(['insufficient-funds', 'quantity-limit', 'item-unavailable', 'operation-conflict']);
const publish = () => listeners.forEach(listener => listener());

export function startWalletAccount() {
  const connect = access => {
    const eligible = access.ready && access.economyVersion === 1 && access.status !== 'banned';
    if (eligible && account?.uid === access.uid) return;
    account?.stop.forEach(stop => stop());
    account = null;
    if (eligible) {
      const db = firebaseDb();
      const current = { uid: access.uid, balance: null, owned: new Map(), catalog: new Map(), stop: [] };
      account = current;
      const watch = (ref, apply, clear) => onSnapshot(ref, snapshot => {
        if (account !== current) return;
        apply(snapshot);
        publish();
      }, () => {
        if (account !== current) return;
        clear();
        publish();
      });
      current.stop.push(
        watch(doc(db, 'users', access.uid, 'economy', 'wallet'), snapshot => {
          const wallet = snapshot.data();
          current.balance = wallet?.version === 1 && Number.isSafeInteger(wallet.balance) && wallet.balance >= 0
            ? wallet.balance : null;
        }, () => { current.balance = null; }),
        watch(collection(db, 'users', access.uid, 'ownedItems'), snapshot => {
          current.owned = new Map(snapshot.docs.flatMap(row => {
            const { quantity } = row.data();
            return Number.isSafeInteger(quantity) && quantity > 0 ? [[row.id, quantity]] : [];
          }));
        }, () => { current.owned = new Map(); }),
        watch(collection(db, 'catalog'), snapshot => {
          current.catalog = new Map(snapshot.docs.flatMap(row => {
            const item = row.data();
            return item.active === true && Number.isSafeInteger(item.price) && item.price >= 0
              && Number.isSafeInteger(item.maxQty) && item.maxQty > 0 ? [[row.id, item]] : [];
          }));
        }, () => { current.catalog = new Map(); }),
      );
    }
    publish();
  };
  onAccountAccessChange(connect);
  connect(getAccountAccess());
}

export function subscribeWallet(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function walletMode() {
  const uid = getCurrentUser()?.uid;
  if (!uid) return 'legacy';
  const access = getAccountAccess();
  if (access.uid !== uid || !access.ready || access.status === 'banned') return 'unavailable';
  return access.economyVersion === 1 ? 'server' : 'legacy';
}

function currentWallet() {
  return walletMode() === 'server' && account?.uid === getCurrentUser()?.uid ? account : null;
}

export function displayedBalance(legacy) {
  return walletMode() === 'legacy' ? legacy : currentWallet()?.balance ?? null;
}

export function ownedRecords(legacy) {
  return walletMode() === 'legacy' ? legacy : Object.fromEntries(currentWallet()?.owned || []);
}

export function ownedCount(itemId, legacy) {
  return walletMode() === 'legacy' ? legacy[itemId] || 0 : currentWallet()?.owned.get(itemId) || 0;
}

export function walletOffer(item) {
  return walletMode() === 'legacy' ? item : currentWallet()?.catalog.get(item.id);
}

function purchaseKey(uid, itemId) {
  return `goc-hoc-nho:pending-purchase:${uid}:${itemId}`;
}

export function hasPendingPurchase(itemId) {
  const wallet = currentWallet();
  if (!wallet) return false;
  try { return !!localStorage.getItem(purchaseKey(wallet.uid, itemId)); }
  catch { return false; }
}

export async function buyForWallet(itemId) {
  const wallet = currentWallet();
  if (!wallet || (!wallet.catalog.has(itemId) && !hasPendingPurchase(itemId))) {
    throw new Error('Chưa tải được giá vật phẩm từ cửa hàng.');
  }
  const key = purchaseKey(wallet.uid, itemId);
  if (inFlight.has(key)) throw new Error('Đang xử lý lượt mua này.');
  const operationId = localStorage.getItem(key) || crypto.randomUUID();
  localStorage.setItem(key, operationId);
  inFlight.add(key);
  try {
    const result = await sendWalletCommand(wallet.uid, { type: 'buy', itemId, operationId });
    localStorage.removeItem(key);
    return result;
  } catch (error) {
    if (terminal.has(error.code)) localStorage.removeItem(key);
    throw error;
  } finally {
    inFlight.delete(key);
  }
}
