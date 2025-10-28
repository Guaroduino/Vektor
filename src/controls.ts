// UI bindings for Vektor. Accepts a host object and wires DOM controls to it.
export function setupControls(host: any) {
  const bindRange = (id: string, initial: number, onValue: (v: number) => void, step?: number) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    const valEl = document.getElementById(id + 'Val') as HTMLElement | null;
    if (!el) return;
    el.value = String(initial);
    if (step) el.step = String(step);
    if (valEl) valEl.textContent = String(initial.toFixed(step ? 2 : 0));
    const update = () => {
      const v = parseFloat(el.value);
      if (!Number.isFinite(v)) return;
      onValue(v);
      if (valEl) valEl.textContent = String(v.toFixed(step ? 2 : 0));
    };
    el.addEventListener('input', update);
  };
  const bindCheckbox = (id: string, initial: boolean, onValue: (v: boolean) => void) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.checked = initial;
    const update = () => onValue(el.checked);
    el.addEventListener('change', update);
  };

  bindRange('size', host.size, (v) => (host.size = Math.max(1, Math.round(v))));
  bindRange('alpha', host.segmentAlpha, (v) => (host.segmentAlpha = Math.min(1, Math.max(0.01, v))), 0.01);
  bindCheckbox('simulatePressure', host.simulatePressure, (v) => (host.simulatePressure = v));

  const colorInput = document.getElementById('color') as HTMLInputElement | null;
  const colorVal = document.getElementById('colorVal') as HTMLElement | null;
  const updateBrushColor = (hex: string) => {
    if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
    host.colorHex = hex;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    host.colorRGB = [r, g, b];
    if (colorVal) colorVal.textContent = hex.toUpperCase();
  };
  if (colorInput) {
    colorInput.value = host.colorHex;
    updateBrushColor(host.colorHex);
    colorInput.addEventListener('input', () => updateBrushColor(colorInput.value));
    colorInput.addEventListener('change', () => updateBrushColor(colorInput.value));
  }

  const bgInput = document.getElementById('bgColor') as HTMLInputElement | null;
  const bgVal = document.getElementById('bgColorVal') as HTMLElement | null;
  const setBackground = (hex: string) => {
    if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
    host.bgColorHex = hex.toLowerCase();
    const num = parseInt(hex.slice(1), 16);
    const rAny = (host.app as any).renderer;
    if (rAny?.background) rAny.background.color = num;
    else rAny.backgroundColor = num;
    if (bgVal) bgVal.textContent = hex.toUpperCase();
    if (rAny?.render) rAny.render(host.app.stage);
  };
  if (bgInput) {
    bgInput.value = host.bgColorHex;
    setBackground(host.bgColorHex);
    bgInput.addEventListener('input', () => setBackground(bgInput.value));
    bgInput.addEventListener('change', () => setBackground(bgInput.value));
  }

  const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement | null;
  if (clearBtn) clearBtn.addEventListener('click', () => host.clearCanvas());

  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
  const loadBtn = document.getElementById('loadBtn') as HTMLButtonElement | null;
  const loadInput = document.getElementById('loadInput') as HTMLInputElement | null;
  if (saveBtn) saveBtn.addEventListener('click', () => host.saveToFile());
  if (loadBtn && loadInput) {
    loadBtn.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', (e) => host.onLoadFileSelected(e));
  }

  const exportPngBtn = document.getElementById('exportPngBtn') as HTMLButtonElement | null;
  const exportJpgBtn = document.getElementById('exportJpgBtn') as HTMLButtonElement | null;
  if (exportPngBtn) exportPngBtn.addEventListener('click', () => host.exportPNG());
  if (exportJpgBtn) exportJpgBtn.addEventListener('click', () => host.exportJPG());
}
