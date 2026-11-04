// 数据层：两个实现，接口一致
//   LocalStore    —— 单机演示模式，数据存在 localStorage
//   SupabaseStore —— 多人模式，直接调用 Supabase REST 接口（无需 SDK）
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------- 单机演示 ----------
const LS_KEY = 'ba_db_v1';

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, v) { try { localStorage.setItem(key, v); return true; } catch { return false; } }

class LocalStore {
  constructor() { this.mode = 'local'; }
  _db() {
    const raw = safeGet(LS_KEY);
    const db = raw ? JSON.parse(raw) : null;
    return db || { challenges: [], members: [], reviews: [], checkins: [] };
  }
  _save(db) {
    if (!safeSet(LS_KEY, JSON.stringify(db))) throw new Error('浏览器存储空间不足，请在设置里清理后重试');
  }
  async getChallenge(id) {
    const db = this._db();
    const challenge = db.challenges.find(c => c.id === id);
    if (!challenge) return null;
    return {
      challenge,
      members: db.members.filter(m => m.challenge_id === id),
      reviews: db.reviews.filter(r => r.challenge_id === id),
      checkins: db.checkins.filter(k => k.challenge_id === id),
    };
  }
  async listMine(userId) {
    const db = this._db();
    const owned = db.challenges.filter(c => c.owner_id === userId);
    const ids = new Set(db.members.filter(m => m.user_id === userId).map(m => m.challenge_id));
    const approving = db.challenges.filter(c => ids.has(c.id) && c.owner_id !== userId);
    const pack = c => ({
      challenge: c,
      reviews: db.reviews.filter(r => r.challenge_id === c.id),
      checkins: db.checkins.filter(k => k.challenge_id === c.id),
    });
    return { owned: owned.map(pack), approving: approving.map(pack) };
  }
  async createChallenge(c) { const db = this._db(); db.challenges.push(c); this._save(db); return c; }
  async updateChallenge(id, patch) {
    const db = this._db();
    const c = db.challenges.find(x => x.id === id);
    Object.assign(c, patch); this._save(db); return c;
  }
  async join(m) {
    const db = this._db();
    if (!db.members.some(x => x.challenge_id === m.challenge_id && x.user_id === m.user_id)) {
      db.members.push(m); this._save(db);
    }
  }
  async addReview(r) { const db = this._db(); db.reviews.push(r); this._save(db); return r; }
  async addCheckin(k, blob) {
    k.image_url = blob ? await blobToDataUrl(blob) : null;
    const db = this._db(); db.checkins.push(k); this._save(db); return k;
  }
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
  });
}

// ---------- Supabase ----------
class SupabaseStore {
  constructor(url, key) {
    this.mode = 'remote';
    this.url = url.replace(/\/$/, '');
    this.key = key;
  }
  _h(extra = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, ...extra };
  }
  async _req(path, opts = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...opts,
      headers: this._h({ 'Content-Type': 'application/json', ...(opts.headers || {}) }),
    });
    if (!res.ok) throw new Error(`网络请求失败（${res.status}），请稍后重试`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  _list(table, query) { return this._req(`${table}?${query}`); }
  _insert(table, row) {
    return this._req(table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  }
  async getChallenge(id) {
    const q = encodeURIComponent(id);
    const [cs, members, reviews, checkins] = await Promise.all([
      this._list('challenges', `id=eq.${q}&select=*`),
      this._list('members', `challenge_id=eq.${q}&select=*`),
      this._list('reviews', `challenge_id=eq.${q}&select=*`),
      this._list('checkins', `challenge_id=eq.${q}&select=*`),
    ]);
    if (!cs.length) return null;
    return { challenge: cs[0], members, reviews, checkins };
  }
  async listMine(userId) {
    const u = encodeURIComponent(userId);
    const [owned, mem] = await Promise.all([
      this._list('challenges', `owner_id=eq.${u}&select=*&order=created_at.desc`),
      this._list('members', `user_id=eq.${u}&select=challenge_id`),
    ]);
    const ids = mem.map(m => m.challenge_id);
    const approving = ids.length
      ? (await this._list('challenges', `id=in.(${ids.map(i => `"${i}"`).join(',')})&select=*`)).filter(c => c.owner_id !== userId)
      : [];
    const all = [...owned, ...approving];
    let reviews = [], checkins = [];
    if (all.length) {
      const inList = `in.(${all.map(c => `"${c.id}"`).join(',')})`;
      [reviews, checkins] = await Promise.all([
        this._list('reviews', `challenge_id=${inList}&select=*`),
        this._list('checkins', `challenge_id=${inList}&select=id,challenge_id,date,attempt,created_at`),
      ]);
    }
    const pack = c => ({
      challenge: c,
      reviews: reviews.filter(r => r.challenge_id === c.id),
      checkins: checkins.filter(k => k.challenge_id === c.id),
    });
    return { owned: owned.map(pack), approving: approving.map(pack) };
  }
  async createChallenge(c) { return (await this._insert('challenges', c))[0]; }
  async updateChallenge(id, patch) {
    const rows = await this._req(`challenges?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
    });
    return rows[0];
  }
  async join(m) {
    await this._req('members?on_conflict=challenge_id,user_id', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(m),
    });
  }
  async addReview(r) { return (await this._insert('reviews', r))[0]; }
  async addCheckin(k, blob) {
    if (blob) {
      const path = `${k.challenge_id}/${k.id}.jpg`;
      const res = await fetch(`${this.url}/storage/v1/object/checkins/${path}`, {
        method: 'POST',
        headers: this._h({ 'Content-Type': 'image/jpeg' }),
        body: blob,
      });
      if (!res.ok) throw new Error(`图片上传失败（${res.status}），请重试`);
      k.image_url = `${this.url}/storage/v1/object/public/checkins/${path}`;
    }
    return (await this._insert('checkins', k))[0];
  }
}

export const store = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? new SupabaseStore(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new LocalStore();
