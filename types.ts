export enum ExtractionStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING', // Waiting in queue
  PROCESSING = 'PROCESSING', // Currently extracting
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface ExtractedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  status: ExtractionStatus;
  content: string;
  errorMessage?: string;
  progress?: number;
}

export enum SupportedMimeTypes {
  PDF = 'application/pdf',
  PNG = 'image/png',
  JPEG = 'image/jpeg',
  WEBP = 'image/webp',
  HEIC = 'image/heic',
  HEIF = 'image/heif',
  MP3 = 'audio/mpeg',
  WAV = 'audio/wav',
  AAC = 'audio/aac',
  FLAC = 'audio/flac',
  MP4 = 'video/mp4',
  MPEG = 'video/mpeg',
  MOV = 'video/quicktime',
  AVI = 'video/x-msvideo',
  WMV = 'video/x-ms-wmv',
  TXT = 'text/plain',
  HTML = 'text/html',
  RTF = 'application/rtf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ZIP = 'application/zip',
  EPUB = 'application/epub+zip',
}