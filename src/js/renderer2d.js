const COLORS = ['#2a4a8a','#2a5a7a','#2a6a6a','#3a6a4a','#5a6a3a','#7a4a3a','#6a3a4a','#4a3a7a'];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function dimH(ctx, x1, y, x2, txt, s) {
  ctx.strokeStyle = '#6b708860';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y - 4); ctx.lineTo(x2, y + 4); ctx.stroke();
  ctx.fillStyle = '#6b7088';
  ctx.font = `${Math.max(9, s * 9)}px "JetBrains Mono",monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(txt, (x1 + x2) / 2, y - 3);
}

function dimV(ctx, x, y1, y2, txt, s) {
  ctx.strokeStyle = '#6b708860'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 4, y1); ctx.lineTo(x + 4, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 4, y2); ctx.lineTo(x + 4, y2); ctx.stroke();
  ctx.save();
  ctx.translate(x - 6, (y1 + y2) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#6b7088';
  ctx.font = `${Math.max(9, s * 9)}px "JetBrains Mono",monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

export function render2D(canvas, result, params) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const CW = rect.width, CH = rect.height;
  canvas.width = CW * dpr; canvas.height = CH * dpr;
  canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0c0e14';
  ctx.fillRect(0, 0, CW, CH);

  // Grid
  ctx.strokeStyle = '#1a1e2e'; ctx.lineWidth = 0.5;
  for (let x = 0; x < CW; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
  for (let y = 0; y < CH; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }

  if (!result?.best) {
    ctx.fillStyle = '#6b7088'; ctx.font = '15px "Noto Sans SC"'; ctx.textAlign = 'center';
    ctx.fillText('点击「优化」查看排布方案', CW / 2, CH / 2);
    return;
  }

  const { best, params: p } = result;
  const { ori, rows, cols, positions, pitch, wOD, rsv } = best;
  const sT = p.compartment.shellT;
  const cL = p.compartment.L, cW = p.compartment.W;
  const sN = p.seriesCount;

  const mg = 70;
  const sc = Math.min((CW - mg * 2) / cL, (CH - mg * 2) / cW);
  const ox = (CW - cL * sc) / 2, oy = (CH - cW * sc) / 2;
  const tx = x => ox + x * sc, ty = y => oy + y * sc, ts = v => v * sc;

  // Compartment outer
  ctx.strokeStyle = '#e8a832'; ctx.lineWidth = 2;
  ctx.strokeRect(tx(0), ty(0), ts(cL), ts(cW));

  // Compartment inner
  ctx.strokeStyle = '#e8a83230'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.strokeRect(tx(sT), ty(sT), ts(cL - 2 * sT), ts(cW - 2 * sT));
  ctx.setLineDash([]);

  // BMS
  const bmsX = sT + 4, bmsY = sT + (cW - 2 * sT - p.bms.W) / 2;
  ctx.fillStyle = '#1a3a1a'; ctx.strokeStyle = '#52c41a'; ctx.lineWidth = 1.5;
  rr(ctx, tx(bmsX), ty(bmsY), ts(p.bms.L), ts(p.bms.W), 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#52c41a';
  ctx.font = `bold ${Math.max(8, ts(7))}px "JetBrains Mono",monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BMS', tx(bmsX + p.bms.L / 2), ty(bmsY + p.bms.W / 2));

  // Cells
  const cellsY0 = sT + (cW - 2 * sT - rows * ori.W - (rows - 1) * 1) / 2;
  positions.forEach((pos, i) => {
    const cx = sT + rsv.L + pos.x, cy = sT + cellsY0 + pos.y;
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.strokeStyle = '#5a7abf'; ctx.lineWidth = 1;
    rr(ctx, tx(cx), ty(cy), ts(pos.w), ts(pos.h), 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(9, ts(10))}px "JetBrains Mono",monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`S${pos.sn}`, tx(cx + pos.w / 2), ty(cy + pos.h / 2 - 5));

    ctx.font = `${Math.max(7, ts(7))}px "JetBrains Mono",monospace`;
    ctx.fillStyle = '#ff6b6b'; ctx.fillText('+', tx(cx + pos.w * 0.25), ty(cy + pos.h / 2 + 7));
    ctx.fillStyle = '#6ba0ff'; ctx.fillText('−', tx(cx + pos.w * 0.75), ty(cy + pos.h / 2 + 7));
  });

  // Connection tabs
  ctx.strokeStyle = '#e8a83280'; ctx.lineWidth = Math.max(1, ts(0.4)); ctx.setLineDash([3, 3]);
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i], b = positions[i + 1];
    const sameR = Math.floor(i / cols) === Math.floor((i + 1) / cols);
    ctx.beginPath();
    if (sameR) {
      ctx.moveTo(tx(sT + rsv.L + a.x + a.w), ty(sT + cellsY0 + a.y + a.h / 2));
      ctx.lineTo(tx(sT + rsv.L + b.x), ty(sT + cellsY0 + b.y + b.h / 2));
    } else {
      ctx.moveTo(tx(sT + rsv.L + a.x + a.w / 2), ty(sT + cellsY0 + a.y + a.h));
      ctx.lineTo(tx(sT + rsv.L + b.x + b.w / 2), ty(sT + cellsY0 + b.y));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Main wires
  if (positions.length > 1) {
    const first = positions[0], last = positions[positions.length - 1];
    const wT = Math.max(2, ts(wOD * 0.4));
    const midY = bmsY + p.bms.W * 0.4;

    ctx.lineWidth = wT;
    // Positive
    const px = sT + rsv.L + first.x + first.w * 0.25;
    ctx.strokeStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.moveTo(tx(px), ty(sT + cellsY0 + first.y));
    ctx.lineTo(tx(px), ty(midY));
    ctx.lineTo(tx(bmsX + p.bms.L * 0.3), ty(midY));
    ctx.stroke();

    // Negative
    const nx = sT + rsv.L + last.x + last.w * 0.75;
    ctx.strokeStyle = '#4096ff';
    ctx.beginPath();
    ctx.moveTo(tx(nx), ty(sT + cellsY0 + last.y + last.h));
    ctx.lineTo(tx(nx), ty(midY));
    ctx.lineTo(tx(bmsX + p.bms.L * 0.7), ty(midY));
    ctx.stroke();

    // Labels
    ctx.font = `bold ${Math.max(8, ts(8))}px "JetBrains Mono",monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff4d4f'; ctx.fillText('总正+', tx(bmsX + p.bms.L * 0.3) + 4, ty(midY) - 5);
    ctx.fillStyle = '#4096ff'; ctx.fillText('总负−', tx(bmsX + p.bms.L * 0.7) + 4, ty(midY) + 12);
  }

  // Dimensions
  dimH(ctx, tx(0), ty(0) - 22, tx(cL), `${cL}mm`, sc);
  dimV(ctx, tx(0) - 18, ty(0), ty(cW), `${cW}mm`, sc);

  // Info
  ctx.fillStyle = '#e8a83250';
  ctx.font = '10px "JetBrains Mono",monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`${sN}S | ${ori.L}×${ori.W}×${ori.H} | ${rows}×${cols} | ${ori.label}`, 10, 10);
  ctx.fillText(`利用率 ${best.util.toFixed(1)}% | 走线 ${(best.wLen / 1000).toFixed(2)}m | 评分 ${best.score.toFixed(3)}`, 10, 24);

  // Legend
  const lx = CW - 165, ly = CH - 115;
  ctx.fillStyle = '#0c0e14cc';
  rr(ctx, lx - 8, ly - 8, 160, 105, 5); ctx.fill();
  ctx.strokeStyle = '#2a2f45'; ctx.lineWidth = 1;
  rr(ctx, lx - 8, ly - 8, 160, 105, 5); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '11px "Noto Sans SC"';
  const items = [['#e8a832','电池仓'],['#52c41a','BMS保护板'],['#ff4d4f','总正极'],['#4096ff','总负极'],['#5a7abf','电芯'],['#e8a83280','极耳连接']];
  items.forEach(([c, l], i) => {
    ctx.fillStyle = c; ctx.fillRect(lx, ly + i * 16, 10, 10);
    ctx.fillStyle = '#a0a4b8'; ctx.fillText(l, lx + 14, ly + i * 16 + 5);
  });
}
