
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { AnalysisReport } from '../types';

// Declare process to prevent TypeScript errors in browser environments without node types
declare const process: { env: { [key: string]: string | undefined } };

export const analyzeSchema = async (schemaContent: string): Promise<AnalysisReport> => {
  // Safe access to process.env.API_KEY
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';
  
  if (!apiKey) {
    console.warn("API Key is missing. Gemini features will fail.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Truncate schema if it's massive to avoid token limits
  const safeContent = schemaContent.slice(0, 100000); 

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Analyze the following database schema content (which may be SQL, Prisma, Rails, or Django):\n\n${safeContent}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          potentialIssues: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          suggestions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        }
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  try {
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || "No summary provided.",
      potentialIssues: Array.isArray(parsed.potentialIssues) ? parsed.potentialIssues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    };
  } catch (e) {
    console.error("Failed to parse JSON", e);
    throw new Error("Failed to parse analysis results");
  }
};
