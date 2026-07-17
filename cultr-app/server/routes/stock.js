// GET /api/stock
// Devuelve { "BLANK-IP15": 42, "BLANK-S24": 0, ... }
// El personalizador lo consume para deshabilitar los modelos agotados.

import { Router } from "express";
import { getBlankStock } from "../lib/inventory.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const stock = await getBlankStock();
    const publicView = {};
    for (const [sku, v] of Object.entries(stock)) publicView[sku] = v.quantity;
    res.set("Cache-Control", "public, max-age=30");
    res.json(publicView);
  } catch (err) {
    console.error("[stock]", err);
    res.status(500).json({ error: "No se pudo leer el stock" });
  }
});

export default router;
