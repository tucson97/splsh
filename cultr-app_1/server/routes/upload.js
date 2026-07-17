// POST /api/upload
// Recibe el archivo de impresión (PNG o JPEG en base64) y lo guarda en
// Shopify Files vía staged upload. Devuelve la URL para _print_file.

import { Router } from "express";
import { adminGraphQL } from "../lib/shopify.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { dataUrl, filename = `cultr-${Date.now()}.jpg` } = req.body;
    const match = dataUrl?.match(/^data:image\/(png|jpeg);base64,/);
    if (!match) {
      return res.status(400).json({ error: "dataUrl PNG o JPEG base64 requerido" });
    }
    const mime = `image/${match[1]}`;

    const buffer = Buffer.from(dataUrl.split(",")[1], "base64");

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
            mimeType: mime,
            httpMethod: "POST",
            fileSize: String(buffer.length),
          },
        ],
      }
    );

    const target = staged.stagedUploadsCreate.stagedTargets[0];

    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", new Blob([buffer], { type: mime }), filename);
    const uploadRes = await fetch(target.url, { method: "POST", body: form });
    if (!uploadRes.ok) throw new Error(`Staged upload falló: ${uploadRes.status}`);

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

    res.json({ url: target.resourceUrl });
  } catch (err) {
    console.error("[upload]", err);
    res.status(500).json({ error: "No se pudo subir el archivo" });
  }
});

export default router;
