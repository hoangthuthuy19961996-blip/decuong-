import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { Quiz, QuestionType } from "../types";

const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 1. Generate Quiz (Thinking Model + JSON Schema)
export const generateQuiz = async (
  textInput: string,
  files: File[],
  grade: string,
  subject: string
): Promise<Quiz> => {
  const fileParts = await Promise.all(files.map(fileToGenerativePart));

  const prompt = `
    Create a comprehensive study quiz for a ${grade} ${subject} student based on the provided content.
    The quiz MUST have exactly:
    - 12 Multiple Choice Questions
    - 3 True/False Questions
    - 5 Short Answer Questions
    
    Ensure the content is age-appropriate and engaging.
  `;

  // Define strict schema for the quiz
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A creative title for the quiz" },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            type: { type: Type.STRING, enum: [QuestionType.MultipleChoice, QuestionType.TrueFalse, QuestionType.ShortAnswer] },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Only for multiple_choice. Provide 4 options." },
            correctAnswer: { type: Type.STRING, description: "The correct answer key." },
          },
          required: ["id", "type", "text", "correctAnswer"],
        },
      },
    },
    required: ["title", "questions"],
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        ...fileParts,
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking for deep reasoning on content
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as Quiz;
    }
    throw new Error("No quiz generated");
  } catch (error) {
    console.error("Quiz Gen Error:", error);
    throw error;
  }
};

// 2. Grade Short Answers (Fast Model)
export const gradeShortAnswer = async (question: string, studentAnswer: string, modelAnswer: string): Promise<{ isCorrect: boolean; feedback: string }> => {
  const prompt = `
    Question: ${question}
    Correct Answer Key: ${modelAnswer}
    Student Answer: ${studentAnswer}
    
    Grade the student answer. It doesn't match exactly, but is it conceptually correct?
    Return JSON: { "isCorrect": boolean, "feedback": "short explanation" }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite", // Low latency model
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text || '{"isCorrect": false, "feedback": "Error grading"}');
};

// 3. Chat with Grounding (Maps & Search)
export const chatWithTutor = async (message: string, history: any[], useSearch: boolean, useMaps: boolean) => {
  const tools = [];
  if (useSearch) tools.push({ googleSearch: {} });
  if (useMaps) tools.push({ googleMaps: {} });

  const model = useSearch || useMaps ? "gemini-2.5-flash" : "gemini-3-pro-preview";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [...history, { role: "user", parts: [{ text: message }] }],
      config: {
        tools: tools.length > 0 ? tools : undefined,
      }
    });
    
    const text = response.text || "I couldn't generate a response.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return { text, groundingChunks };
  } catch (e) {
    console.error(e);
    return { text: "Error communicating with Tutor.", groundingChunks: [] };
  }
};

// 4. Image Generation (Imagen 4)
export const generateCreativeImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });
    
    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate image");
  }
};

// 5. Image Editing (Gemini 2.5 Flash Image)
export const editImageWithPrompt = async (file: File, prompt: string): Promise<string> => {
  const filePart = await fileToGenerativePart(file);
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          filePart.inlineData,
          { text: prompt }
        ]
      },
      config: {
        responseModalities: [Modality.IMAGE],
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image returned");
  } catch (e) {
    console.error(e);
    throw new Error("Failed to edit image");
  }
};

// 6. Video Generation (Veo 3)
export const generateVideo = async (prompt: string, inputFile?: File): Promise<string> => {
    // Ensure new instance with fresh key if needed, though strict usage suggests we rely on the key in env or handled by the logic below
    // Note: Veo requires checking the key via window.aistudio
    
    let operation;
    const modelName = 'veo-3.1-fast-generate-preview';

    if (inputFile) {
         const filePart = await fileToGenerativePart(inputFile);
         operation = await ai.models.generateVideos({
            model: modelName,
            prompt: prompt,
            image: {
                imageBytes: filePart.inlineData.data,
                mimeType: filePart.inlineData.mimeType
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
         });
    } else {
        operation = await ai.models.generateVideos({
            model: modelName,
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });
    }

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed");

    // Fetch the actual bytes
    const vidRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await vidRes.blob();
    return URL.createObjectURL(blob);
}
