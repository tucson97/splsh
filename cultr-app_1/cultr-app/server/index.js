import "dotenv/config";
import express from "express";
import cors from "cors";
import uploadRouter from "./routes/upload.js";
import webhooksRouter from "./routes/webhooks.js";
import stockRouter from "./routes/stock.js";

const app = express();

// CORS: solo tu tienda
app.use(
  cors({
    origin: [
      `https://${process.env.SHOPIFY_STORE}`,
      process.env.STOREFRONT_DOMAIN, // ej: https://cultr.au
    ].filter(Boolean),
  })
);

// rawBody necesario para verificar HMAC de webhooks
app.use(
  express.json({
    limit: "25mb", // archivos de impresión en base64
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get("/", (_req, res) => res.send("Cultr app ok"));
app.use("/api/upload", uploadRouter);
app.use("/api/stock", stockRouter);
app.use("/webhooks", webhooksRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Cultr app en puerto ${port}`));
