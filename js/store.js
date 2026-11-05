// 数据层：两个实现，接口一致
//   LocalStore    —— 单机演示模式，数据存在 localStorage
//   SupabaseStore —— 多人模式，直接调用 Supabase REST 接口（无需 SDK）
// 表：cards（集戳卡）· buddies（戳戳搭子）· checkins（打卡）· stamps（戳）· raises（加 2 格）
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261106';

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const TABLES = ['cards', 'buddies', 'checkins', 'stamps', 'raises'];

// ---------- 单机演示 ----------
const LS_KEY = 'jgcc_db_v1';
function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, v) { try { localStorage.setItem(key, v); return true; } catch { return false; } }

class LocalStore {
  constructor() { this.mode = 'local'; }
  _db() {
    const raw = safeGet(LS_KEY);
    const db = raw ? JSON.parse(raw) : {};
    for (const t of TABLES) db[t] = db[t] || [];
    return db;
  }
  _save(db) { if (!safeSet(LS_KEY, JSON.stringify(db))) throw new Error('手机存储空间不够了，清理一下浏览器缓存再试'); }
  _pack(db, card) {
    const of = t => db[t].filter(x => x.card_id === card.id);
    return { card, buddies: of('buddies'), checkins: of('checkins'), stamps: of('stamps'), raises: of('raises') };
  }
  async getCard(id) {
    const db = this._db();
    const card = db.cards.find(c => c.id === id);
    return card ? this._pack(db, card) : null;
  }
  async listMine(userId) {
    const db = this._db();
    const ids = new Set(db.buddies.filter(b => b.user_id === userId).map(b => b.card_id));
    return {
      owned: db.cards.filter(c => c.owner_id === userId).map(c => this._pack(db, c)),
      buddying: db.cards.filter(c => ids.has(c.id) && c.owner_id !== userId).map(c => this._pack(db, c)),
    };
  }
  async insert(table, row) { const db = this._db(); db[table].push(row); this._save(db); return row; }
  async update(table, id, patch) {
    const db = this._db();
    const row = db[table].find(x => x.id === id);
    Object.assign(row, patch); this._save(db); return row;
  }
  async addBuddy(b) {
    const db = this._db();
    if (!db.buddies.some(x => x.card_id === b.card_id && x.user_id === b.user_id)) { db.buddies.push(b); this._save(db); }
  }
  async addCheckin(k, blob) {
    k.image_url = blob ? await blobToDataUrl(blob) : null;
    return this.insert('checkins', k);
  }
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
}

// ---------- Supabase ----------
class SupabaseStore {
  constructor(url, key) { this.mode = 'remote'; this.url = url.replace(/\/$/, ''); this.key = key; }
  // 旧版 anon key 是 JWT（eyJ 开头），要同时放在 Authorization 里；新版 publishable key（sb_publishable_ 开头）只放 apikey
  _h(extra = {}) {
    const h = { apikey: this.key, ...extra };
    if (this.key.startsWith('eyJ')) h.Authorization = `Bearer ${this.key}`;
    return h;
  }
  async _req(path, opts = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, { ...opts, headers: this._h({ 'Content-Type': 'application/json', ...(opts.headers || {}) }) });
    if (!res.ok) throw new Error(`网络开小差了（${res.status}），稍后再试`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  _list(table, query) { return this._req(`${table}?${query}`); }
  async _byCards(ids) {
    if (!ids.length) return { buddies: [], checkins: [], stamps: [], raises: [] };
    const inList = `in.(${ids.map(i => `"${i}"`).join(',')})`;
    const [buddies, checkins, stamps, raises] = await Promise.all(
      ['buddies', 'checkins', 'stamps', 'raises'].map(t => this._list(t, `card_id=${inList}&select=*`)));
    return { buddies, checkins, stamps, raises };
  }
  _pack(card, rel) {
    const of = t => rel[t].filter(x => x.card_id === card.id);
    return { card, buddies: of('buddies'), checkins: of('checkins'), stamps: of('stamps'), raises: of('raises') };
  }
  async getCard(id) {
    const cs = await this._list('cards', `id=eq.${encodeURIComponent(id)}&select=*`);
    if (!cs.length) return null;
    return this._pack(cs[0], await this._byCards([cs[0].id]));
  }
  async listMine(userId) {
    const u = encodeURIComponent(userId);
    const [owned, mine] = await Promise.all([
      this._list('cards', `owner_id=eq.${u}&select=*&order=created_at.desc`),
      this._list('buddies', `user_id=eq.${u}&select=card_id`),
    ]);
    const bIds = mine.map(m => m.card_id);
    const buddying = bIds.length ? (await this._list('cards', `id=in.(${bIds.map(i => `"${i}"`).join(',')})&select=*`)).filter(c => c.owner_id !== userId) : [];
    const rel = await this._byCards([...owned, ...buddying].map(c => c.id));
    return { owned: owned.map(c => this._pack(c, rel)), buddying: buddying.map(c => this._pack(c, rel)) };
  }
  async insert(table, row) { return (await this._req(table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }))[0]; }
  async update(table, id, patch) {
    return (await this._req(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) }))[0];
  }
  async addBuddy(b) {
    await this._req('buddies?on_conflict=card_id,user_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(b) });
  }
  async addCheckin(k, blob) {
    if (blob) {
      const path = `${k.card_id}/${k.id}.jpg`;
      const res = await fetch(`${this.url}/storage/v1/object/checkins/${path}`, { method: 'POST', headers: this._h({ 'Content-Type': 'image/jpeg' }), body: blob });
      if (!res.ok) throw new Error(`照片没传上去（${res.status}），再试一次`);
      k.image_url = `${this.url}/storage/v1/object/public/checkins/${path}`;
    }
    return this.insert('checkins', k);
  }
}

export const store = (SUPABASE_URL && SUPABASE_ANON_KEY) ? new SupabaseStore(SUPABASE_URL, SUPABASE_ANON_KEY) : new LocalStore();
