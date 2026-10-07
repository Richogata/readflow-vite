export type BookFormat = "pdf" | "epub";
export type ReadingStatus = "unread" | "reading" | "finished";

export interface ReadingPlanSession {
  date: string;
  startPage: number;
  endPage: number;
}

export interface Book {
  id: string;
  title: string;
  format: BookFormat;
  size: number;
  addedAt: number;
  totalPages: number;
  currentPage: number;
  progress: number;
  status: ReadingStatus;
  goalDate?: string;
  readingPlan?: ReadingPlanSession[];
  bookmarkPage?: number;
  epubCfi?: string;
}

export interface StoredBook extends Book {
  file: Blob;
  coverImage?: Blob;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  startedAt: number;
  seconds: number;
}

export interface BookNote {
  bookId: string;
  text: string;
  summary: string;
}
