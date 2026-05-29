/**
 * Skill Sync - APP 启动时从 GitHub 拉取最新训练成果
 *
 * 数据流:
 *   GitHub Actions 定时训练 → data/skills.json → git push
 *   APP 启动 → fetch(Raw URL) → 同步到本地 → 优化时自动使用
 */

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/jinzechen/BatteryPackOptimizer-/main/data/skills.json';
const LOCAL_CACHE_KEY = 'synced_skills';
const SYNC_META_KEY = 'sync_meta';
const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes cache

export class SkillSync {
  constructor() {
    this.skills = [];
    this.stats = null;
    this.lastSync = null;
    this.syncStatus = 'idle'; // idle, syncing, success, error
  }

  // ====== 启动时调用 ======
  async init() {
    // 1. 先加载本地缓存（确保 APP 立即有数据）
    await this._loadLocalCache();
    console.log(`[SkillSync] Loaded ${this.skills.length} skills from local cache`);

    // 2. 后台静默同步最新数据（不阻塞 UI）
    this._backgroundSync();

    return this.skills;
  }

  // ====== 后台同步 ======
  async _backgroundSync() {
    // 检查缓存是否过期
    const meta = await this._getLocal(SYNC_META_KEY);
    if (meta && (Date.now() - meta.lastSync) < CACHE_MAX_AGE) {
      console.log('[SkillSync] Cache still fresh, skip sync');
      return;
    }

    this.syncStatus = 'syncing';

    try {
      console.log('[SkillSync] Fetching latest skills from GitHub...');
      const resp = await fetch(`${GITHUB_RAW_URL}?t=${Date.now()}`);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();

      if (!data.skills || !Array.isArray(data.skills)) {
        throw new Error('Invalid skills data format');
      }

      // 合并：GitHub 数据为主，本地独有数据补充
      const githubRules = new Set(data.skills.map(s => s.rule));
      const localOnly = this.skills.filter(s =>
        s.source === 'local-feedback' && !githubRules.has(s.rule)
      );

      this.skills = [...data.skills, ...localOnly];
      this.stats = data.stats;
      this.lastSync = new Date().toISOString();
      this.syncStatus = 'success';

      // 持久化到本地
      await this._saveLocalCache();
      await this._setLocal(SYNC_META_KEY, {
        lastSync: Date.now(),
        version: data.version,
        skillCount: this.skills.length,
      });

      console.log(`[SkillSync] Synced v${data.version}: ${data.skills.length} remote + ${localOnly.length} local = ${this.skills.length} total`);

      // 通知 UI
      this._notifyUI();

    } catch (e) {
      this.syncStatus = 'error';
      console.warn('[SkillSync] Sync failed (using cached data):', e.message);
    }
  }

  // ====== 手动强制同步 ======
  async forceSync() {
    await this._setLocal(SYNC_META_KEY, null);
    await this._backgroundSync();
    return {
      status: this.syncStatus,
      skillCount: this.skills.length,
      stats: this.stats,
    };
  }

  // ====== Skills 查询接口 ======
  query(context) {
    if (!context || this.skills.length === 0) return [];

    const keywords = context.toLowerCase().split(/\s+/).filter(k => k.length > 1);

    return this.skills
      .map(skill => {
        const combined = `${skill.rule} ${skill.condition} ${skill.category} ${skill.action} ${skill.cellType || ''}`.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (combined.includes(kw)) score++;
        }
        return { ...skill, relevanceScore: score };
      })
      .filter(s => s.relevanceScore > 0)
      .sort((a, b) => {
        const scoreA = a.relevanceScore * (a.confidence || 0.5) * Math.log2(2 + (a.hits || 0));
        const scoreB = b.relevanceScore * (b.confidence || 0.5) * Math.log2(2 + (b.hits || 0));
        return scoreB - scoreA;
      })
      .slice(0, 10);
  }

  // ====== 记录用户反馈（本地保留，下次训练时收集） ======
  async addLocalFeedback(feedback) {
    const fb = {
      ...feedback,
      id: `fb_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'local-feedback',
    };

    // 保存反馈
    const feedbacks = await this._getLocal('user_feedbacks') || [];
    feedbacks.push(fb);
    await this._setLocal('user_feedbacks', feedbacks);

    // 如果有 API，尝试即时学习
    try {
      const { aiAgent } = await import('./ai-agent.js');
      if (aiAgent.isConfigured() && feedbacks.length >= 3) {
        const newSkills = await aiAgent.learnFromFeedback();
        if (newSkills) {
          for (const s of newSkills) {
            s.source = 'local-feedback';
            this.skills.push(s);
          }
          await this._saveLocalCache();
        }
      }
    } catch (e) {
      // AI not configured, that's OK
    }
  }

  // ====== 持久化 ======
  async _saveLocalCache() {
    await this._setLocal(LOCAL_CACHE_KEY, {
      skills: this.skills,
      stats: this.stats,
      cachedAt: Date.now(),
    });
  }

  async _loadLocalCache() {
    const cache = await this._getLocal(LOCAL_CACHE_KEY);
    if (cache) {
      this.skills = cache.skills || [];
      this.stats = cache.stats || null;
    }
  }

  // ====== 存储抽象层 ======
  async _setLocal(key, value) {
    const str = value ? JSON.stringify(value) : null;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      if (str) {
        await Preferences.set({ key, value: str });
      } else {
        await Preferences.remove({ key });
      }
    } catch {
      if (str) localStorage.setItem(key, str);
      else localStorage.removeItem(key);
    }
  }

  async _getLocal(key) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const r = await Preferences.get({ key });
      return r.value ? JSON.parse(r.value) : null;
    } catch {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    }
  }

  // ====== UI 通知 ======
  _notifyUI() {
    window.dispatchEvent(new CustomEvent('skills-synced', {
      detail: {
        count: this.skills.length,
        stats: this.stats,
        status: this.syncStatus,
      }
    }));
  }

  // ====== 状态信息 ======
  getStatus() {
    return {
      status: this.syncStatus,
      skillCount: this.skills.length,
      stats: this.stats,
      lastSync: this.lastSync,
    };
  }
}

export const skillSync = new SkillSync();
