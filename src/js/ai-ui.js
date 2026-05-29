/**
 * AI UI - 设置面板、优化结果展示、反馈收集
 */
import { aiAgent } from './ai-agent.js';

export class AIUI {
  constructor() {
    this.panel = null;
    this.resultPanel = null;
  }

  init() {
    this._injectStyles();
    this._createSettingsButton();
    this._createSettingsPanel();
    this._createResultPanel();
    aiAgent.init();
  }

  // ========== 样式注入 ==========

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* AI 设置按钮 */
      .ai-fab {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        z-index: 1000;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ai-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(99, 102, 241, 0.6); }
      .ai-fab.has-new { animation: ai-pulse 2s infinite; }
      @keyframes ai-pulse {
        0%, 100% { box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4); }
        50% { box-shadow: 0 4px 30px rgba(99, 102, 241, 0.8); }
      }

      /* 面板通用 */
      .ai-panel {
        position: fixed;
        top: 0;
        right: -480px;
        width: 460px;
        max-width: 100vw;
        height: 100vh;
        background: #0f0f14;
        border-left: 1px solid rgba(255,255,255,0.08);
        z-index: 2000;
        transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        overflow-y: auto;
        font-family: 'DM Mono', monospace;
      }
      .ai-panel.open { right: 0; }
      .ai-panel-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 1999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
      }
      .ai-panel-overlay.visible { opacity: 1; pointer-events: auto; }

      /* 面板头部 */
      .ai-panel-header {
        padding: 24px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05));
      }
      .ai-panel-header h2 {
        margin: 0;
        font-size: 18px;
        color: #e0e0e0;
        font-weight: 600;
      }
      .ai-panel-header .close-btn {
        background: none;
        border: 1px solid rgba(255,255,255,0.1);
        color: #888;
        font-size: 20px;
        cursor: pointer;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .ai-panel-header .close-btn:hover { color: #fff; border-color: rgba(255,255,255,0.3); }

      /* 表单元素 */
      .ai-form-group {
        padding: 16px 24px;
      }
      .ai-form-group label {
        display: block;
        font-size: 12px;
        color: #888;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .ai-form-group input,
      .ai-form-group select {
        width: 100%;
        padding: 10px 14px;
        background: #1a1a24;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: #e0e0e0;
        font-family: inherit;
        font-size: 14px;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }
      .ai-form-group input:focus,
      .ai-form-group select:focus {
        outline: none;
        border-color: #6366f1;
      }
      .ai-form-group .hint {
        font-size: 11px;
        color: #555;
        margin-top: 4px;
      }

      /* 开关 */
      .ai-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
      }
      .ai-toggle label { font-size: 14px; color: #ccc; }
      .ai-switch {
        width: 48px;
        height: 26px;
        background: #2a2a3a;
        border-radius: 13px;
        position: relative;
        cursor: pointer;
        transition: background 0.3s;
      }
      .ai-switch.active { background: #6366f1; }
      .ai-switch::after {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        top: 3px;
        left: 3px;
        transition: transform 0.3s;
      }
      .ai-switch.active::after { transform: translateX(22px); }

      /* 按钮 */
      .ai-btn {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        font-family: inherit;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }
      .ai-btn-primary {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
      }
      .ai-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
      .ai-btn-secondary {
        background: rgba(255,255,255,0.06);
        color: #aaa;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .ai-btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
      .ai-btn-sm { padding: 6px 12px; font-size: 12px; }

      /* 统计卡片 */
      .ai-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 16px 24px;
      }
      .ai-stat-card {
        background: #1a1a24;
        border-radius: 10px;
        padding: 16px;
        border: 1px solid rgba(255,255,255,0.04);
      }
      .ai-stat-card .value {
        font-size: 28px;
        font-weight: 700;
        color: #6366f1;
        line-height: 1;
      }
      .ai-stat-card .label {
        font-size: 11px;
        color: #666;
        margin-top: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Skill 列表 */
      .ai-skill-item {
        padding: 14px 24px;
        border-bottom: 1px solid rgba(255,255,255,0.03);
      }
      .ai-skill-item .skill-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .ai-skill-item .skill-category {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
      }
      .skill-cat-thermal { background: rgba(239,68,68,0.15); color: #ef4444; }
      .skill-cat-cost { background: rgba(234,179,8,0.15); color: #eab308; }
      .skill-cat-energy { background: rgba(34,197,94,0.15); color: #22c55e; }
      .skill-cat-structural { background: rgba(59,130,246,0.15); color: #3b82f6; }
      .skill-cat-safety { background: rgba(236,72,153,0.15); color: #ec4899; }
      .skill-cat-electrical { background: rgba(168,85,247,0.15); color: #a855f7; }
      .skill-cat-lifespan { background: rgba(20,184,166,0.15); color: #14b8a6; }

      .ai-skill-item .skill-rule {
        font-size: 13px;
        color: #bbb;
        line-height: 1.5;
      }
      .ai-skill-item .skill-meta {
        font-size: 11px;
        color: #555;
        margin-top: 6px;
      }

      /* 优化结果 */
      .ai-opt-card {
        background: #1a1a24;
        border-radius: 10px;
        padding: 16px;
        margin: 8px 0;
        border-left: 3px solid #6366f1;
      }
      .ai-opt-card.priority-high { border-left-color: #ef4444; }
      .ai-opt-card.priority-medium { border-left-color: #eab308; }
      .ai-opt-card.priority-low { border-left-color: #22c55e; }
      .ai-opt-title {
        font-size: 14px;
        font-weight: 600;
        color: #e0e0e0;
        margin-bottom: 8px;
      }
      .ai-opt-detail { font-size: 12px; color: #888; line-height: 1.6; }
      .ai-opt-detail strong { color: #aaa; }

      /* 评分圆环 */
      .ai-score-ring {
        width: 100px;
        height: 100px;
        margin: 0 auto 16px;
        position: relative;
      }
      .ai-score-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .ai-score-ring circle {
        fill: none;
        stroke-width: 8;
        stroke-linecap: round;
      }
      .ai-score-ring .bg { stroke: rgba(255,255,255,0.05); }
      .ai-score-ring .progress { stroke: #6366f1; transition: stroke-dashoffset 1s ease; }
      .ai-score-ring .score-text {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .ai-score-ring .score-num {
        font-size: 28px;
        font-weight: 700;
        color: #6366f1;
      }
      .ai-score-ring .score-label {
        font-size: 10px;
        color: #666;
        text-transform: uppercase;
      }

      /* 五星评分 */
      .ai-rating {
        display: flex;
        gap: 8px;
        padding: 8px 0;
      }
      .ai-rating .star {
        font-size: 32px;
        cursor: pointer;
        color: #333;
        transition: all 0.2s;
        user-select: none;
      }
      .ai-rating .star.active { color: #eab308; }
      .ai-rating .star:hover { transform: scale(1.2); }

      /* 反馈输入 */
      .ai-feedback-input {
        width: 100%;
        padding: 12px;
        background: #1a1a24;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: #e0e0e0;
        font-family: inherit;
        font-size: 13px;
        resize: vertical;
        min-height: 80px;
        box-sizing: border-box;
      }
      .ai-feedback-input:focus { outline: none; border-color: #6366f1; }

      /* Loading 动画 */
      .ai-loading {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      .ai-loading .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(99,102,241,0.2);
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* 区域标题 */
      .ai-section-title {
        padding: 20px 24px 8px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: #555;
        font-weight: 600;
      }

      /* 操作按钮区域 */
      .ai-actions {
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .ai-divider {
        height: 1px;
        background: rgba(255,255,255,0.04);
        margin: 8px 24px;
      }

      /* Tab */
      .ai-tabs {
        display: flex;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        padding: 0 24px;
      }
      .ai-tab {
        padding: 12px 16px;
        font-size: 13px;
        color: #666;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      .ai-tab:hover { color: #aaa; }
      .ai-tab.active { color: #6366f1; border-bottom-color: #6366f1; }
    `;
    document.head.appendChild(style);
  }

  // ========== 设置按钮 ==========

  _createSettingsButton() {
    const btn = document.createElement('button');
    btn.className = 'ai-fab';
    btn.innerHTML = '&#x2728;';
    btn.title = 'AI Agent';
    btn.addEventListener('click', () => this._togglePanel('settings'));
    document.body.appendChild(btn);
  }

  // ========== 设置面板 ==========

  _createSettingsPanel() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'ai-panel-overlay';
    this.overlay.addEventListener('click', () => this._closeAll());
    document.body.appendChild(this.overlay);

    const panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.id = 'ai-settings-panel';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <h2>AI Agent Settings</h2>
        <button class="close-btn" data-close>&times;</button>
      </div>

      <div class="ai-tabs" id="ai-tabs">
        <div class="ai-tab active" data-tab="config">Config</div>
        <div class="ai-tab" data-tab="skills">Skills</div>
        <div class="ai-tab" data-tab="stats">Stats</div>
      </div>

      <!-- 配置页 -->
      <div id="ai-tab-config">
        <div class="ai-form-group">
          <label>API Endpoint</label>
          <input type="text" id="ai-endpoint" placeholder="https://api.openai.com">
          <div class="hint">OpenAI 兼容 API 地址（支持 v1/chat/completions）</div>
        </div>
        <div class="ai-form-group">
          <label>API Key</label>
          <input type="password" id="ai-key" placeholder="sk-...">
        </div>
        <div class="ai-form-group">
          <label>Model</label>
          <input type="text" id="ai-model" placeholder="gpt-4o-mini">
        </div>
        <div class="ai-toggle">
          <label>Enable AI Agent</label>
          <div class="ai-switch" id="ai-enabled-toggle"></div>
        </div>
        <div class="ai-toggle">
          <label>Auto Optimize on Run</label>
          <div class="ai-switch" id="ai-auto-toggle"></div>
        </div>
        <div class="ai-actions">
          <button class="ai-btn ai-btn-primary" id="ai-save-config">Save Config</button>
          <button class="ai-btn ai-btn-secondary" id="ai-test-connection">Test Connection</button>
          <button class="ai-btn ai-btn-secondary" id="ai-reset-learning">Reset Learning Data</button>
        </div>
      </div>

      <!-- Skills 页 -->
      <div id="ai-tab-skills" style="display:none">
        <div id="ai-skills-list"></div>
      </div>

      <!-- 统计页 -->
      <div id="ai-tab-stats" style="display:none">
        <div id="ai-stats-content"></div>
      </div>
    `;
    document.body.appendChild(panel);
    this.panel = panel;

    panel.querySelector('[data-close]').addEventListener('click', () => this._closeAll());

    // Tab 切换
    panel.querySelectorAll('.ai-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        panel.querySelectorAll('[id^="ai-tab-"]').forEach(p => p.style.display = 'none');
        panel.querySelector(`#ai-tab-${tab.dataset.tab}`).style.display = '';
        if (tab.dataset.tab === 'skills') this._renderSkills();
        if (tab.dataset.tab === 'stats') this._renderStats();
      });
    });

    // 开关
    panel.querySelector('#ai-enabled-toggle').addEventListener('click', function () {
      this.classList.toggle('active');
    });
    panel.querySelector('#ai-auto-toggle').addEventListener('click', function () {
      this.classList.toggle('active');
    });

    // 保存配置
    panel.querySelector('#ai-save-config').addEventListener('click', async () => {
      await aiAgent.saveConfig({
        apiEndpoint: panel.querySelector('#ai-endpoint').value.trim(),
        apiKey: panel.querySelector('#ai-key').value.trim(),
        model: panel.querySelector('#ai-model').value.trim() || 'gpt-4o-mini',
        enabled: panel.querySelector('#ai-enabled-toggle').classList.contains('active'),
        autoOptimize: panel.querySelector('#ai-auto-toggle').classList.contains('active'),
      });
      this._toast('Configuration saved');
    });

    // 测试连接
    panel.querySelector('#ai-test-connection').addEventListener('click', async () => {
      const btn = panel.querySelector('#ai-test-connection');
      btn.textContent = 'Testing...';
      btn.disabled = true;
      try {
        // 先保存
        await aiAgent.saveConfig({
          apiEndpoint: panel.querySelector('#ai-endpoint').value.trim(),
          apiKey: panel.querySelector('#ai-key').value.trim(),
          model: panel.querySelector('#ai-model').value.trim() || 'gpt-4o-mini',
          enabled: true,
        });
        const result = await aiAgent.callAI([
          { role: 'user', content: 'Reply with "OK" only.' }
        ], { maxTokens: 10 });
        this._toast(`Connection successful: ${result.trim()}`);
      } catch (e) {
        this._toast(`Connection failed: ${e.message}`, true);
      }
      btn.textContent = 'Test Connection';
      btn.disabled = false;
    });

    // 重置
    panel.querySelector('#ai-reset-learning').addEventListener('click', async () => {
      if (confirm('Clear all learning data? Skills, feedback, and learning logs will be deleted.')) {
        await aiAgent.resetLearning();
        this._toast('Learning data cleared');
        this._renderSkills();
      }
    });
  }

  // ========== 结果面板 ==========

  _createResultPanel() {
    const panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.id = 'ai-result-panel';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <h2 id="ai-result-title">AI Optimization</h2>
        <button class="close-btn" data-close>&times;</button>
      </div>
      <div id="ai-result-body"></div>
    `;
    document.body.appendChild(panel);
    this.resultPanel = panel;

    panel.querySelector('[data-close]').addEventListener('click', () => this._closeAll());
  }

  // ========== 面板控制 ==========

  _togglePanel(type) {
    const panel = type === 'settings'
      ? this.panel
      : this.resultPanel;

    if (panel.classList.contains('open')) {
      this._closeAll();
      return;
    }

    this._closeAll();
    panel.classList.add('open');
    this.overlay.classList.add('visible');

    if (type === 'settings') this._loadSettingsForm();
  }

  _closeAll() {
    this.panel?.classList.remove('open');
    this.resultPanel?.classList.remove('open');
    this.overlay?.classList.remove('visible');
  }

  _loadSettingsForm() {
    const c = aiAgent.config;
    this.panel.querySelector('#ai-endpoint').value = c.apiEndpoint || '';
    this.panel.querySelector('#ai-key').value = c.apiKey || '';
    this.panel.querySelector('#ai-model').value = c.model || 'gpt-4o-mini';

    const enabledToggle = this.panel.querySelector('#ai-enabled-toggle');
    const autoToggle = this.panel.querySelector('#ai-auto-toggle');
    enabledToggle.classList.toggle('active', !!c.enabled);
    autoToggle.classList.toggle('active', !!c.autoOptimize);
  }

  // ========== Skills 渲染 ==========

  _renderSkills() {
    const container = this.panel.querySelector('#ai-skills-list');
    if (aiAgent.skills.length === 0) {
      container.innerHTML = `
        <div class="ai-loading">
          <p style="color:#666">No skills learned yet.</p>
          <p style="color:#444;font-size:12px">Skills are generated from feedback after each optimization run.</p>
        </div>`;
      return;
    }

    const sorted = [...aiAgent.skills].sort((a, b) => b.hits - a.hits);
    container.innerHTML = sorted.map(s => `
      <div class="ai-skill-item">
        <div class="skill-header">
          <span class="skill-category skill-cat-${s.category}">${s.category}</span>
          <span style="font-size:11px;color:#555">Hits: ${s.hits} | ${((s.confidence || 0) * 100).toFixed(0)}%</span>
        </div>
        <div class="skill-rule">${s.rule}</div>
        <div class="skill-meta">Action: ${s.action}</div>
      </div>
    `).join('');
  }

  // ========== 统计渲染 ==========

  _renderStats() {
    const stats = aiAgent.getFeedbackStats();
    const container = this.panel.querySelector('#ai-stats-content');
    container.innerHTML = `
      <div class="ai-stats">
        <div class="ai-stat-card">
          <div class="value">${stats.total}</div>
          <div class="label">Feedback</div>
        </div>
        <div class="ai-stat-card">
          <div class="value">${stats.avgRating}</div>
          <div class="label">Avg Rating</div>
        </div>
        <div class="ai-stat-card">
          <div class="value">${stats.skillCount}</div>
          <div class="label">Skills</div>
        </div>
        <div class="ai-stat-card">
          <div class="value">${stats.positive}</div>
          <div class="label">Positive</div>
        </div>
      </div>
      <div class="ai-divider"></div>
      <div class="ai-section-title">Learning Log</div>
      <div style="padding:0 24px">
        ${aiAgent.learningLog.length === 0
          ? '<p style="color:#555;font-size:12px">No learning events yet.</p>'
          : aiAgent.learningLog.slice(-10).reverse().map(l => `
            <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:12px">
              <span style="color:#6366f1">${l.type}</span>
              <span style="color:#555"> | ${new Date(l.timestamp).toLocaleDateString()}</span>
              <span style="color:#444"> | ${l.newSkillsCount || 0} new skills from ${l.feedbackCount || 0} feedbacks</span>
            </div>
          `).join('')
        }
      </div>
    `;
  }

  // ========== 公开 API：AI 优化结果展示 ==========

  async showOptimizationResult(aiResult, params, currentResult) {
    const body = this.resultPanel.querySelector('#ai-result-body');
    this.resultPanel.querySelector('#ai-result-title').textContent = 'AI Optimization Report';

    const circumference = 2 * Math.PI * 42;
    const offset = circumference * (1 - (aiResult.overallScore || 0) / 100);

    body.innerHTML = `
      <div style="padding:24px">
        <div class="ai-score-ring">
          <svg viewBox="0 0 100 100">
            <circle class="bg" cx="50" cy="50" r="42"/>
            <circle class="progress" cx="50" cy="50" r="42"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div class="score-text">
            <span class="score-num">${aiResult.overallScore || '--'}</span>
            <span class="score-label">Score</span>
          </div>
        </div>
      </div>

      <div class="ai-section-title">Optimization Suggestions (${(aiResult.optimizations || []).length})</div>
      <div style="padding:0 16px">
        ${(aiResult.optimizations || []).map(o => `
          <div class="ai-opt-card priority-${o.priority}">
            <div class="ai-opt-title">${o.title}</div>
            <div class="ai-opt-detail">
              <strong>Problem:</strong> ${o.problem}<br>
              <strong>Solution:</strong> ${o.solution}<br>
              <strong>Benefit:</strong> ${o.expectedBenefit}<br>
              <strong>Difficulty:</strong> ${o.difficulty} | <strong>Impact:</strong> ${o.estimatedImpact}
            </div>
          </div>
        `).join('')}
      </div>

      ${aiResult.summary ? `
        <div class="ai-section-title">Summary</div>
        <div style="padding:0 24px 16px;font-size:13px;color:#999;line-height:1.6">${aiResult.summary}</div>
      ` : ''}

      ${aiResult.nextSteps ? `
        <div class="ai-section-title">Next Steps</div>
        <div style="padding:0 24px 16px">
          ${aiResult.nextSteps.map((step, i) => `
            <div style="padding:6px 0;font-size:12px;color:#888">
              <span style="color:#6366f1;font-weight:600">${i + 1}.</span> ${step}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="ai-divider"></div>
      <div class="ai-section-title">Feedback</div>
      <div style="padding:0 24px 16px">
        <div class="ai-rating" id="ai-rating">
          ${[1,2,3,4,5].map(n => `<span class="star" data-val="${n}">&#9733;</span>`).join('')}
        </div>
        <textarea class="ai-feedback-input" id="ai-feedback-text" placeholder="Your feedback helps the AI learn and improve..."></textarea>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="ai-btn ai-btn-primary" id="ai-submit-feedback">Submit Feedback</button>
          <button class="ai-btn ai-btn-secondary" id="ai-request-update">Request Algorithm Update</button>
        </div>
      </div>
    `;

    // 评分交互
    let selectedRating = 0;
    body.querySelectorAll('#ai-rating .star').forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.val);
        body.querySelectorAll('#ai-rating .star').forEach((s, i) => {
          s.classList.toggle('active', i < selectedRating);
        });
      });
    });

    // 提交反馈
    body.querySelector('#ai-submit-feedback').addEventListener('click', async () => {
      if (selectedRating === 0) {
        this._toast('Please select a rating first', true);
        return;
      }
      await aiAgent.recordFeedback({
        rating: selectedRating,
        comment: body.querySelector('#ai-feedback-text').value,
        params,
        result: { score: aiResult.overallScore },
      });
      this._toast('Feedback submitted. AI will learn from it.');

      // 尝试学习
      const newSkills = await aiAgent.learnFromFeedback();
      if (newSkills && newSkills.length > 0) {
        this._toast(`AI learned ${newSkills.length} new skill(s)!`);
      }
    });

    // 请求算法更新
    body.querySelector('#ai-request-update').addEventListener('click', async () => {
      const btn = body.querySelector('#ai-request-update');
      btn.textContent = 'Generating...';
      btn.disabled = true;
      try {
        const update = await aiAgent.generateImprovedAlgorithm(params);
        this._showUpdateReport(update);
      } catch (e) {
        this._toast(`Error: ${e.message}`, true);
      }
      btn.textContent = 'Request Algorithm Update';
      btn.disabled = false;
    });

    this._togglePanel('result');
  }

  _showUpdateReport(update) {
    const body = this.resultPanel.querySelector('#ai-result-body');
    body.innerHTML = `
      <div style="padding:24px">
        <h3 style="color:#e0e0e0;margin:0 0 16px;font-size:16px">Algorithm Update Report</h3>
        <div style="background:#1a1a24;border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.04)">
          <div style="font-size:12px;color:#666;margin-bottom:8px">Confidence: ${((update.confidence || 0) * 100).toFixed(0)}%</div>
          <div style="font-size:13px;color:#999">${update.expectedImprovement || 'No description'}</div>
        </div>
        <div class="ai-section-title">Parameter Changes</div>
        ${(update.changes || []).map(c => `
          <div class="ai-opt-card">
            <div class="ai-opt-title">${c.parameter}</div>
            <div class="ai-opt-detail">
              <strong>Old:</strong> ${c.oldValue} &rarr; <strong>New:</strong> ${c.newValue}<br>
              <strong>Reason:</strong> ${c.reason}
            </div>
          </div>
        `).join('')}
        <div style="margin-top:16px">
          <button class="ai-btn ai-btn-primary" id="ai-apply-update">Apply Update</button>
          <button class="ai-btn ai-btn-secondary" onclick="document.querySelector('#ai-result-body').innerHTML=''">Back</button>
        </div>
      </div>
    `;

    body.querySelector('#ai-apply-update').addEventListener('click', () => {
      // 保存更新后的参数
      localStorage.setItem('ai_latest_update', JSON.stringify(update));
      this._toast('Update parameters saved. Will be applied in next optimization run.');
    });
  }

  // ========== 公开 API：Loading 状态 ==========

  showLoading(message = 'AI is analyzing...') {
    const body = this.resultPanel.querySelector('#ai-result-body');
    this.resultPanel.querySelector('#ai-result-title').textContent = 'AI Agent';
    body.innerHTML = `
      <div class="ai-loading">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
    this._togglePanel('result');
  }

  // ========== Toast 通知 ==========

  _toast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 160px; right: 20px; padding: 12px 20px;
      background: ${isError ? '#dc2626' : '#6366f1'}; color: white;
      border-radius: 10px; font-size: 13px; z-index: 3000;
      font-family: 'DM Mono', monospace; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: fadeUp 0.3s ease; max-width: 300px;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

export const aiUI = new AIUI();
