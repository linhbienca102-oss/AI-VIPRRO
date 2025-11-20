import { GoogleGenAI, Schema, Type } from "@google/genai";

// Initialize the Gemini client
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `
Nhiệm vụ của bạn là một công cụ OCR và trích xuất nội dung chính xác tuyệt đối.
1. Trích xuất TOÀN BỘ nội dung văn bản từ file được cung cấp (hình ảnh, PDF, âm thanh, video).
2. KHÔNG được bỏ sót chữ nào.
3. KHÔNG được tóm tắt.
4. KHÔNG sửa lỗi chính tả.
5. KHÔNG tự ý dịch.
6. KHÔNG thêm, bớt hoặc diễn giải nội dung.
7. Giữ nguyên định dạng (xuống dòng, khoảng cách, cấu trúc) tối đa có thể.
8. Nếu gặp trang trống, ghi chính xác dòng: "(Trang trống)".
9. Nếu nội dung không thể đọc được, ghi chính xác dòng: "(Không thể trích xuất nội dung trang này)".
10. Trả về kết quả dạng plain text thuần túy, không dùng Markdown code block (không dùng \`\`\`).
`;

/**
 * Extracts text from a file using Gemini's multimodal capabilities.
 * Handles Images, Audio, Video, and PDF directly.
 */
export const extractWithGemini = async (
  fileBase64: string,
  mimeType: string
): Promise<string> => {
  try {
    if (!apiKey) {
      throw new Error("API Key is missing. Please checking your environment configuration.");
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0, // Deterministic for extraction
        candidateCount: 1,
        // Disable thinking for pure extraction to save latency and tokens, 
        // unless complex reasoning was needed (it's not here).
        thinkingConfig: { thinkingBudget: 0 } 
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64,
            },
          },
          {
            text: "Trích xuất toàn bộ nội dung từ file này.",
          },
        ],
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error(`Lỗi trích xuất AI: ${error.message || "Unknown error"}`);
  }
};

/**
 * Validates if the mime type is supported natively by Gemini's inlineData
 */
export const isGeminiSupported = (mimeType: string): boolean => {
  const supported = [
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/flac', 'audio/x-m4a',
    'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp'
  ];
  return supported.includes(mimeType);
};