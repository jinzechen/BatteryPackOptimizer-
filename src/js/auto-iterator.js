/**
 * Auto-Iterator: Self-Play Self-Improvement Engine
 *
 * Like AlphaGo self-play: Teacher quizzes Student, Student learns.
 * Like self-driving: Physics simulation generates unlimited training data.
 *
 * Teacher = brute-force physics simulation (high fidelity)
 * Student = heuristic rules + accumulated skills
 * Gap between them = learning signal → new skills extracted
 *
 * As Student gets better → Teacher must work harder → both improve.
 * Difficulty auto-scales (curriculum learning).
 */

import { CELLS, CELL_TYPES, evaluate, generateConfig, runSimulation } from './sim-engine.js';

const LOG_KEY = 'auto_iterator_log';

export class AutoIterator {
  constructor() {
    this.running = false;
    this.log = [];
  }

  // ====== Self-Play Main Loop ======
  async runSelfPlay(rounds = 150) {
    if (this.running) return [];
    this.running = true;

    const aiAgent = await this._getAgent();
    const existingCount = aiAgent ? aiAgent.skills.length : 0;
    const difficulty = Math.min(3, Math.floor(existingCount / 15));
    const newSkills = [];

    for (let i = 0; i < rounds; i++) {
      const constraints = this._generateChallenge(i, difficulty);

      // Teacher: brute-force search with 300 configs
      const teacherResults = runSimulation(300, constraints);
      const teacherBest = teacherResults[0];
      if (!teacherBest) continue;

      // Student: heuristic + existing skills
      const studentBest = this._studentOptimize(constraints, aiAgent);
      if (!studentBest) continue;

      // Gap → learning signal
      const gap = teacherBest.overallScore - studentBest.overallScore;
      if (gap > 3) {
        const skill = this._extractSkill(constraints, studentBest, teacherBest, teacherResults);
        if (skill && !this._isDuplicate(skill, aiAgent)) {
          newSkills.push(skill);
          if (aiAgent) aiAgent.skills.push(skill);
        }
      }
    }

    // Save
    if (aiAgent && newSkills.length > 0) {
      await aiAgent._saveLocal('ai_skills', aiAgent.skills);
    }

    this.log.push({
      timestamp: new Date().toISOString(),
      rounds,
      difficulty,
      newSkills: newSkills.length,
      totalSkills: aiAgent ? aiAgent.skills.length : 0,
    });
    await this._saveLog();

    this.running = false;
    return newSkills;
  }

  // ====== Curriculum: Difficulty increases with skill count ======
  _generateChallenge(round, difficulty) {
    const voltages = [[48, 36, 24], [48, 72, 96, 400], [72, 96, 200, 400], [96, 400, 800]];
    const capacities = [[50, 100], [20, 50, 100, 200], [50, 100, 200], [100, 200, 500]];
    const coolings = [
      undefined, // any
      ['air', 'liquid'],
      ['liquid', 'immersion', 'pcm'],
      ['liquid', 'immersion'],
    ];

    const d = Math.min(difficulty, 3);
    const c = {
      targetVoltage: voltages[d][Math.floor(Math.random() * voltages[d].length)],
      targetCapacity: capacities[d][Math.floor(Math.random() * capacities[d].length)],
    };

    if (coolings[d]) {
      c.cooling = coolings[d][Math.floor(Math.random() * coolings[d].length)];
    }
    if (d >= 2) {
      c.cellType = CELL_TYPES[Math.floor(Math.random() * CELL_TYPES.length)];
    }
    return c;
  }

  // ====== Student: Simple heuristic (what a basic optimizer would do) ======
  _studentOptimize(constraints, aiAgent) {
    const cellType = constraints.cellType ||
      CELL_TYPES[Math.floor(Math.random() * CELL_TYPES.length)];
    const cell = CELLS[cellType];

    const S = Math.max(1, Math.round((constraints.targetVoltage || 48) / cell.nominalVoltage));
    const P = Math.max(1, Math.round((constraints.targetCapacity || 100) / cell.capacity));
    let cooling = constraints.cooling || 'air';

    let result = evaluate({ cellType, series: S, parallel: P, cooling });

    // Apply existing skills to improve student
    if (aiAgent && aiAgent.skills.length > 0) {
      const context = `${cellType} ${cell.chemistry} ${cooling}`.toLowerCase();
      const matching = aiAgent.skills.filter(s => {
        const combined = `${s.rule} ${s.condition} ${s.category} ${s.action}`.toLowerCase();
        return context.split(/\s+/).some(k => k.length > 2 && combined.includes(k));
      });

      // Try skill suggestions
      for (const skill of matching.slice(0, 3)) {
        if (skill.action.includes('liquid') && cooling !== 'liquid') {
          const alt = evaluate({ cellType, series: S, parallel: P, cooling: 'liquid' });
          if (alt && alt.overallScore > (result?.overallScore || 0)) result = alt;
        }
        if (skill.action.includes('immersion') && cooling !== 'immersion') {
          const alt = evaluate({ cellType, series: S, parallel: P, cooling: 'immersion' });
          if (alt && alt.overallScore > (result?.overallScore || 0)) result = alt;
        }
      }
    }

    return result;
  }

  // ====== Extract Skill from Teacher-Student Gap ======
  _extractSkill(constraints, student, teacher, topResults) {
    const skills = [];
    const top5 = topResults.slice(0, 5);

    // Pattern 1: Cooling difference
    if (teacher.cooling !== student.cooling) {
      const bestCooling = top5.map(r => r.cooling).sort((a, b) =>
        top5.filter(r => r.cooling === b).length - top5.filter(r => r.cooling === a).length
      )[0];
      skills.push({
        category: 'thermal',
        rule: `${bestCooling} cooling is optimal for ${student.cellType} at ${constraints.targetVoltage}V`,
        condition: `Cell: ${student.cellType}, Voltage: ${constraints.targetVoltage}V, Capacity: ${constraints.targetCapacity}Ah`,
        action: `Switch to ${bestCooling} cooling for better thermal performance and safety`,
        confidence: 0.8,
      });
    }

    // Pattern 2: Cell type difference
    if (teacher.cellType !== student.cellType) {
      const bestCell = top5.map(r => r.cellType).sort((a, b) =>
        top5.filter(r => r.cellType === b).length - top5.filter(r => r.cellType === a).length
      )[0];
      skills.push({
        category: 'energy',
        rule: `${bestCell} outperforms ${student.cellType} for ${constraints.targetVoltage}V/${constraints.targetCapacity}Ah packs`,
        condition: `Target: ${constraints.targetVoltage}V, ${constraints.targetCapacity}Ah`,
        action: `Use ${bestCell} cells for better energy density and overall performance`,
        confidence: 0.85,
      });
    }

    // Pattern 3: S×P ratio sweet spot
    const topSP = top5.map(r => ({ s: r.series, p: r.parallel, ratio: r.series / r.parallel }));
    const avgRatio = topSP.reduce((s, r) => s + r.ratio, 0) / topSP.length;
    const studentRatio = student.series / student.parallel;
    if (Math.abs(avgRatio - studentRatio) / avgRatio > 0.2) {
      skills.push({
        category: 'structural',
        rule: `Optimal S/P ratio for ${constraints.targetVoltage}V is around ${avgRatio.toFixed(1)}:1`,
        condition: `Voltage: ${constraints.targetVoltage}V with ${student.cellType}`,
        action: `Target series/parallel ratio near ${avgRatio.toFixed(1)}:1 for best energy-to-weight balance`,
        confidence: 0.7,
      });
    }

    // Pattern 4: Cost optimization
    const topCostAvg = top5.reduce((s, r) => s + r.costPerWh, 0) / top5.length;
    if (Math.abs(student.costPerWh - topCostAvg) > 0.05) {
      skills.push({
        category: 'cost',
        rule: `Optimal cost target for ${constraints.targetVoltage}V/${constraints.targetCapacity}Ah is ~$${topCostAvg.toFixed(2)}/Wh`,
        condition: `{constraints.targetVoltage}V, ${constraints.targetCapacity}Ah pack`,
        action: `Target cost around $$$${topCostAvg.toFixed(2)}/Wh by balancing cell choice and cooling system`,
        confidence: 0.75,
      });
    }

    // Pattern 5: LFP vs NMC trade-off
    const lfpResults = top5.filter(r => CELLS[r.cellType].chemistry === 'LFP');
    const nmcResults = top5.filter(r => CELLS[r.cellType].chemistry !== 'LFP');
    if (lfpResults.length >= 3) {
      skills.push({
        category: 'lifespan',
        rule: `LFP chemistry dominates for ${constraints.targetVoltage}V/${constraints.targetCapacity}Ah applications`,
        condition: `When cycle life and cost matter more than weight`,
        action: `Prefer LFP cells: ${Math.round(lfpResults[0].cycleLife)}+ cycles vs NMC alternative`,
        confidence: 0.9,
      });
    } else if (nmcResults.length >= 3) {
      skills.push({
        category: 'energy',
        rule: `NMC chemistry dominates for ${constraints.targetVoltage}V/${constraints.targetCapacity}Ah high-density applications`,
        condition: `When energy density and weight matter most`,
        action: `Prefer NMC cells: ${nmcResults[0].gravDensity.toFixed(0)} Wh/kg vs LFP alternative`,
        confidence: 0.9,
      });
    }

    // Pick most impactful
    if (skills.length === 0) return null;

    const skill = skills.reduce((best, s) =>
      (s.confidence || 0) > (best.confidence || 0) ? s : best
    );

    skill.id = `selfplay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    skill.hits = 0;
    skill.createdAt = new Date().toISOString();
    skill.source = 'self-play';
    return skill;
  }

  _isDuplicate(skill, aiAgent) {
    const allSkills = aiAgent ? aiAgent.skills : [];
    return allSkills.some(s => s.category === skill.category && s.rule === skill.rule);
  }

  // ====== AI Distillation (optional, uses API for deeper insights) ======
  async distillWithAI(newSkills) {
    const aiAgent = await this._getAgent();
    if (!aiAgent || !aiAgent.isConfigured() || newSkills.length === 0) return null;

    try {
      const result = await aiAgent.callAI([
        {
          role: 'system',
          content: 'You are a battery optimization distillation engine. Synthesize multiple observations into one high-level strategic insight. Return JSON only.'
        },
        {
          role: 'user',
          content: `Skills discovered through ${newSkills.length} rounds of self-play simulation:\n${JSON.stringify(newSkills.map(s => ({ cat: s.category, rule: s.rule, action: s.action })), null, 2)}\n\nCreate one synthesized high-level strategic skill that captures the essence of all these observations.\nReturn JSON: {"category":"...", "rule":"...", "condition":"...", "action":"...", "confidence":0.0-1.0}`
        }
      ]);

      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        const skill = JSON.parse(match[0]);
        skill.id = `distilled_${Date.now()}`;
        skill.hits = 0;
        skill.createdAt = new Date().toISOString();
        skill.source = 'ai-distillation';
        return skill;
      }
    } catch (e) {
      console.warn('[AutoIterator] AI distillation failed:', e.message);
    }
    return null;
  }

  // ====== Full Autonomous Cycle ======
  async runCycle() {
    const start = Date.now();
    console.log('[AutoIterator] Starting self-play cycle...');

    // Phase 1: Physics self-play (no API needed, always works)
    const newSkills = await this.runSelfPlay(150);
    console.log(`[AutoIterator] Self-play: ${newSkills.length} new skills (${Date.now() - start}ms)`);

    // Phase 2: AI distillation (optional, if API configured)
    let distilled = null;
    if (newSkills.length > 0) {
      distilled = await this.distillWithAI(newSkills);
      if (distilled) {
        const aiAgent = await this._getAgent();
        if (aiAgent) {
          aiAgent.skills.push(distilled);
          await aiAgent._saveLocal('ai_skills', aiAgent.skills);
        }
        console.log('[AutoIterator] AI distillation complete: +1 strategic skill');
      }
    }

    console.log(`[AutoIterator] Cycle complete. Total time: ${Date.now() - start}ms`);
    return { newSkills, distilled };
  }

  // ====== Export for deployment ======
  exportForDeploy() {
    return this._getAgent().then(agent => {
      const skills = agent ? agent.skills : [];
      return {
        generatedAt: new Date().toISOString(),
        skillCount: skills.length,
        skills,
        jsModule: `// Auto-generated by BatteryPackOptimizer Self-Play Engine\n// ${new Date().toISOString()}\n// ${skills.length} skills from autonomous learning\n\nexport const LEARNED_SKILLS = ${JSON.stringify(skills, null, 2)};\n`,
      };
    });
  }

  // ====== Helpers ======
  async _getAgent() {
    try {
      const { aiAgent } = await import('./ai-agent.js');
      if (!aiAgent.ready) await aiAgent.init();
      return aiAgent;
    } catch {
      return null;
    }
  }

  async _saveLog() {
    const data = JSON.stringify(this.log.slice(-50));
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: LOG_KEY, value: data });
    } catch {
      localStorage.setItem(LOG_KEY, data);
    }
  }

  getStats() {
    return {
      totalCycles: this.log.length,
      totalNewSkills: this.log.reduce((s, l) => s + (l.newSkills || 0), 0),
      lastRun: this.log.length > 0 ? this.log[this.log.length - 1].timestamp : null,
    };
  }
}

export const autoIterator = new AutoIterator();
