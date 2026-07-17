// POST /webhooks/orders-create
// Shopify manda la orden completa. Por cada line item derivamos el blank
// desde el SKU de la variante y descontamos el stock compartido.
// Verificación HMAC incluida (SHOPIFY_WEBHOOK_SECRET).

import { Router } from "express";
import crypto from "crypto";
import { blankSkuFromVariantSku, decrementBlank } from "../lib/inventory.js";

const router = Router();

function verifyHmac(req) {
  const hmac = req.get("X-Shopify-Hmac-Sha256") || "";
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest));
  } catch {
    return false;
  }
}

router.post("/orders-create", async (req, res) => {
  if (!verifyHmac(req)) return res.status(401).send("HMAC inválido");

  // Responder rápido: Shopify reintenta si tardás >5s
  res.status(200).send("ok");

  const order = req.body;
  try {
    for (const item of order.line_items || []) {
      const blankSku = blankSkuFromVariantSku(item.sku);
      if (blankSku) await decrementBlank(blankSku, item.quantity);
    }
  } catch (err) {
    console.error("[webhook orders-create]", err);
  }
});

export default router;
