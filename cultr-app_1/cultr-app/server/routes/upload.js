// POST /api/upload
// Recibe el archivo de impresión (PNG en base64, generado a resolución de
// impresión por el personalizador) y lo guarda en Shopify Files vía staged
// upload. Devuelve la URL, que el front adjunta como propiedad del line item
// (_print_file) para que cada orden llegue con su archivo listo.

import { Router } from "express";
import { adminGraphQL } from "../lib/shopify.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { dataUrl, filename = `cultr-${Date.now()}.png` } = req.body;
    if (!dataUrl?.startsWith("data:image/png;base64,")) {
      return res.status(400).json({ error: "dataUrl PNG base64 requerido" });
    }

    const buffer = Buffer.from(dataUrl.split(",")[1], "base64");

    // 1. Staged upload target
    const staged = await adminGraphQL(
      `
      mutation staged($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `,
      {
        input: [
          {
            resource: "FILE",
            filename,
            mimeType: "image/png",
            httpMethod: "POST",
            fileSize: String(buffer.length),
          },
        ],
      }
    );

    const target = staged.stagedUploadsCreate.stagedTargets[0];

    // 2. Subir el binario al target
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", new Blob([buffer], { type: "image/png" }), filename);
    const uploadRes = await fetch(target.url, { method: "POST", body: form });
    if (!uploadRes.ok) throw new Error(`Staged upload falló: ${uploadRes.status}`);

    // 3. Registrar el archivo en Shopify Files
    const fileCreate = await adminGraphQL(
      `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id }
          userErrors { field message }
        }
      }
    `,
      { files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }] }
    );

    const errs = fileCreate.fileCreate.userErrors;
    if (errs?.length) throw new Error(JSON.stringify(errs));

    // resourceUrl es suficiente para producción interna (el archivo queda en Files)
    res.json({ url: target.resourceUrl });
  } catch (err) {
    console.error("[upload]", err);
    res.status(500).json({ error: "No se pudo subir el archivo" });
  }
});

export default router;
