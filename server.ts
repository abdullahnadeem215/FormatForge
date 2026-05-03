import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import cors from "cors";
import fs from "fs";

import AdobeSDK from "@adobe/pdfservices-node-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const upload = multer({ dest: "/tmp" });

app.use(cors());
app.use(express.json());

// Adobe Credentials Test Endpoint
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", message: "API is reachable", environment: process.env.NODE_ENV });
});

app.get("/api/debug-env", (req, res) => {
  res.json({
    hasAdobeClientId: !!process.env.ADOBE_CLIENT_ID,
    hasAdobeClientSecret: !!process.env.ADOBE_CLIENT_SECRET,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
});

// COOP/COEP headers for ffmpeg.wasm - REQUIRED for high performance
app.use((req, res, next) => {
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// Adobe PDF Services Conversion Handler
async function handleAdobeConversion(req: any, res: any) {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const clientId = process.env.ADOBE_CLIENT_ID?.trim();
  const clientSecret = process.env.ADOBE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret || clientId === "undefined" || clientSecret === "undefined") {
    return res.status(500).json({ 
      error: "Adobe API credentials not configured. Please set ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET.",
      debug: { hasClientId: !!clientId, hasClientSecret: !!clientSecret }
    });
  }

  try {
    console.log(`📄 Adobe Processing (v3): ${req.file.originalname}`);

    // 1. Initialise credentials
    const credentials = AdobeSDK.Credentials.servicePrincipalCredentialsBuilder()
      .withClientId(clientId)
      .withClientSecret(clientSecret)
      .build();

    // 2. Initialise ExecutionContext
    const executionContext = AdobeSDK.ExecutionContext.create(credentials);

    // 3. Create Export PDF to DOCX operation
    const exportPDFOperation = AdobeSDK.ExportPDF.Operation.createNew(AdobeSDK.ExportPDF.SupportedTargetFormats.DOCX);

    // 4. Set input
    const source = AdobeSDK.FileRef.createFromLocalFile(req.file.path, AdobeSDK.ExportPDF.SupportedSourceFormat.pdf);
    exportPDFOperation.setInput(source);

    // 5. Execute
    const result = await exportPDFOperation.execute(executionContext);

    const outputFilePath = path.join("/tmp", `converted-${Date.now()}.docx`);
    
    // saveAsFile is the safest way to ensure the full file is written correctly
    await result.saveAsFile(outputFilePath);

    res.download(outputFilePath, "converted.docx", (err) => {
      // Cleanup both files
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
      if (err) {
        console.error("Download Error:", err);
      }
    });

  } catch (err: any) {
    console.error("Adobe PDF Services Error:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ 
      error: err.message || "Adobe conversion failed",
      details: err.details || "Check Adobe credentials or file format"
    });
  }
}

// Routes
app.post("/api/convert/adobe-to-docx", upload.single("file"), handleAdobeConversion);
app.post("/api/convert/ilovepdf-to-docx", upload.single("file"), handleAdobeConversion); // Aliasing for compatibility during transition

// Vite middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite();

export default app;

const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;

if (!isVercel) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Environment:", process.env.NODE_ENV);
  });
}
