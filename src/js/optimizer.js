export const WireDB = {
  'AWG10':{mm2:5.26,od:5},'AWG8':{mm2:8.37,od:6.4},
  '6mm2':{mm2:6,od:4.8},'10mm2':{mm2:10,od:5.8},'16mm2':{mm2:16,od:7},
  '25mm2':{mm2:25,od:8.8},'35mm2':{mm2:35,od:10.2},
  '50mm2':{mm2:50,od:12},'70mm2':{mm2:70,od:14.2},'95mm2':{mm2:95,od:16.4},
};

export const CellPresets = [
  {id:'eve280',m:'EVE LF280N',L:173.9,W:71.7,H:207.2,ah:280,v:3.7},
  {id:'eve304',m:'EVE LF304',L:173.9,W:71.7,H:207.2,ah:304,v:3.7},
  {id:'eve230',m:'EVE LF230',L:148,W:91,H:26.5,ah:230,v:3.7},
  {id:'catl280',m:'CATL 280Ah',L:174,W:72,H:207,ah:280,v:3.7},
  {id:'catl161',m:'CATL 161Ah',L:148,W:91,H:26.5,ah:161,v:3.7},
  {id:'catl590',m:'CATL 590单体',L:335,W:100,H:20,ah:120,v:3.7},
  {id:'calb280',m:'CALB CA280',L:174,W:72,H:207,ah:280,v:3.7},
  {id:'calb180',m:'CALB CA180',L:148,W:67,H:183,ah:180,v:3.7},
  {id:'gotion240',m:'Gotion 240Ah',L:174,W:72,H:207,ah:240,v:3.7},
  {id:'sam94',m:'Samsung 94Ah',L:173,W:71,H:200,ah:94,v:3.65},
  {id:'lg78',m:'LG E78',L:173,W:71,H:200,ah:78,v:3.65},
];

function orientations(cell) {
  return [
    {L:cell.L,W:cell.W,H:cell.H,label:'标准直立'},
    {L:cell.W,W:cell.L,H:cell.H,label:'旋转90°直立'},
    {L:cell.L,W:cell.H,H:cell.W,label:'侧放A'},
    {L:cell.H,W:cell.W,H:cell.L,label:'平放A'},
    {L:cell.W,W:cell.H,H:cell.L,label:'侧放B'},
    {L:cell.H,W:cell.L,H:cell.W,label:'平放B'},
  ];
}

function betweenPitch(aux) {
  return aux.tabT + aux.epoxyT * 2 + aux.compositeT + aux.cellGap;
}

function wireReserve(bms, wire, wOD) {
  return {
    L: wire.exit === 'end' ? bms.L + wOD * wire.count + 8 : 8,
    W: wire.exit === 'side' ? bms.W + wOD * wire.count + 8 : 4,
    H: wire.exit === 'top' ? bms.H + wOD * wire.count + 10 : 4,
  };
}

function estWire(rows, cols, ori, pitch, aux, wOD, exit, sCount) {
  let t = 0;
  for (let i = 0; i < sCount - 1; i++) {
    const r1 = Math.floor(i / cols), r2 = Math.floor((i + 1) / cols);
    t += r1 === r2 ? pitch + aux.tabT : ori.W * 0.6 + pitch + ori.L * 0.3;
  }
  const extra = { top: wOD * 6 + 120, side: wOD * 6 + rows * ori.W * 0.4 + 60, end: wOD * 6 + cols * ori.L * 0.3 + 80 };
  return t + (extra[exit] || extra.top);
}

function snakePositions(ori, rows, cols, sCount, pitch, reserve) {
  const pos = [];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (n >= sCount) break;
      const ac = r % 2 === 0 ? c : cols - 1 - c;
      pos.push({
        sn: n + 1,
        x: reserve.L + ac * (ori.L + pitch),
        y: r * (ori.W + 1),
        w: ori.L, h: ori.W,
        r, c: ac,
      });
      n++;
    }
  }
  return pos;
}

export function optimize(params) {
  const { compartment: comp, cell, bms, aux, wire, seriesCount: sN } = params;
  const sT = comp.shellT;
  const wInfo = WireDB[wire.gauge] || WireDB['25mm2'];
  const wOD = wInfo.od;
  const intl = { L: comp.L - 2 * sT, W: comp.W - 2 * sT, H: comp.H - 2 * sT };
  const rsv = wireReserve(bms, wire, wOD);
  const avl = { L: intl.L - rsv.L, W: intl.W - rsv.W, H: intl.H - rsv.H };

  if (avl.L < 10 || avl.W < 10 || avl.H < 10) {
    return { error: '电池仓内部空间不足' };
  }

  const pitch = betweenPitch(aux);
  const oris = orientations(cell);
  const results = [];

  for (const ori of oris) {
    if (ori.H > avl.H) continue;
    const pL = ori.L + pitch;
    const pW = ori.W + aux.cellGap;
    const maxC = Math.floor((avl.L + pitch) / pL);
    const maxR = Math.floor((avl.W + aux.cellGap) / pW);
    if (maxC < 1 || maxR < 1) continue;

    for (let rows = 1; rows <= Math.min(maxR, sN); rows++) {
      const cols = Math.ceil(sN / rows);
      if (cols > maxC) continue;

      const usedL = cols * ori.L + (cols - 1) * pitch;
      const usedW = rows * ori.W + (rows - 1) * aux.cellGap;
      const usedH = ori.H;
      const wLen = estWire(rows, cols, ori, pitch, aux, wOD, wire.exit, sN);

      const cVol = sN * cell.L * cell.W * cell.H;
      const util = (cVol / (avl.L * avl.W * avl.H)) * 100;
      const utilO = (cVol / (intl.L * intl.W * intl.H)) * 100;
      const wEff = Math.max(0, 1 - wLen / (2 * (avl.L + avl.W + avl.H) * sN));
      const rowPen = (rows - 1) / Math.max(1, maxR - 1);
      const score = (util / 100) * 0.55 + wEff * 0.25 + (1 - rowPen) * 0.2;

      const totL = usedL + rsv.L;
      const totW = usedW + rsv.W;
      const totH = Math.max(usedH, bms.H) + rsv.H;
      const fits = totL <= intl.L && totW <= intl.W && totH <= intl.H;

      results.push({
        ori, rows, cols, usedL, usedW, usedH, totL, totW, totH,
        util, utilO, wLen, wEff: wEff * 100, score, fits,
        pitch, wOD, rsv, avl, intl,
      });
    }
  }

  if (!results.length) return { error: '无法排布，请调整参数' };
  results.sort((a, b) => b.score - a.score);

  const best = results[0];
  best.positions = snakePositions(best.ori, best.rows, best.cols, sN, best.pitch, best.rsv);

  return { best, alts: results.slice(1, 10), all: results, params };
}
