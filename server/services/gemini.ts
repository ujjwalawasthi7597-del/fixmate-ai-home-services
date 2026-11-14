import { GoogleGenAI, Type } from '@google/genai';
import { ENV } from '../config/env.ts';

function getGeminiClient(): GoogleGenAI {
  if (!ENV.GEMINI_API_KEY) {
    throw Object.assign(
      new Error('Gemini AI is not configured. Add GEMINI_API_KEY in Settings > Secrets.'),
      { status: 503 }
    );
  }
  return new GoogleGenAI({
    apiKey: ENV.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function diagnoseRepairIssue(params: {
  description: string;
  imageBase64?: string;
  mimeType?: string;
}) {
  const ai = getGeminiClient();

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (params.imageBase64 && params.mimeType) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: params.imageBase64,
      },
    });
  }
  parts.push({
    text: `Customer problem description: "${params.description || 'Analyze the uploaded image for home repair issues.'}"`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction:
        'You are FixMate AI Repair Assistant, a helpful home maintenance triage assistant. ' +
        'Analyze the homeowner description and any uploaded photo. ' +
        'CRITICAL RULES: ' +
        '1) NEVER claim certainty when diagnosing problems from descriptions or images—always frame findings as "possible causes" or "may indicate". ' +
        '2) NEVER provide dangerous electrical wiring, live circuit, refrigerant/gas line, or load-bearing structural repair instructions to unqualified users; instead advise shutting off power/valves safely if appropriate and booking a verified specialist. ' +
        '3) Match suggestedCategory strictly to one of: Electrician, Plumbing, AC Repair & Maintenance, Refrigerator Repair, Washing Machine Repair, Carpenter, Painting, Cleaning, Appliance Repair, Pest Control.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          problemTitle: { type: Type.STRING },
          possibleIssues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          suggestedCategory: { type: Type.STRING },
          suggestedCategorySlug: { type: Type.STRING },
          estimatedDuration: { type: Type.STRING },
          recommendedNextStep: { type: Type.STRING },
          preliminaryGuidance: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          safetyNotice: { type: Type.STRING },
          uncertaintyDisclaimer: { type: Type.STRING },
        },
        required: [
          'problemTitle',
          'possibleIssues',
          'suggestedCategory',
          'suggestedCategorySlug',
          'estimatedDuration',
          'recommendedNextStep',
          'preliminaryGuidance',
          'safetyNotice',
          'uncertaintyDisclaimer',
        ],
      },
    },
  });

  return JSON.parse((response.text ?? '{}').trim());
}

export async function generateJobDescription(params: {
  rawProblem: string;
  category?: string;
  propertyType?: string;
}) {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Raw customer input: "${params.rawProblem}". Category hint: "${params.category || 'Auto-detect'}". Property type: "${params.propertyType || 'Residential'}".`,
    config: {
      systemInstruction:
        'Convert the raw homeowner repair request into a crisp, structured service job description for a verified local technician. Do not invent facts not implied by the input; mark missing details as questions for inspection.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          problemTitle: { type: Type.STRING },
          issueDescription: { type: Type.STRING },
          serviceCategory: { type: Type.STRING },
          reportedSymptoms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          customerRequirements: { type: Type.STRING },
          technicianNotes: { type: Type.STRING },
        },
        required: [
          'problemTitle',
          'issueDescription',
          'serviceCategory',
          'reportedSymptoms',
          'customerRequirements',
          'technicianNotes',
        ],
      },
    },
  });

  return JSON.parse((response.text ?? '{}').trim());
}

export async function generateTechnicianTroubleshooting(params: {
  problemTitle: string;
  problemDescription: string;
  category: string;
  symptoms: string[];
}) {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Service Category: ${params.category}\nProblem Title: ${params.problemTitle}\nDescription: ${params.problemDescription}\nReported Symptoms: ${(params.symptoms || []).join(', ')}`,
    config: {
      systemInstruction:
        'You are an experienced technical field advisor assisting a verified FixMate service technician before a site visit. ' +
        'Provide a practical troubleshooting checklist, potential root causes (framed as possibilities requiring on-site verification), step-by-step inspection order, strict safety precautions (lockout/tagout, PPE, gas leak checks), and suggested tools/spare parts to carry.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          troubleshootingChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
          potentialCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
          inspectionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          safetyPrecautions: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedToolsAndMaterials: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'troubleshootingChecklist',
          'potentialCauses',
          'inspectionSteps',
          'safetyPrecautions',
          'suggestedToolsAndMaterials',
        ],
      },
    },
  });

  return JSON.parse((response.text ?? '{}').trim());
}
