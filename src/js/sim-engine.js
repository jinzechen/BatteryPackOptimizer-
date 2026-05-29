/**
 * Battery Pack Physics Simulation Engine
 * Like self-driving uses game engines for unlimited training data,
 * we use physics simulation to generate unlimited battery evaluations.
 * The parameter space is FINITE - cells, series, parallel, cooling are enumerable.
 */

// ====== CELL DATABASE (Real-world specs from datasheets) ======
export const CELLS = {
  '18650-NMC': {
    chemistry: 'NMC', form: 'cylindrical',
    nominalVoltage: 3.6, capacity: 3.0, weight: 0.048,
    internalResistance: 0.020, maxContinuousCurrent: 15,
    maxCellTemp: 60, baseCycleLife: 500, unitCost: 2.5,
  },
  '18650-LFP': {
    chemistry: 'LFP', form: 'cylindrical',
    nominalVoltage: 3.2, capacity: 2.5, weight: 0.040,
    internalResistance: 0.015, maxContinuousCurrent: 20,
    maxCellTemp: 65, baseCycleLife: 2000, unitCost: 1.8,
  },
  '21700-NMC': {
    chemistry: 'NMC', form: 'cylindrical',
    nominalVoltage: 3.6, capacity: 5.0, weight: 0.068,
    internalResistance: 0.015, maxContinuousCurrent: 10,
    maxCellTemp: 60, baseCycleLife: 500, unitCost: 3.5,
  },
  '21700-LFP': {
    chemistry: 'LFP', form: 'cylindrical',
    nominalVoltage: 3.2, capacity: 4.0, weight: 0.060,
    internalResistance: 0.010, maxContinuousCurrent: 20,
    maxCellTemp: 65, baseCycleLife: 3000, unitCost: 2.5,
  },
  '4680-NMC': {
    chemistry: 'NMC', form: 'cylindrical',
    nominalVoltage: 3.6, capacity: 23.0, weight: 0.355,
    internalResistance: 0.005, maxContinuousCurrent: 100,
    maxCellTemp: 60, baseCycleLife: 1500, unitCost: 12.0,
  },
  'prismatic-NMC': {
    chemistry: 'NMC', form: 'prismatic',
    nominalVoltage: 3.6, capacity: 100.0, weight: 1.500,
    internalResistance: 0.003, maxContinuousCurrent: 200,
    maxCellTemp: 55, baseCycleLife: 800, unitCost: 45.0,
  },
  'prismatic-LFP': {
    chemistry: 'LFP', form: 'prismatic',
    nominalVoltage: 3.2, capacity: 100.0, weight: 1.800,
    internalResistance: 0.002, maxContinuousCurrent: 200,
    maxCellTemp: 70, baseCycleLife: 4000, unitCost: 30.0,
  },
  'pouch-NMC': {
    chemistry: 'NMC', form: 'pouch',
    nominalVoltage: 3.6, capacity: 50.0, weight: 0.700,
    internalResistance: 0.005, maxContinuousCurrent: 100,
    maxCellTemp: 55, baseCycleLife: 800, unitCost: 20.0,
  },
  'pouch-LFP': {
    chemistry: 'LFP', form: 'pouch',
    nominalVoltage: 3.2, capacity: 50.0, weight: 0.900,
    internalResistance: 0.004, maxContinuousCurrent: 100,
    maxCellTemp: 70, baseCycleLife: 3500, unitCost: 15.0,
  },
};

export const CELL_TYPES = Object.keys(CELLS);

const PACKING = {
  cylindrical: { min: 0.65, max: 0.82 },
  prismatic: { min: 0.85, max: 0.93 },
  pouch: { min: 0.80, max: 0.90 },
};

const COOLING = {
  air:        { costPerKg: 5,  heatCapacity: 800,  overhead: 0.05 },
  liquid:     { costPerKg: 30, heatCapacity: 3000, overhead: 0.10 },
  immersion:  { costPerKg: 80, heatCapacity: 6000, overhead: 0.15 },
  pcm:        { costPerKg: 50, heatCapacity: 1500, overhead: 0.12 },
};

// ====== PHYSICS EVALUATION ======
export function evaluate(config) {
  const cell = CELLS[config.cellType];
  if (!cell) return null;

  const S = Math.max(1, config.series || 1);
  const P = Math.max(1, config.parallel || 1);
  const cooling = COOLING[config.cooling] || COOLING.air;
  const packRange = PACKING[cell.form];

  // Random packing within realistic range (variance for training)
  const packingEff = packRange.min + Math.random() * (packRange.max - packRange.min);

  // Electrical
  const voltage = cell.nominalVoltage * S;
  const capacity = cell.capacity * P;
  const energy = voltage * capacity;
  const resistance = cell.internalResistance * S / P;
  const maxCurrent = cell.maxContinuousCurrent * P;
  const maxPower = voltage * maxCurrent;

  // Weight
  const cellWeight = cell.weight * S * P;
  const overhead = 1 + cooling.overhead + 0.10; // housing + BMS
  const totalWeight = cellWeight / packingEff * overhead;

  // Energy density
  const gravDensity = energy / totalWeight;

  // Thermal
  const heatGen = (capacity * capacity * resistance) + (capacity * resistance * 0.3);
  const coolCap = cooling.heatCapacity * totalWeight * 0.001;
  const thermalMargin = Math.max(0, Math.min(1, 1 - (heatGen / coolCap)));

  // Cost
  const cellCost = cell.unitCost * S * P;
  const bmsCost = S > 48 ? S * 2 : S > 12 ? S * 1.5 : 50;
  const coolCost = cooling.costPerKg * totalWeight * 0.1;
  const houseCost = totalWeight * 5;
  const totalCost = cellCost + bmsCost + coolCost + houseCost;
  const costPerWh = totalCost / energy;

  // Cycle life
  const tempFactor = Math.max(0.3, thermalMargin);
  const chemFactor = cell.chemistry === 'LFP' ? 3 : 1;
  const cycleLife = cell.baseCycleLife * tempFactor * chemFactor;

  // Safety
  const safety = Math.min(100,
    thermalMargin * 30 +
    (cell.chemistry === 'LFP' ? 25 : 15) +
    (S > 12 ? 20 : 10) +
    (packingEff < 0.8 ? 15 : 10)
  );

  // Overall score (weighted)
  const normEnergy = Math.min(100, gravDensity / 3);
  const normCost = Math.max(0, 100 - costPerWh * 50);
  const normLife = Math.min(100, cycleLife / 30);
  const overallScore =
    normEnergy * 0.25 + normCost * 0.25 +
    thermalMargin * 100 * 0.20 + safety * 0.15 + normLife * 0.15;

  return {
    cellType: config.cellType, series: S, parallel: P, cooling: config.cooling,
    voltage: Math.round(voltage * 10) / 10,
    capacity: Math.round(capacity * 10) / 10,
    energy: Math.round(energy),
    weight: Math.round(totalWeight * 100) / 100,
    gravDensity: Math.round(gravDensity * 10) / 10,
    thermalMargin: Math.round(thermalMargin * 100) / 100,
    totalCost: Math.round(totalCost),
    costPerWh: Math.round(costPerWh * 1000) / 1000,
    cycleLife: Math.round(cycleLife),
    safety: Math.round(safety),
    overallScore: Math.round(overallScore * 10) / 10,
  };
}

// ====== CONFIG GENERATOR ======
export function generateConfig(constraints = {}) {
  const cellType = constraints.cellType ||
    CELL_TYPES[Math.floor(Math.random() * CELL_TYPES.length)];
  const cell = CELLS[cellType];

  const targetV = constraints.targetVoltage ||
    [12, 24, 36, 48, 72, 96, 400][Math.floor(Math.random() * 7)];
  const targetAh = constraints.targetCapacity ||
    [10, 20, 50, 100, 200][Math.floor(Math.random() * 5)];

  return {
    cellType,
    series: Math.max(1, Math.round(targetV / cell.nominalVoltage)),
    parallel: Math.max(1, Math.round(targetAh / cell.capacity)),
    cooling: constraints.cooling ||
      ['air', 'liquid', 'immersion', 'pcm'][Math.floor(Math.random() * 4)],
  };
}

// ====== BATCH SIMULATION (Unlimited free training data) ======
export function runSimulation(n = 500, constraints = {}) {
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = evaluate(generateConfig(constraints));
    if (r && isFinite(r.overallScore) && r.overallScore > 0) results.push(r);
  }
  return results.sort((a, b) => b.overallScore - a.overallScore);
}
