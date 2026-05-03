import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const PDF_TO_WORD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    success: { type: Type.BOOLEAN },
    content: { type: Type.STRING, description: "The extracted and formatted document content in Markdown format to preserve structure" },
    formatting: { 
      type: Type.OBJECT, 
      properties: {
        tables: { type: Type.ARRAY, items: { type: Type.STRING } },
        images: { type: Type.ARRAY, items: { type: Type.STRING, description: "Descriptions of images found" } },
        fonts: { type: Type.OBJECT, properties: { main: { type: Type.STRING } } }
      }
    },
    confidence: { type: Type.NUMBER }
  },
  required: ["success", "content"]
};

export async function summarizeDocument(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: `Summarize the following document content into key points:\n\n${text}` }] }],
  });
  return response.text;
}

export async function summarizePdf(pdfBase64: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: "Provide a comprehensive summary of this PDF document, identifying the main sections, core topics, and key takeaways." },
        { inlineData: { data: pdfBase64, mimeType: "application/pdf" } }
      ]
    }
  });
  return response.text;
}

export async function enhanceImageDescription(imageBase64: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: "Analyze this image and provide a detailed description and suggestions for enhancement." },
        { inlineData: { data: imageBase64, mimeType } }
      ]
    }
  });
  return response.text;
}

export async function reconstructDocument(imageBase64: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: "Reconstruct this document into a structured Markdown format. Preserve layout, tables, and headers as accurately as possible." },
        { inlineData: { data: imageBase64, mimeType } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: PDF_TO_WORD_SCHEMA
    }
  });
  return JSON.parse(response.text || '{}');
}
