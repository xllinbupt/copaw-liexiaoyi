// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
import { chatApi } from "../../api/modules/chat";
export type CopyableContent = {
  type?: string;
  text?: string;
  refusal?: string;
};

export type CopyableMessage = {
  role?: string;
  content?: string | CopyableContent[];
};

export type CopyableResponse = {
  output?: CopyableMessage[];
};

export type RuntimeLoadingBridgeApi = {
  getLoading?: () => boolean | string;
  setLoading?: (loading: boolean | string) => void;
};

export type ResumeCardPayload = {
  type?: string;
  card_type?: string;
  candidate_id?: string;
  resIdEncode?: string;
  resumeIdEncode?: string;
  candidate_name?: string;
  name?: string;
  gender?: string;
  sex?: string;
  age?: number | string;
  current_title?: string;
  current_company?: string;
  company?: string;
  city?: string;
  location?: string;
  years_experience?: number | string;
  education?: string;
  current_salary?: string;
  expected_salary?: string;
  updated_at?: string;
  tags?: string[];
  highlights?: string[];
  work_experiences?: Array<
    | string
    | {
        company?: string;
        title?: string;
        period?: string;
        start_date?: string;
        end_date?: string;
        start_time?: string;
        end_time?: string;
        start?: string;
        end?: string;
        from?: string;
        to?: string;
        is_current?: boolean;
        current?: boolean;
        to_present?: boolean;
        present?: boolean;
        summary?: string;
      }
  >;
  education_experiences?: Array<
    | string
    | {
        school?: string;
        major?: string;
        degree?: string;
        period?: string;
      }
  >;
  match_reason?: string;
  summary?: string;
  source?: string;
  resume_detail_url?: string;
  detail_url?: string;
  avatar_url?: string;
  [key: string]: unknown;
};

export type JobCardPayload = {
  type?: string;
  card_type?: string;
  job_id?: string;
  id?: string;
  job_name?: string;
  name?: string;
  title?: string;
  status?: string;
  job_status?: string;
  description?: string | string[];
  summary?: string | string[];
  requirements?: string | string[];
  city?: string;
  location?: string;
  salary_range?: string;
  pending_feedback_count?: number | string;
  tags?: string[];
  highlights?: string[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

const DUOLIE_RESUME_DETAIL_BASE =
  "https://www.duolie.com/resumedetail?resIdEncode=";

// ---------------------------------------------------------------------------
// Text extraction utilities
// ---------------------------------------------------------------------------

/** Extract copyable text from assistant response. */
export function extractCopyableText(response: CopyableResponse): string {
  const collectText = (assistantOnly: boolean) => {
    const chunks = (response.output || []).flatMap((item: CopyableMessage) => {
      if (assistantOnly && item.role !== "assistant") return [];

      if (typeof item.content === "string") {
        return [item.content];
      }

      if (!Array.isArray(item.content)) {
        return [];
      }

      return item.content.flatMap((content: CopyableContent) => {
        if (content.type === "text" && typeof content.text === "string") {
          return [content.text];
        }

        if (content.type === "refusal" && typeof content.refusal === "string") {
          return [content.refusal];
        }

        return [];
      });
    });

    return chunks.filter(Boolean).join("\n\n").trim();
  };

  return collectText(true) || JSON.stringify(response);
}

/** Extract plain text from user message content. */
export function extractUserMessageText(m: any): string {
  if (typeof m.content === "string") return m.content;
  if (!Array.isArray(m.content)) return "";
  return m.content
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text || "")
    .join("\n");
}

// ---------------------------------------------------------------------------
// Clipboard utilities
// ---------------------------------------------------------------------------

/** Copy text to clipboard with fallback for non-secure contexts. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  if (!copied) {
    throw new Error("Failed to copy text");
  }
}

// ---------------------------------------------------------------------------
// Error response utilities
// ---------------------------------------------------------------------------

/** Build a 400 error response when model is not configured. */
export function buildModelError(): Response {
  return new Response(
    JSON.stringify({
      error: "Model not configured",
      message: "Please configure a model first",
    }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// URL normalization utilities
// ---------------------------------------------------------------------------

/** Decode each path segment; keeps `/` delimiters (including repeated `/`). */
function decodeUriPathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

/** Convert file URL to stored path for backend: keep full path after `/files/preview/`. */
export function toStoredName(v: string): string {
  const marker = "/files/preview/";
  const idx = v.indexOf(marker);
  if (idx !== -1) {
    let rest = v.slice(idx + marker.length);
    const q = rest.indexOf("?");
    if (q !== -1) rest = rest.slice(0, q);
    const h = rest.indexOf("#");
    if (h !== -1) rest = rest.slice(0, h);
    if (rest) {
      const decoded = decodeUriPathSegments(rest);
      // Windows absolute path: C:\... or C:/...
      const isWindowsAbsolute = /^[a-zA-Z]:[\\/]/.test(decoded);
      if (isWindowsAbsolute) return decoded;
      return decoded.startsWith("/") ? decoded : `/${decoded}`;
    }
  }
  return v;
}

/** Convert content part URLs to stored name format. */
export function normalizeContentUrls(part: any): any {
  const p = { ...part };
  if (p.type === "image" && typeof p.image_url === "string")
    p.image_url = toStoredName(p.image_url);
  if (p.type === "file" && typeof p.file_url === "string")
    p.file_url = toStoredName(p.file_url);
  if (p.type === "audio" && typeof p.data === "string")
    p.data = toStoredName(p.data);
  if (p.type === "video" && typeof p.video_url === "string")
    p.video_url = toStoredName(p.video_url);
  return p;
}

/** Turn a backend content URL (path or full URL) into a full URL for display. */
export function toDisplayUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("file://")) url = url.replace("file://", "");
  return chatApi.filePreviewUrl(url.startsWith("/") ? url : `/${url}`);
}

function isLikelyResumeToken(value: string): boolean {
  return /^[a-zA-Z0-9]{16,}$/.test(value.trim());
}

function buildDuolieResumeDetailUrl(value: string | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("file://") || trimmed.startsWith("/")) {
    return toDisplayUrl(trimmed);
  }

  if (
    trimmed.includes("resIdEncode=") &&
    !trimmed.startsWith(DUOLIE_RESUME_DETAIL_BASE)
  ) {
    const token = trimmed.split("resIdEncode=").pop() || "";
    return `${DUOLIE_RESUME_DETAIL_BASE}${encodeURIComponent(token)}`;
  }

  if (isLikelyResumeToken(trimmed)) {
    return `${DUOLIE_RESUME_DETAIL_BASE}${encodeURIComponent(trimmed)}`;
  }

  return toDisplayUrl(trimmed);
}

function normalizeCardText(
  value: unknown,
  options?: {
    joinWith?: string;
  },
): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return "";
  }

  const joinWith = options?.joinWith ?? "\n";
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .join(joinWith)
    .trim();
}

export function isResumeCardPayload(
  value: unknown,
): value is ResumeCardPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as ResumeCardPayload;
  return (
    payload.type === "resume_card" || payload.card_type === "resume_card"
  );
}

export function normalizeResumeCardPayload(
  payload: ResumeCardPayload,
): ResumeCardPayload {
  const normalized = { ...payload };
  const detailToken =
    (typeof normalized.resIdEncode === "string" && normalized.resIdEncode) ||
    (typeof normalized.resumeIdEncode === "string" &&
      normalized.resumeIdEncode) ||
    (typeof normalized.resume_detail_url === "string" &&
    isLikelyResumeToken(normalized.resume_detail_url)
      ? normalized.resume_detail_url
      : "") ||
    (typeof normalized.detail_url === "string" &&
    isLikelyResumeToken(normalized.detail_url)
      ? normalized.detail_url
      : "");

  if (typeof normalized.resume_detail_url === "string") {
    normalized.resume_detail_url = buildDuolieResumeDetailUrl(
      normalized.resume_detail_url,
    );
  }
  if (typeof normalized.detail_url === "string") {
    normalized.detail_url = buildDuolieResumeDetailUrl(normalized.detail_url);
  }
  if (typeof normalized.avatar_url === "string") {
    normalized.avatar_url = toDisplayUrl(normalized.avatar_url);
  }
  if (!normalized.resume_detail_url && detailToken) {
    normalized.resume_detail_url = buildDuolieResumeDetailUrl(detailToken);
  }
  if (!normalized.detail_url && normalized.resume_detail_url) {
    normalized.detail_url = normalized.resume_detail_url;
  }

  return normalized;
}

type ParsedResumeCardsResult = {
  cards: ResumeCardPayload[];
  remainingText: string;
};

function coerceResumeCards(value: unknown): ResumeCardPayload[] {
  if (Array.isArray(value)) {
    return value.filter(isResumeCardPayload).map(normalizeResumeCardPayload);
  }
  if (isResumeCardPayload(value)) {
    return [normalizeResumeCardPayload(value)];
  }
  return [];
}

export function parseResumeCardsFromText(
  text: string | undefined,
): ParsedResumeCardsResult {
  if (!text || !text.includes("resume_card")) {
    return { cards: [], remainingText: text || "" };
  }

  const cards: ResumeCardPayload[] = [];
  let remainingText = text;
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;

  remainingText = remainingText.replace(fencePattern, (fullMatch, jsonText) => {
    try {
      const parsed = JSON.parse(String(jsonText).trim());
      const parsedCards = coerceResumeCards(parsed);
      if (parsedCards.length === 0) return fullMatch;
      cards.push(...parsedCards);
      return "";
    } catch {
      return fullMatch;
    }
  });

  if (cards.length === 0) {
    const trimmed = text.trim();
    try {
      const parsed = JSON.parse(trimmed);
      const parsedCards = coerceResumeCards(parsed);
      if (parsedCards.length > 0) {
        return { cards: parsedCards, remainingText: "" };
      }
    } catch {
      // ignore invalid raw JSON
    }
  }

  return {
    cards,
    remainingText: remainingText.replace(/\n{3,}/g, "\n\n").trim(),
  };
}

export function isJobCardPayload(
  value: unknown,
): value is JobCardPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as JobCardPayload;
  return payload.type === "job_card" || payload.card_type === "job_card";
}

export function normalizeJobCardPayload(
  payload: JobCardPayload,
): JobCardPayload {
  const normalized = { ...payload };
  const normalizedJobId =
    (typeof normalized.job_id === "string" && normalized.job_id.trim()) ||
    (typeof normalized.id === "string" && normalized.id.trim()) ||
    "";
  const normalizedJobName =
    (typeof normalized.job_name === "string" && normalized.job_name.trim()) ||
    (typeof normalized.name === "string" && normalized.name.trim()) ||
    (typeof normalized.title === "string" && normalized.title.trim()) ||
    "";

  normalized.job_id = normalizedJobId;
  normalized.job_name = normalizedJobName;
  normalized.description =
    normalizeCardText(normalized.description) ||
    normalizeCardText(normalized.summary);
  normalized.requirements = normalizeCardText(normalized.requirements);
  normalized.status =
    (typeof normalized.status === "string" && normalized.status.trim()) ||
    (typeof normalized.job_status === "string" &&
      normalized.job_status.trim()) ||
    "";

  return normalized;
}

type ParsedJobCardsResult = {
  cards: JobCardPayload[];
  remainingText: string;
};

function coerceJobCards(value: unknown): JobCardPayload[] {
  if (Array.isArray(value)) {
    return value.filter(isJobCardPayload).map(normalizeJobCardPayload);
  }
  if (isJobCardPayload(value)) {
    return [normalizeJobCardPayload(value)];
  }
  return [];
}

export function parseJobCardsFromText(
  text: string | undefined,
): ParsedJobCardsResult {
  if (!text || !text.includes("job_card")) {
    return { cards: [], remainingText: text || "" };
  }

  const cards: JobCardPayload[] = [];
  let remainingText = text;
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;

  remainingText = remainingText.replace(fencePattern, (fullMatch, jsonText) => {
    try {
      const parsed = JSON.parse(String(jsonText).trim());
      const parsedCards = coerceJobCards(parsed);
      if (parsedCards.length === 0) return fullMatch;
      cards.push(...parsedCards);
      return "";
    } catch {
      return fullMatch;
    }
  });

  if (cards.length === 0) {
    const trimmed = text.trim();
    try {
      const parsed = JSON.parse(trimmed);
      const parsedCards = coerceJobCards(parsed);
      if (parsedCards.length > 0) {
        return { cards: parsedCards, remainingText: "" };
      }
    } catch {
      // ignore invalid raw JSON
    }
  }

  return {
    cards,
    remainingText: remainingText.replace(/\n{3,}/g, "\n\n").trim(),
  };
}
