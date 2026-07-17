// ── Sistema de stock compartido ──────────────────────────────────────────
// La verdad del inventario vive en productos "blank" ocultos, uno por modelo:
//   SKU: BLANK-IP15, BLANK-IP15P, BLANK-S24, etc.
// Los productos de diseño NO trackean inventario propio. La disponibilidad
// por modelo se lee de acá (GET /api/stock) y el webhook de órdenes
// descuenta el blank correspondiente en cada venta.
//
// Vinculación diseño → blank: cada variante de diseño lleva el SKU con el
// sufijo del modelo (ej: "SUNSET-IP15"). El blank se deriva del sufijo.

import { adminGraphQL } from "./shopify.js";

// Cache simple en memoria (60s) para no pegarle a la API en cada pageview.
let cache = { at: 0, data: null };
const CACHE_MS = 60_000;

export function blankSkuFromVariantSku(variantSku = "") {
  // "SUNSET-IP15" -> "BLANK-IP15" | "CUSTOM-S24" -> "BLANK-S24"
  const parts = variantSku.split("-");
  const model = parts[parts.length - 1];
  return model ? `BLANK-${model}` : null;
}

export async function getBlankStock() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const data = await adminGraphQL(`
    {
      productVariants(first: 100, query: "sku:BLANK-*") {
        nodes {
          sku
          inventoryQuantity
          inventoryItem { id }
        }
      }
    }
  `);

  const stock = {};
  for (const v of data.productVariants.nodes) {
    stock[v.sku] = {
      quantity: v.inventoryQuantity,
      inventoryItemId: v.inventoryItem.id,
    };
  }
  cache = { at: Date.now(), data: stock };
  return stock;
}

export async function decrementBlank(blankSku, qty) {
  const stock = await getBlankStock();
  const blank = stock[blankSku];
  if (!blank) {
    console.warn(`[inventory] Blank desconocido: ${blankSku} — no se descuenta`);
    return;
  }

  // Ubicación principal (primera location activa de la tienda)
  const loc = await adminGraphQL(`{ locations(first: 1) { nodes { id } } }`);
  const locationId = loc.locations.nodes[0].id;

  await adminGraphQL(
    `
    mutation adjust($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors { field message }
      }
    }
  `,
    {
      input: {
        reason: "shrinkage",
        name: "available",
        changes: [
          {
            inventoryItemId: blank.inventoryItemId,
            locationId,
            delta: -Math.abs(qty),
          },
        ],
      },
    }
  );

  cache.at = 0; // invalidar cache
  console.log(`[inventory] ${blankSku} -${qty}`);
}
