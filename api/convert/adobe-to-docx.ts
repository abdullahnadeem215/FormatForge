import type { VercelRequest, VercelResponse } from '@vercel/node';
import AdobeSDK from "@adobe/pdfservices-node-sdk";
import fs from 'fs';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({});
  
  try {
    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const clientId = process.env.ADOBE_CLIENT_ID?.trim();
    const clientSecret = process.env.ADOBE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Adobe credentials not configured' });
    }

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
    const source = AdobeSDK.FileRef.createFromLocalFile(file.filepath, AdobeSDK.ExportPDF.SupportedSourceFormat.pdf);
    exportPDFOperation.setInput(source);

    // 5. Execute
    const result = await exportPDFOperation.execute(executionContext);

    const outputFilePath = `/tmp/output-${Date.now()}.docx`;
    await result.saveAsFile(outputFilePath);

    const buffer = fs.readFileSync(outputFilePath);
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="converted.docx"`);
    res.send(buffer);

    // Cleanup
    if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);

  } catch (err: any) {
    console.error("Adobe PDF Services Error:", err);
    res.status(500).json({ 
      error: err.message || "Adobe conversion failed",
      details: err.details || "Check Adobe credentials"
    });
  }
}
