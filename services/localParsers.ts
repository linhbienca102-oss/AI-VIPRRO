import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { extractWithGemini, isGeminiSupported } from './geminiService';

// Helper to read file as ArrayBuffer
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Helper to read file as Text
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// Helper to read file as Base64 (for Gemini)
const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove Data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const processFile = async (file: File): Promise<string> => {
  const mimeType = file.type;

  // 1. Handle ZIP files (Recursive Logic Concept - simplified to flat list for demo)
  if (mimeType === 'application/zip' || file.name.endsWith('.zip')) {
    return processZipFile(file);
  }

  // 2. Handle Gemini Native Types (PDF, Images, A/V)
  if (isGeminiSupported(mimeType)) {
    // Check size limit for base64 (approx 20MB safety for browser->API)
    // Gemini 2.5 allows up to 2GB files via File API, but inlineData is limited by request size (20MB).
    if (file.size > 20 * 1024 * 1024) {
      throw new Error("File quá lớn (>20MB) để xử lý trực tiếp trên trình duyệt. Vui lòng nén hoặc cắt nhỏ file.");
    }
    const base64 = await readFileAsBase64(file);
    return await extractWithGemini(base64, mimeType);
  }

  // 3. Handle Office Documents locally
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value; // The raw text
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx')) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(arrayBuffer);
    let text = "";
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      text += `--- Sheet: ${sheetName} ---\n`;
      text += XLSX.utils.sheet_to_csv(sheet); // CSV retains structure better than plain text for extraction
      text += "\n\n";
    });
    return text;
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.name.endsWith('.pptx')) {
      // PPTX parsing in browser is complex. 
      // Strategy: Treat as ZIP, extract text from XML slides, OR (better) fail gracefully if no lib.
      // For this demo, we will try a basic XML text extraction from the ZIP structure of the PPTX.
      return processPptxAsZip(file);
  }

  // 4. Handle Plain Text / HTML
  if (mimeType === 'text/plain' || mimeType === 'text/html' || mimeType === 'application/rtf' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    const text = await readFileAsText(file);
    if (mimeType === 'text/html') {
       // Basic strip tags for HTML
       const doc = new DOMParser().parseFromString(text, 'text/html');
       return doc.body.textContent || "";
    }
    return text;
  }
  
  // 5. EPUB (Basic handling)
  if (mimeType === 'application/epub+zip' || file.name.endsWith('.epub')) {
     // EPUB is a ZIP. 
     return processZipFile(file);
  }

  throw new Error(`Định dạng file không được hỗ trợ: ${mimeType}`);
};

// --- ZIP / PPTX Processing ---

const processZipFile = async (file: File): Promise<string> => {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  let combinedText = `--- ARCHIVE: ${file.name} ---\n`;

  const files = Object.keys(contents.files);
  
  // Process in parallel? Sequential to avoid memory spike on browser
  for (const filename of files) {
    if (contents.files[filename].dir) continue;

    combinedText += `\n--- FILE: ${filename} ---\n`;
    try {
      // Basic extraction for internal files. 
      // Warning: Deep nesting or complex formats inside ZIP might fail without full recursion.
      // We try to read as text for simplicity in ZIP mode, unless it's obviously binary.
      const fileData = await contents.files[filename].async('blob');
      
      // Determine type loosely by extension
      let ext = filename.split('.').pop()?.toLowerCase();
      let subFile = new File([fileData], filename, { type: getMimeFromExt(ext || '') });

      const extracted = await processFile(subFile);
      combinedText += extracted;

    } catch (e) {
      combinedText += `(Không thể trích xuất file này trong ZIP: ${e})\n`;
    }
  }
  return combinedText;
};

const processPptxAsZip = async (file: File): Promise<string> => {
    // PPTX is just a ZIP. The text is in ppt/slides/slide*.xml
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        let fullText = "";
        
        // Find all slide XMLs
        const slideFiles = Object.keys(contents.files).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/));
        // Sort naturally
        slideFiles.sort((a,b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0");
            const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0");
            return numA - numB;
        });

        for (const slide of slideFiles) {
            const xmlText = await contents.files[slide].async('string');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");
            // Text in PPTX is usually in <a:t> tags
            const textNodes = xmlDoc.getElementsByTagName("a:t");
            let slideText = "";
            for(let i=0; i<textNodes.length; i++) {
                slideText += textNodes[i].textContent + " ";
            }
            if (slideText.trim()) {
                 fullText += slideText + "\n";
            } else {
                 fullText += "(Trang trống)\n";
            }
        }
        return fullText || "(Không tìm thấy nội dung văn bản trong slide)";
    } catch (e) {
        console.error(e);
        throw new Error("Lỗi đọc file PPTX.");
    }
}

const getMimeFromExt = (ext: string): string => {
    const map: Record<string, string> = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'pdf': 'application/pdf',
        'txt': 'text/plain', 'xml': 'text/xml', 'json': 'application/json'
    };
    return map[ext] || 'application/octet-stream';
}