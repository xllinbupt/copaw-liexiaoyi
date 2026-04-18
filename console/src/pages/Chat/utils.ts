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
  res_id_encode?: string;
  resumeIdEncode?: string;
  resume_id_encode?: string;
  source_platform?: string;
  candidate_name?: string;
  name?: string;
  resName?: string;
  gender?: string;
  sex?: string;
  sexName?: string;
  age?: number | string;
  current_title?: string;
  current_company?: string;
  company?: string;
  title?: string;
  companyName?: string;
  city?: string;
  currentCity?: string;
  current_city?: string;
  location?: string;
  dqName?: string;
  expectDqName?: string;
  expectCity?: string;
  expect_city?: string;
  years_experience?: number | string;
  work_years?: number | string;
  workYears?: number | string;
  education?: string;
  expect_title?: string;
  expectTitle?: string;
  expectJobtitle?: string;
  expect_jobtitle?: string;
  expect_location?: string;
  expectLocation?: string;
  eduLevelName?: string;
  eduLevelTzName?: string;
  industryName?: string;
  current_salary?: string;
  salary?: number | string;
  salaryMonths?: number | string;
  expected_salary?: string;
  expect_salary?: string;
  expectSalary?: string;
  salary_expect?: string;
  expectSalaryShowName?: string;
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
  recent_work?: Array<{
    company?: string;
    company_name?: string;
    companyName?: string;
    title?: string;
    title_name?: string;
    titleName?: string;
    period?: string;
    start_time?: string;
    end_time?: string;
    startTime?: string;
    endTime?: string;
    summary?: string;
  }>;
  recentWork?: Array<{
    company?: string;
    company_name?: string;
    companyName?: string;
    title?: string;
    title_name?: string;
    titleName?: string;
    period?: string;
    start_time?: string;
    end_time?: string;
    startTime?: string;
    endTime?: string;
    summary?: string;
  }>;
  recentWorkList?: Array<{
    companyName?: string | null;
    titleName?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    summary?: string | null;
  }>;
  education_experiences?: Array<
    | string
    | {
        school?: string;
        major?: string;
        degree?: string;
        period?: string;
      }
  >;
  highestEdu?: {
    school?: string | null;
    school_name?: string | null;
    schoolName?: string | null;
    major?: string | null;
    major_name?: string | null;
    majorName?: string | null;
    degree?: string | null;
    eduLevelName?: string | null;
    level?: string | null;
    enrollment_type?: string | null;
    enrollmentType?: string | null;
    unifiedEnrollmentName?: string | null;
    type?: string | null;
    period?: string | null;
    enroll_time?: string | null;
    enrollTime?: string | null;
    graduate_time?: string | null;
    graduateTime?: string | null;
  };
  expectList?: Array<{
    salaryLower?: number | string | null;
    salaryUpper?: number | string | null;
    salaryMonths?: number | string | null;
    industryName?: string | null;
    dqName?: string | null;
    jobtitleName?: string | null;
    otherExpectDqNames?: string[] | null;
  }>;
  eduExperienceList?: Array<{
    startTime?: string | null;
    endTime?: string | null;
    schoolName?: string | null;
    majorName?: string | null;
    tzFlagName?: string | null;
    eduLevelName?: string | null;
  }>;
  workExperienceList?: Array<{
    startTime?: string | null;
    endTime?: string | null;
    companyName?: string | null;
    workPlaceName?: string | null;
    jobtitleName?: string | null;
    title?: string | null;
    departmentName?: string | null;
    duty?: string | null;
  }>;
  languageList?: Array<{
    languageName?: string | null;
    proficiencyName?: string | null;
    levelName?: string | null;
  }>;
  certificateList?: string[];
  selfAssessment?: string;
  additional?: string;
  match_reason?: string;
  matchReason?: string;
  match_note?: string;
  brief?: string;
  summary?: string;
  source?: string;
  resume_detail_url?: string;
  detail_url?: string;
  urlPc?: string;
  urlH5?: string;
  url_pc?: string;
  url_h5?: string;
  resume_url?: string;
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

function extractResumeToken(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const matched = trimmed.match(/[?&]resIdEncode=([A-Za-z0-9]+)/i);
  if (matched?.[1]) return matched[1];
  if (trimmed.startsWith("resIdEncode=")) {
    return trimmed.slice("resIdEncode=".length).trim();
  }
  if (isLikelyResumeToken(trimmed)) {
    return trimmed;
  }
  return "";
}

export function buildLiepinResumeDetailUrl(
  resumeToken: string | undefined,
): string {
  const token = extractResumeToken(resumeToken);
  if (!token) return "";
  return `https://lpt.liepin.com/resume/detail?resIdEncode=${encodeURIComponent(token)}&sfrom=R_SEARCH_CONDITION`;
}

function normalizeResumeDetailUrl(value: string | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("file://") || trimmed.startsWith("/")) {
    return toDisplayUrl(trimmed);
  }

  if (trimmed.includes("resIdEncode=") || isLikelyResumeToken(trimmed)) {
    return buildLiepinResumeDetailUrl(trimmed);
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

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function normalizeYearMonthValue(value: string | undefined | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{6}$/.test(trimmed)) {
    const year = trimmed.slice(0, 4);
    const month = String(Number(trimmed.slice(4, 6)));
    return `${year}.${month}`;
  }
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function buildPeriodFromYearMonth(
  start: string | undefined | null,
  end: string | undefined | null,
): string {
  const startValue = normalizeYearMonthValue(start);
  const endValue = normalizeYearMonthValue(end);
  if (startValue && endValue) return `${startValue}-${endValue}`;
  if (startValue) return `${startValue}-至今`;
  return endValue;
}

function formatSalaryRange(params: {
  lower?: number | string | null;
  upper?: number | string | null;
  months?: number | string | null;
}): string {
  const lower =
    params.lower === null || params.lower === undefined
      ? ""
      : String(params.lower).trim();
  const upper =
    params.upper === null || params.upper === undefined
      ? ""
      : String(params.upper).trim();
  const months =
    params.months === null || params.months === undefined
      ? ""
      : String(params.months).trim();

  const range = lower && upper ? `${lower}-${upper}` : lower || upper;
  if (!range) return "";
  return months ? `${range} x ${months}薪` : range;
}

function normalizeEducationExperiencesFromDetail(
  value: ResumeCardPayload["eduExperienceList"],
): NonNullable<ResumeCardPayload["education_experiences"]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const school = firstNonEmptyString(item.schoolName);
      const major = firstNonEmptyString(item.majorName);
      const degree = firstNonEmptyString(item.eduLevelName, item.tzFlagName);
      const period = buildPeriodFromYearMonth(item.startTime, item.endTime);
      if (!school && !major && !degree && !period) return null;
      return { school, major, degree, period };
    })
    .filter(Boolean) as NonNullable<ResumeCardPayload["education_experiences"]>;
}

function normalizeEducationSummaryObject(
  value: unknown,
): NonNullable<ResumeCardPayload["education_experiences"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const education = value as Record<string, unknown>;
  const school = firstNonEmptyString(
    education.school,
    education.school_name,
    education.schoolName,
  );
  const major = firstNonEmptyString(
    education.major,
    education.major_name,
    education.majorName,
  );
  const enrollmentType = firstNonEmptyString(
    education.enrollment_type,
    education.enrollmentType,
    education.unifiedEnrollmentName,
    education.type,
  );
  const degreeBase = firstNonEmptyString(
    education.degree,
    education.eduLevelName,
    education.level,
  );
  const degree = [degreeBase, enrollmentType ? `(${enrollmentType})` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  const period = firstNonEmptyString(
    education.period,
    buildPeriodFromYearMonth(
      firstNonEmptyString(
        education.enroll_time,
        education.enrollTime,
        education.start_time,
        education.startTime,
      ),
      firstNonEmptyString(
        education.graduate_time,
        education.graduateTime,
        education.end_time,
        education.endTime,
      ),
    ),
  );

  if (!school && !major && !degree && !period) return [];
  return [{ school, major, degree, period }];
}

function normalizeWorkExperiencesFromDetail(
  value: ResumeCardPayload["workExperienceList"],
): NonNullable<ResumeCardPayload["work_experiences"]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const company = firstNonEmptyString(item.companyName);
      const title = firstNonEmptyString(item.jobtitleName, item.title);
      const period = buildPeriodFromYearMonth(item.startTime, item.endTime);
      const summary = firstNonEmptyString(item.duty, item.departmentName);
      const city = firstNonEmptyString(item.workPlaceName);
      if (!company && !title && !period && !summary && !city) return null;
      return {
        company,
        title,
        period,
        summary: [city, summary].filter(Boolean).join(" | "),
      };
    })
    .filter(Boolean) as NonNullable<ResumeCardPayload["work_experiences"]>;
}

function normalizeWorkExperiencesFromSummary(
  value: unknown,
): NonNullable<ResumeCardPayload["work_experiences"]> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const experience = item as Record<string, unknown>;
      const company = firstNonEmptyString(
        experience.company,
        experience.company_name,
        experience.companyName,
      );
      const title = firstNonEmptyString(
        experience.title,
        experience.title_name,
        experience.titleName,
        experience.jobtitleName,
      );
      const period = firstNonEmptyString(
        experience.period,
        buildPeriodFromYearMonth(
          firstNonEmptyString(experience.start_time, experience.startTime),
          firstNonEmptyString(experience.end_time, experience.endTime),
        ),
      );
      const summary = firstNonEmptyString(experience.summary);
      if (!company && !title && !period && !summary) return null;
      return { company, title, period, summary };
    })
    .filter(Boolean) as NonNullable<ResumeCardPayload["work_experiences"]>;
}

function normalizeTagText(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function isEducationRelatedTag(
  tag: string,
  payload: ResumeCardPayload,
): boolean {
  const normalizedTag = normalizeTagText(tag);
  if (!normalizedTag) return false;

  const educationTokens = new Set<string>();
  const educationExperiences = Array.isArray(payload.education_experiences)
    ? payload.education_experiences
    : [];

  for (const item of educationExperiences) {
    if (typeof item === "string") {
      educationTokens.add(normalizeTagText(item));
      continue;
    }

    const school = normalizeTagText(item.school);
    const major = normalizeTagText(item.major);
    const degree = normalizeTagText(item.degree);
    const period = normalizeTagText(item.period);

    [school, major, degree].filter(Boolean).forEach((token) => {
      educationTokens.add(token);
    });

    [
      [school, degree].filter(Boolean).join(" · "),
      [school, major, degree].filter(Boolean).join(" · "),
      [school, degree, period].filter(Boolean).join(" · "),
      [school, major, degree, period].filter(Boolean).join(" · "),
      [school, degree].filter(Boolean).join(" | "),
      [school, major, degree].filter(Boolean).join(" | "),
    ]
      .map((itemText) => normalizeTagText(itemText))
      .filter(Boolean)
      .forEach((token) => educationTokens.add(token));
  }

  [
    normalizeTagText(payload.education),
    normalizeTagText(payload.eduLevelName),
  ]
    .filter(Boolean)
    .forEach((token) => educationTokens.add(token));

  for (const token of educationTokens) {
    if (!token) continue;
    if (normalizedTag === token) return true;
    if (normalizedTag.includes(token) || token.includes(normalizedTag)) {
      return true;
    }
  }

  return false;
}

function normalizeTagsFromDetail(payload: ResumeCardPayload): string[] {
  const tags = new Set<string>();
  const rawTags = Array.isArray(payload.tags) ? payload.tags : [];
  for (const tag of rawTags) {
    if (typeof tag === "string" && tag.trim()) {
      const normalizedTag = normalizeTagText(tag);
      if (normalizedTag && !isEducationRelatedTag(normalizedTag, payload)) {
        tags.add(normalizedTag);
      }
    }
  }

  const industry = firstNonEmptyString(payload.industryName);
  if (industry) tags.add(industry);

  const languages = Array.isArray(payload.languageList)
    ? payload.languageList
        .map((item) =>
          firstNonEmptyString(
            [item.languageName, item.levelName].filter(Boolean).join(" "),
            item.languageName,
          ),
        )
        .filter(Boolean)
    : [];
  for (const language of languages.slice(0, 2)) {
    tags.add(language);
  }

  const certificates = Array.isArray(payload.certificateList)
    ? payload.certificateList
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
    : [];
  for (const certificate of certificates.slice(0, 2)) {
    tags.add(certificate);
  }

  return Array.from(tags).slice(0, 5);
}

function normalizeHighlightsFromDetail(payload: ResumeCardPayload): string[] {
  const highlights = new Set<string>();
  const rawHighlights = Array.isArray(payload.highlights) ? payload.highlights : [];
  for (const item of rawHighlights) {
    if (typeof item === "string" && item.trim()) highlights.add(item.trim());
  }

  const latestWork = Array.isArray(payload.workExperienceList)
    ? payload.workExperienceList[0]
    : undefined;
  const latestWorkLine = latestWork
    ? [latestWork.companyName, latestWork.jobtitleName || latestWork.title]
        .filter(Boolean)
        .join(" | ")
    : "";
  if (latestWorkLine) highlights.add(`最近经历：${latestWorkLine}`);

  const selfAssessment = firstNonEmptyString(payload.selfAssessment);
  if (selfAssessment) highlights.add(selfAssessment);

  const additional = firstNonEmptyString(payload.additional);
  if (additional) highlights.add(additional);

  return Array.from(highlights)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
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
  normalized.resIdEncode = firstNonEmptyString(
    normalized.resIdEncode,
    normalized.res_id_encode,
  );
  normalized.resumeIdEncode = firstNonEmptyString(
    normalized.resumeIdEncode,
    normalized.resume_id_encode,
  );
  const normalizedEducationExperiences =
    Array.isArray(normalized.education_experiences) &&
    normalized.education_experiences.length > 0
      ? normalized.education_experiences
      : normalizeEducationExperiencesFromDetail(normalized.eduExperienceList);
  const summaryEducationExperiences =
    normalizedEducationExperiences.length > 0
      ? normalizedEducationExperiences
      : normalizeEducationSummaryObject(normalized.education);
  const highestEducationExperiences =
    summaryEducationExperiences.length > 0
      ? summaryEducationExperiences
      : normalizeEducationSummaryObject(normalized.highestEdu);
  const normalizedWorkExperiences =
    Array.isArray(normalized.work_experiences) &&
    normalized.work_experiences.length > 0
      ? normalized.work_experiences
      : normalizeWorkExperiencesFromDetail(normalized.workExperienceList);
  const summaryWorkExperiences =
    normalizedWorkExperiences.length > 0
      ? normalizedWorkExperiences
      : normalizeWorkExperiencesFromSummary(
          Array.isArray(normalized.recent_work)
            ? normalized.recent_work
            : normalized.recentWork,
        );
  const recentWorkListExperiences =
    summaryWorkExperiences.length > 0
      ? summaryWorkExperiences
      : normalizeWorkExperiencesFromSummary(normalized.recentWorkList);
  const expectedSalaryFromExpect = Array.isArray(normalized.expectList)
    ? formatSalaryRange({
        lower: normalized.expectList[0]?.salaryLower,
        upper: normalized.expectList[0]?.salaryUpper,
        months: normalized.expectList[0]?.salaryMonths,
      })
    : "";
  const currentSalaryFromDetail = formatSalaryRange({
    lower: normalized.salary,
    months: normalized.salaryMonths,
  });

  normalized.resume_detail_url = firstNonEmptyString(
    normalized.resume_detail_url,
    normalized.resume_url,
    typeof normalized.url_pc === "string" ? normalized.url_pc : "",
    typeof normalized.urlPc === "string" ? normalized.urlPc : "",
    typeof normalized.url_h5 === "string" ? normalized.url_h5 : "",
    typeof normalized.urlH5 === "string" ? normalized.urlH5 : "",
    buildLiepinResumeDetailUrl(normalized.resIdEncode),
    buildLiepinResumeDetailUrl(normalized.resumeIdEncode),
  );
  normalized.detail_url = firstNonEmptyString(
    normalized.detail_url,
    normalized.resume_detail_url,
    normalized.resume_url,
    typeof normalized.url_pc === "string" ? normalized.url_pc : "",
    typeof normalized.urlPc === "string" ? normalized.urlPc : "",
    typeof normalized.url_h5 === "string" ? normalized.url_h5 : "",
    typeof normalized.urlH5 === "string" ? normalized.urlH5 : "",
    buildLiepinResumeDetailUrl(normalized.resIdEncode),
    buildLiepinResumeDetailUrl(normalized.resumeIdEncode),
  );

  normalized.source_platform = firstNonEmptyString(
    normalized.source_platform,
    normalized.source,
    normalized.resIdEncode || normalized.resumeIdEncode ? "liexiaoxia" : "",
  );
  normalized.candidate_id = firstNonEmptyString(
    normalized.candidate_id,
    normalized.resIdEncode,
    normalized.resumeIdEncode,
  );
  normalized.candidate_name = firstNonEmptyString(
    normalized.candidate_name,
    normalized.name,
    normalized.resName,
  );
  normalized.gender = firstNonEmptyString(
    normalized.gender,
    normalized.sex,
    normalized.sexName,
  );
  normalized.current_title = firstNonEmptyString(
    normalized.current_title,
    normalized.title,
    normalized.expect_title,
    normalized.expectTitle,
    normalized.companyName ? "" : normalized.title,
    recentWorkListExperiences[0] &&
      typeof recentWorkListExperiences[0] !== "string"
      ? recentWorkListExperiences[0].title
      : "",
    normalized.workExperienceList?.[0]?.jobtitleName,
    normalized.workExperienceList?.[0]?.title,
  );
  normalized.current_company = firstNonEmptyString(
    normalized.current_company,
    normalized.company,
    normalized.companyName,
    recentWorkListExperiences[0] &&
      typeof recentWorkListExperiences[0] !== "string"
      ? recentWorkListExperiences[0].company
      : "",
    normalized.workExperienceList?.[0]?.companyName,
  );
  normalized.city = firstNonEmptyString(
    normalized.city,
    normalized.currentCity,
    normalized.current_city,
    normalized.location,
    normalized.dqName,
    normalized.expectDqName,
    normalized.expectCity,
    normalized.expect_city,
    normalized.expect_location,
    normalized.expectLocation,
    normalized.expectList?.[0]?.dqName,
    normalized.workExperienceList?.[0]?.workPlaceName,
  );
  normalized.education_experiences = highestEducationExperiences;
  normalized.work_experiences = recentWorkListExperiences;
  normalized.education = firstNonEmptyString(
    normalized.education,
    normalized.eduLevelName,
    Array.isArray(highestEducationExperiences) &&
      highestEducationExperiences.length > 0 &&
      typeof highestEducationExperiences[0] !== "string"
      ? [
          highestEducationExperiences[0].school,
          highestEducationExperiences[0].major,
          highestEducationExperiences[0].degree,
        ]
          .filter(Boolean)
          .join(" ")
      : "",
  );
  normalized.expected_salary = firstNonEmptyString(
    normalized.expected_salary,
    normalized.expect_salary,
    normalized.expectSalary,
    normalized.salary_expect,
    normalized.expectSalaryShowName,
    expectedSalaryFromExpect,
  );
  normalized.current_salary = firstNonEmptyString(
    normalized.current_salary,
    currentSalaryFromDetail,
  );
  if (
    (normalized.years_experience === undefined ||
      normalized.years_experience === null ||
      normalized.years_experience === "") &&
    (normalized.work_years !== undefined ||
      normalized.workYears !== undefined ||
      (Array.isArray(normalized.workExperienceList) &&
        normalized.workExperienceList.length > 0))
  ) {
    normalized.years_experience =
      normalized.work_years ??
      normalized.workYears ??
      normalized.workExperienceList?.length;
  }
  if (!Array.isArray(normalized.tags) || normalized.tags.length === 0) {
    normalized.tags = normalizeTagsFromDetail(normalized);
  }
  if (!Array.isArray(normalized.highlights) || normalized.highlights.length === 0) {
    normalized.highlights = normalizeHighlightsFromDetail(normalized);
  }
  normalized.summary = firstNonEmptyString(
    normalized.summary,
    typeof normalized.brief === "string" ? normalized.brief : "",
    normalized.selfAssessment,
    normalized.additional,
  );
  normalized.match_reason = firstNonEmptyString(
    normalized.match_reason,
    normalized.matchReason,
    normalized.match_note,
    normalized.summary,
  );
  if (typeof normalized.resume_detail_url === "string") {
    normalized.resume_detail_url = normalizeResumeDetailUrl(
      normalized.resume_detail_url,
    );
  }
  if (typeof normalized.detail_url === "string") {
    normalized.detail_url = normalizeResumeDetailUrl(normalized.detail_url);
  }
  if (typeof normalized.avatar_url === "string") {
    normalized.avatar_url = toDisplayUrl(normalized.avatar_url);
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

type PendingCardBlockResult = {
  remainingText: string;
  pending: boolean;
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

function hidePendingCardBlock(
  text: string | undefined,
  cardType: "resume_card" | "job_card",
): PendingCardBlockResult {
  if (!text || !text.includes(cardType)) {
    return {
      remainingText: text || "",
      pending: false,
    };
  }

  const fenceMatches = [...text.matchAll(/```/g)];
  if (fenceMatches.length % 2 === 1) {
    const pendingStart = fenceMatches[fenceMatches.length - 1]?.index ?? -1;
    if (pendingStart >= 0) {
      const pendingBlock = text.slice(pendingStart);
      if (pendingBlock.includes(cardType)) {
        return {
          remainingText: text.slice(0, pendingStart).replace(/\n{3,}/g, "\n\n").trim(),
          pending: true,
        };
      }
    }
  }

  const rawJsonStartCandidates = [
    text.lastIndexOf("\n{"),
    text.lastIndexOf("\n["),
    text.startsWith("{") ? 0 : -1,
    text.startsWith("[") ? 0 : -1,
  ].filter((value) => value >= 0);

  const rawJsonStart = rawJsonStartCandidates.length
    ? Math.max(...rawJsonStartCandidates)
    : -1;

  if (rawJsonStart >= 0) {
    const pendingBlock = text.slice(rawJsonStart).trimStart();
    if (pendingBlock.includes(cardType)) {
      try {
        JSON.parse(pendingBlock);
      } catch {
        return {
          remainingText: text
            .slice(0, rawJsonStart)
            .replace(/\n{3,}/g, "\n\n")
            .trim(),
          pending: true,
        };
      }
    }
  }

  return {
    remainingText: text,
    pending: false,
  };
}

export function hidePendingResumeCardBlock(
  text: string | undefined,
): PendingCardBlockResult {
  return hidePendingCardBlock(text, "resume_card");
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

export function hidePendingJobCardBlock(
  text: string | undefined,
): PendingCardBlockResult {
  return hidePendingCardBlock(text, "job_card");
}
