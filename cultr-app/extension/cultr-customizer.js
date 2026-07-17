// Personalizador Cultr — storefront (vanilla JS, sin dependencias)
// - Selector de modelo con stock real de blanks (GET {app}/api/stock)
// - Canvas con foto: arrastrar + zoom
// - Export a resolución de impresión y subida ({app}/api/upload)
// - Add to cart con propiedades del line item (_print_file)

(function () {
  const root = document.getElementById("cultr-customizer");
  if (!root) return;

  const APP = root.dataset.appUrl?.replace(/\/$/, "");
  const canvas = document.getElementById("cultr-canvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, R = 44;

  // Resolución de impresión del export (ajustar a la máquina UV)
  const PRINT_W = 1200, PRINT_H = 2400;

  const state = {
    variantId: null,
    sku: null,
    image: null,
    offset: { x: 0, y: 0 },
    scale: 1,
  };

  // ── Stock de blanks → habilitar/deshabilitar modelos ──
  const modelButtons = [...document.querySelectorAll(".cultr-c__model")];

  function blankSku(variantSku) {
    const parts = (variantSku || "").split("-");
    return parts.length ? `BLANK-${parts[parts.length - 1]}` : null;
  }

  async function loadStock() {
    if (!APP) return;
    try {
      const res = await fetch(`${APP}/api/stock`);
      const stock = await res.json();
      modelButtons.forEach((btn) => {
        const qty = stock[blankSku(btn.dataset.sku)];
        if (qty !== undefined && qty <= 0) {
          btn.disabled = true;
          btn.classList.add("is-soldout");
          btn.title = "Agotado en este modelo";
        }
      });
    } catch (e) {
      console.warn("[cultr] no se pudo leer stock", e);
    }
  }

  modelButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      modelButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.variantId = btn.dataset.variantId;
      state.sku = btn.dataset.sku;
      refreshAddButton();
    })
  );

  // ── Canvas ──
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawScene(c, w, h, r, forPrint) {
    c.clearRect(0, 0, w, h);
    c.save();
    if (!forPrint) {
      roundRect(c, 0, 0, w, h, r);
      c.clip();
    }
    if (state.image) {
      const iw = state.image.width, ih = state.image.height;
      const base = Math.max(w / iw, h / ih) * state.scale;
      const dw = iw * base, dh = ih * base;
      const k = w / W; // factor de escala para offsets en print
      c.drawImage(
        state.image,
        w / 2 - dw / 2 + state.offset.x * k,
        h / 2 - dh / 2 + state.offset.y * k,
        dw,
        dh
      );
    } else {
      c.fillStyle = "#F3E5C8";
      c.fillRect(0, 0, w, h);
    }
    c.restore();

    if (!forPrint) {
      // borde + módulo de cámara solo en la vista previa
      c.lineWidth = 10;
      c.strokeStyle = "#26211B";
      roundRect(c, 5, 5, w - 10, h - 10, r - 5);
      c.stroke();
      c.fillStyle = "#26211B";
      roundRect(c, 20, 20, 96, 100, 26);
      c.fill();
    }
  }

  function paint() {
    drawScene(ctx, W, H, R, false);
  }

  // ── Interacción: drag + zoom ──
  let dragging = null;
  const pt = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: ((t.clientX - r.left) / r.width) * W, y: ((t.clientY - r.top) / r.height) * H };
  };
  const start = (e) => { if (state.image) dragging = pt(e); };
  const move = (e) => {
    if (!dragging || !state.image) return;
    e.preventDefault();
    const p = pt(e);
    state.offset.x += p.x - dragging.x;
    state.offset.y += p.y - dragging.y;
    dragging = p;
    paint();
  };
  const end = () => (dragging = null);

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: true });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  document.getElementById("cultr-file").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.offset = { x: 0, y: 0 };
      state.scale = 1;
      document.getElementById("cultr-zoom-wrap").hidden = false;
      document.getElementById("cultr-zoom").value = 1;
      document.getElementById("cultr-upload-text").textContent = "Cambiar foto";
      document.getElementById("cultr-hint").textContent = "Arrastrá la foto para acomodarla";
      paint();
      refreshAddButton();
    };
    img.src = URL.createObjectURL(f);
  });

  document.getElementById("cultr-zoom").addEventListener("input", (e) => {
    state.scale = parseFloat(e.target.value);
    paint();
  });

  // ── Add to cart ──
  const addBtn = document.getElementById("cultr-add");
  const status = document.getElementById("cultr-status");

  function refreshAddButton() {
    addBtn.disabled = !(state.variantId && state.image);
  }

  function exportPrintFile() {
    const off = document.createElement("canvas");
    off.width = PRINT_W;
    off.height = PRINT_H;
    drawScene(off.getContext("2d"), PRINT_W, PRINT_H, 0, true);
    return off.toDataURL("image/png");
  }

  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    status.textContent = "Preparando tu diseño…";
    try {
      let printUrl = "";
      if (APP) {
        const res = await fetch(`${APP}/api/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl: exportPrintFile(),
            filename: `cultr-${state.sku}-${Date.now()}.png`,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        printUrl = json.url;
      }

      const cart = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: state.variantId,
          quantity: 1,
          properties: {
            _print_file: printUrl,
            Tipo: "Personalizada",
          },
        }),
      });
      if (!cart.ok) throw new Error("cart add falló");

      status.textContent = "Agregada al carrito ✓";
      window.location.href = "/cart";
    } catch (err) {
      console.error("[cultr]", err);
      status.textContent = "Hubo un problema, probá de nuevo.";
      addBtn.disabled = false;
    }
  });

  // init
  paint();
  loadStock();
})();
