/**
 * AI Agent - 自我成长的电池优化智能体
 * 通过 API 调用大模型，结合本地 Skill 库进行智能优化
 */

const AI_CONFIG_KEY = 'ai_config';
const SKILLS_KEY = 'ai_skills';
const FEEDBACK_KEY = 'ai_feedback';
const LEARNING_LOG_KEY = 'ai_learning_log';

// 默认配置
const DEFAULT_CONFIG = {
  apiEndpoint: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  enabled: false,
  autoOptimize: false,
  iterationCycle: 'weekly', // daily, weekly, monthly
};

export class AIAgent {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.skills = [];
    this.feedbackHistory = [];
    this.learningLog = [];
    this.ready = false;
  }

  // ========== 初始化 ==========

  async init() {
    try {
      const { Preferences } = await import('@capacitor/preferences');

      const saved = await Preferences.get({ key: AI_CONFIG_KEY });
      if (saved.value) {
        Object.assign(this.config, JSON.parse(saved.value));
      }

      const skills = await Preferences.get({ key: SKILLS_KEY });
      if (skills.value) {
        this.skills = JSON.parse(skills.value);
      }

      const feedback = await Preferences.get({ key: FEEDBACK_KEY });
      if (feedback.value) {
        this.feedbackHistory = JSON.parse(feedback.value);
      }

      const log = await Preferences.get({ key: LEARNING_LOG_KEY });
      if (log.value) {
        this.learningLog = JSON.parse(log.value);
      }

      this.ready = true;
    } catch (e) {
      console.warn('AI Agent init fallback to localStorage:', e);
      this.config = this._loadLocal(AI_CONFIG_KEY, DEFAULT_CONFIG);
      this.skills = this._loadLocal(SKILLS_KEY, []);
      this.feedbackHistory = this._loadLocal(FEEDBACK_KEY, []);
      this.learningLog = this._loadLocal(LEARNING_LOG_KEY, []);
      this.ready = true;
    }
  }

  _loadLocal(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }

  async _saveLocal(key, data) {
    const str = JSON.stringify(data);
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value: str });
    } catch {
      localStorage.setItem(key, str);
    }
  }

  // ========== 配置管理 ==========

  async saveConfig(newConfig) {
    Object.assign(this.config, newConfig);
    await this._saveLocal(AI_CONFIG_KEY, this.config);
  }

  isConfigured() {
    return this.config.enabled && this.config.apiEndpoint && this.config.apiKey;
  }

  // ========== API 调用 ==========

  async callAI(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('AI 未配置。请先在设置中填写 API 地址和密钥。');
    }

    const { temperature = 0.7, maxTokens = 2048 } = options;

    const body = {
      model: this.config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const resp = await fetch(`${this.config.apiEndpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`AI API 错误 (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    return data.choices[0].message.content;
  }

  // ========== Skill 系统（自我成长核心） ==========

  /**
   * 从反馈中学习，生成新 Skill
   */
  async learnFromFeedback() {
    if (this.feedbackHistory.length < 3) return null;

    const recentFeedback = this.feedbackHistory.slice(-10);

    const prompt = `你是一个电池包优化专家系统的学习模块。

以下是用户对最近优化结果的反馈记录：
${JSON.stringify(recentFeedback, null: 2)}

已有 Skills：
${this.skills.map((s, i) => `${i + 1}. [${s.category}] ${s.rule} (命中 ${s.hits} 次, 置信度 ${(s.confidence * 100).toFixed(0)}%)`).join('\n')}

请分析这些反馈，提取可复用的优化规律。返回 JSON 数组，每项格式：
{
  "category": "thermal|cost|energy|structural|safety",
  "rule": "简明的优化规则描述",
  "condition": "触发条件描述",
  "action": "建议的优化动作",
  "confidence": 0.0-1.0,
  "reasoning": "推理依据"
}

只返回新的、不重复的 Skill。如果无法提取有意义的规律，返回空数组 []。
只返回 JSON，不要其他文字。`;

    try {
      const result = await this.callAI([
        { role: 'system', content: '你是一个专业的电池系统优化学习引擎。只返回 JSON。' },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = result.match(/$$[\s\S]*$$/);
      if (!jsonMatch) return [];

      const newSkills = JSON.parse(jsonMatch[0]);

      for (const skill of newSkills) {
        skill.id = `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        skill.createdAt = new Date().toISOString();
        skill.hits = 0;
        this.skills.push(skill);
      }

      await this._saveLocal(SKILLS_KEY, this.skills);

      this.learningLog.push({
        timestamp: new Date().toISOString(),
        type: 'learn',
        feedbackCount: recentFeedback.length,
        newSkillsCount: newSkills.length,
        totalSkills: this.skills.length,
      });
      await this._saveLocal(LEARNING_LOG_KEY, this.learningLog);

      return newSkills;
    } catch (e) {
      console.error('学习过程出错:', e);
      return null;
    }
  }

  /**
   * 匹配相关 Skills
   */
  matchSkills(context) {
    const keywords = context.toLowerCase();
    return this.skills
      .filter(s => {
        const combined = `${s.rule} ${s.condition} ${s.category}`.toLowerCase();
        return keywords.split(/\s+/).some(k => k.length > 2 && combined.includes(k));
      })
      .sort((a, b) => b.confidence * b.hits - a.confidence * a.hits);
  }

  /**
   * 记录 Skill 命中
   */
  async hitSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (skill) {
      skill.hits++;
      skill.confidence = Math.min(1, skill.confidence + 0.02);
      await this._saveLocal(SKILLS_KEY, this.skills);
    }
  }

  // ========== 智能优化（核心功能） ==========

  /**
   * AI 辅助优化电池包方案
   */
  async optimizeWithAI(params, currentResult) {
    const matchedSkills = this.matchSkills(
      `${params.cellModel || ''} ${params.arrangement || ''} ${params.cooling || ''}`
    );

    matchedSkills.forEach(s => this.hitSkill(s.id));

    const skillContext = matchedSkills.length > 0
      ? `\n基于历史学习的优化建议：\n${matchedSkills.map(s =>
        `- [${s.category}] ${s.rule} → ${s.action} (置信度 ${(s.confidence * 100).toFixed(0)}%)`
      ).join('\n')}`
      : '';

    const systemPrompt = `你是一个高级电池包优化专家系统。
你的任务是分析电池包设计方案，给出专业、具体、可执行的优化建议。

分析维度：
1. 热管理 - 温度分布、散热效率、热失控风险
2. 能量密度 - Wh/kg, Wh/L 的提升空间
3. 成本控制 - BOM 成本、制造工艺优化
4. 结构安全 - 机械强度、振动、碰撞防护
5. 电气性能 - 内阻匹配、BMS 均衡、SOC 估算精度
6. 寿命优化 - 循环寿命、日历寿命、衰减策略

输出要求：
- 优先级排序（高/中/低）
- 每条建议包含：问题描述、改进方案、预期收益、实施难度
- 量化数据尽可能精确
${skillContext}`;

    const userPrompt = `当前电池包设计参数：
${JSON.stringify(params, null, 2)}

当前优化结果：
${JSON.stringify(currentResult, null, 2)}

请基于以上信息进行深度分析，给出优化建议。返回 JSON 格式：
{
  "overallScore": 0-100,
  "optimizations": [
    {
      "priority": "high|medium|low",
      "category": "thermal|cost|energy|structural|electrical|lifespan",
      "title": "简短标题",
      "problem": "问题描述",
      "solution": "改进方案",
      "expectedBenefit": "预期收益",
      "difficulty": "easy|medium|hard",
      "estimatedImpact": "量化影响估算"
    }
  ],
  "summary": "整体优化总结",
  "nextSteps": ["建议的下一步操作"]
}
只返回 JSON。`;

    const result = await this.callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 返回格式异常');

    return JSON.parse(jsonMatch[0]);
  }

  // ========== 反馈系统 ==========

  async recordFeedback(feedback) {
    this.feedbackHistory.push({
      ...feedback,
      id: `fb_${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
    await this._saveLocal(FEEDBACK_KEY, this.feedbackHistory);

    // 每积累 5 条反馈自动学习一次
    if (this.feedbackHistory.length % 5 === 0 && this.isConfigured()) {
      await this.learnFromFeedback();
    }
  }

  getFeedbackStats() {
    const total = this.feedbackHistory.length;
    const positive = this.feedbackHistory.filter(f => f.rating >= 4).length;
    const avgRating = total > 0
      ? (this.feedbackHistory.reduce((s, f) => s + (f.rating || 0), 0) / total).toFixed(1)
      : 0;
    return { total, positive, avgRating, skillCount: this.skills.length };
  }

  // ========== 自我迭代（生成改进版算法） ==========

  /**
   * 基于 Skill 库和反馈，生成优化后的算法参数
   */
  async generateImprovedAlgorithm(currentAlgo) {
    const systemPrompt = `你是一个算法优化引擎。
你需要基于历史 Skills 和反馈数据，对现有的电池包优化算法进行改进。

要求：
1. 保留原算法的核心逻辑
2. 根据高频命中的 Skills 调整权重和阈值
3. 根据用户反馈修正不合理的设计决策
4. 输出改进后的算法参数（不改变代码结构，只调整参数和策略）
5. 明确标注修改了哪些参数以及修改原因`;

    const userPrompt = `当前算法核心参数：
${JSON.stringify(currentAlgo, null: 2)}

活跃 Skills（按命中次数排序）：
${this.skills
  .sort((a, b) => b.hits - a.hits)
  .slice(0, 20)
  .map(s => `- [${s.category}] ${s.rule} → ${s.action} (命中${s.hits}, 置信度${(s.confidence * 100).toFixed(0)}%)`)
  .join('\n')}

近期反馈摘要：
${this.feedbackHistory.slice(-10).map(f =>
  `- 评分:${f.rating}/5 | ${f.comment || '无评论'} | 参数:${JSON.stringify(f.params || {})}`
).join('\n')}

请生成改进后的算法参数配置，返回 JSON：
{
  "parameters": { ... },
  "changes": [
    {
      "parameter": "参数名",
      "oldValue": "旧值",
      "newValue": "新值",
      "reason": "修改原因"
    }
  ],
  "confidence": 0.0-1.0,
  "expectedImprovement": "预期改进描述"
}
只返回 JSON。`;

    const result = await this.callAI([
      { role: 'system', content: '你是算法优化引擎。只返回 JSON。' },
      { role: 'user', content: userPrompt }
    ]);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 返回格式异常');

    return JSON.parse(jsonMatch[0]);
  }

  // ========== 自动推送迭代（生成更新报告） ==========

  async generateUpdateReport() {
    const stats = this.getFeedbackStats();
    const recentSkills = this.skills.filter(s => {
      const age = (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return age <= 7;
    });

    return {
      title: `BatteryPackOptimizer v${this._getNextVersion()}`,
      date: new Date().toISOString(),
      stats,
      newSkills: recentSkills,
      learningLog: this.learningLog.slice(-5),
      improvements: recentSkills.map(s => ({
        category: s.category,
        description: s.rule,
        confidence: s.confidence,
      })),
    };
  }

  _getNextVersion() {
    try {
      const stored = localStorage.getItem('app_version') || '1.0.0';
      const [major, minor, patch] = stored.split('.').map(Number);
      return `${major}.${minor}.${patch + 1}`;
    } catch {
      return '1.0.1';
    }
  }

  // ========== 重置/导出 ==========

  async exportData() {
    return {
      config: { ...this.config, apiKey: '***' },
      skills: this.skills,
      feedback: this.feedbackHistory,
      learningLog: this.learningLog,
      exportedAt: new Date().toISOString(),
    };
  }

  async resetLearning() {
    this.skills = [];
    this.feedbackHistory = [];
    this.learningLog = [];
    await this._saveLocal(SKILLS_KEY, []);
    await this._saveLocal(FEEDBACK_KEY, []);
    await this._saveLocal(LEARNING_LOG_KEY, []);
  }
}

// 单例
export const aiAgent = new AIAgent();
