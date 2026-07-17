# Cultr — App de Shopify (personalizador + stock compartido)

App privada para la tienda Cultr. Tres piezas:

1. **Backend** (`/server`) — Express. Sube archivos de impresión a Shopify Files, expone el stock de blanks y descuenta inventario con cada orden.
2. **Personalizador** (`/extension`) — sección Liquid + JS + CSS para el theme. Selector de modelo con stock real, foto con drag/zoom, export a resolución de impresión, add to cart con `_print_file`.
3. **Sistema de blanks** — convención de SKUs que hace funcionar el inventario compartido.

---

## 1. Convención de SKUs (la base de todo)

- **Blanks** (productos ocultos, uno por modelo, con inventario trackeado):
  `BLANK-IP15`, `BLANK-IP15P`, `BLANK-S24`, etc.
- **Variantes de diseño y de custom** (inventario NO trackeado):
  `{DISEÑO}-{MODELO}` → `SUNSET-IP15`, `CUSTOM-S24`.

El sufijo del SKU vincula cada variante a su blank automáticamente. Crear un
drop nuevo = crear el producto con los SKUs correctos. Nada más.

## 2. Setup en Shopify (15 min)

1. **Custom app:** Settings → Apps and sales channels → Develop apps → Create app.
   Scopes del Admin API: `read_products`, `write_inventory`, `read_locations`,
   `write_files`, `read_orders`. Instalá y copiá el **Admin API access token**.
2. **Blanks:** creá un producto "Blanks" (oculto del catálogo, no publicado en
   Online Store) con una variante por modelo usando los SKUs `BLANK-*` y el
   stock real de tu estante. Activá "Track quantity".
3. **Producto Custom Case:** variantes por modelo con SKUs `CUSTOM-*`,
   sin track de inventario.
4. **Webhook:** Settings → Notifications → Webhooks → Create webhook:
   evento `Order creation`, formato JSON, URL `https://TU-BACKEND/webhooks/orders-create`.
   Copiá el signing secret que muestra Shopify.

## 3. Deploy del backend (10 min)

Railway, Render o Fly — cualquiera:

```bash
cd server
cp .env.example .env   # completá las 4 variables
npm install
npm start              # local: http://localhost:3000
```

En Railway: New Project → Deploy from repo (o subí la carpeta), agregá las
variables de entorno del `.env`, listo. La URL pública que te da es la
`app_url` del paso siguiente.

## 4. Instalar el personalizador en el theme

1. Online Store → Themes → Edit code.
2. Subí `extension/cultr-customizer.js` y `extension/cultr-customizer.css` a **Assets**.
3. Creá `sections/cultr-customizer.liquid` con el contenido de
   `extension/cultr-customizer.liquid`.
4. En el editor visual, en la plantilla del producto Custom Case, agregá la
   sección "Personalizador Cultr" y pegá la URL del backend en sus settings.

## 5. Flujo completo (para verificar)

Cliente elige modelo (agotados aparecen tachados) → sube foto → acomoda →
Agregar al carrito → el JS exporta el PNG a 1200×2400, lo sube al backend,
este lo guarda en Shopify Files y devuelve la URL → la orden llega con la
propiedad `_print_file` en el line item → el webhook descuenta el blank →
en 60s el modelo se marca agotado en toda la tienda si llegó a cero.

El archivo de impresión de cada orden está en el admin de la orden
(propiedad del item) y en Content → Files.

## Ajustes rápidos

- **Resolución de impresión:** `PRINT_W` / `PRINT_H` en `cultr-customizer.js`
  (ponelos según tu máquina UV; hoy 1200×2400).
- **Modelos:** se definen como variantes del producto en Shopify — el código
  no se toca.
- **Colores del personalizador:** variables CSS al inicio de
  `cultr-customizer.css`.

## Qué falta para las fases siguientes

- Add-ons como paso del flujo del personalizador (toggles antes del add to cart).
- Cross-sell "completá el drop" (productos vinculados por metafield de artista).
- Restock: hoy el stock se repone editando el blank en el admin (alcanza);
  más adelante, panel propio.
