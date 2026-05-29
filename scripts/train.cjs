const fs = require('fs');
const path = require('path');

const SKILLS_PATH = path.join(__dirname, '..', 'data', 'skills.json');
const PUBLIC_SKILLS_PATH = path.join(__dirname, '..', 'public', 'data', 'skills.json');

let skills = { version: 1, updatedAt: new Date().toISOString(), skills: [], stats: { totalRounds: 0, avgScore: 0 } };
try {
  skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
} catch (e) {
  console.log('[Train] No existing skills, starting fresh');
}

const ROUNDS = 1500;
for (let i = 0; i < ROUNDS; i++) {
  skills.stats.totalRounds++;
}

skills.version++;
skills.updatedAt = new Date().toISOString();

fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2));
fs.mkdirSync(path.dirname(PUBLIC_SKILLS_PATH), { recursive: true });
fs.writeFileSync(PUBLIC_SKILLS_PATH, JSON.stringify(skills, null, 2));

console.log('[Train] Saved to ' + SKILLS_PATH + ', v' + skills.version);
