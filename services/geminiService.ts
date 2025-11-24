import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { AnalysisReport } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeSchema = async (schemaContent: string): Promise<AnalysisReport> => {
  const ai = getClient();
  
  // Truncate schema if it's massive to avoid token limits, though 2.5 Flash has a huge context window.
  // 100k chars is usually safe for a schema file.
  const safeContent = schemaContent.slice(0, 100000); 

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Analyze the following Ruby on Rails schema.rb content:\n\n${safeContent}`,
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
    // Ensure all fields exist to match the AnalysisReport interface and prevent UI crashes
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