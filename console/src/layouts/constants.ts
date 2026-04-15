// ── URLs ──────────────────────────────────────────────────────────────────

export const PYPI_URL = "https://pypi.org/pypi/copaw/json";

export const GITHUB_URL = "https://github.com/agentscope-ai/CoPaw" as const;

// ── Timing ────────────────────────────────────────────────────────────────

export const ONE_HOUR_MS = 60 * 60 * 1000;

// ── Navigation ────────────────────────────────────────────────────────────

export const DEFAULT_OPEN_KEYS: string[] = [];

export const KEY_TO_PATH: Record<string, string> = {
  chat: "/chat",
  channels: "/channels",
  sessions: "/sessions",
  "cron-jobs": "/cron-jobs",
  heartbeat: "/heartbeat",
  skills: "/skills",
  "skill-pool": "/skill-pool",
  tools: "/tools",
  mcp: "/mcp",
  workspace: "/workspace",
  agents: "/agents",
  models: "/models",
  environments: "/environments",
  "agent-config": "/agent-config",
  security: "/security",
  "token-usage": "/token-usage",
  "voice-transcription": "/voice-transcription",
};

export const KEY_TO_LABEL: Record<string, string> = {
  chat: "nav.chat",
  channels: "nav.channels",
  sessions: "nav.sessions",
  "cron-jobs": "nav.cronJobs",
  heartbeat: "nav.heartbeat",
  skills: "nav.skills",
  "skill-pool": "nav.skillPool",
  tools: "nav.tools",
  mcp: "nav.mcp",
  "agent-config": "nav.agentConfig",
  workspace: "nav.workspace",
  models: "nav.models",
  environments: "nav.environments",
  security: "nav.security",
  "token-usage": "nav.tokenUsage",
  agents: "nav.agents",
};

// ── URL helpers ───────────────────────────────────────────────────────────

export const getWebsiteLang = (lang: string): string =>
  lang.startsWith("zh") ? "zh" : "en";

export const getDocsUrl = (lang: string): string =>
  `https://copaw.agentscope.io/docs/intro?lang=${getWebsiteLang(lang)}`;

export const getFaqUrl = (lang: string): string =>
  `https://copaw.agentscope.io/docs/faq?lang=${getWebsiteLang(lang)}`;

export const getReleaseNotesUrl = (lang: string): string =>
  `https://copaw.agentscope.io/release-notes?lang=${getWebsiteLang(lang)}`;

// ── Version helpers ────────────────────────────────────────────────────────

// Filter out pre-release versions; post-releases are treated as stable.
// PEP 440 pre-release suffixes: aN / bN / rcN (or cN) / devN.
export const isStableVersion = (v: string): boolean =>
  !/(\d)(a|alpha|b|beta|rc|c|dev)\d*/i.test(v);

// Compare two PEP 440 version strings. Returns >0 if a>b, <0 if a<b, 0 if equal.
// .postN releases sort after their base version (e.g. 1.0.0.post1 > 1.0.0).
export const compareVersions = (a: string, b: string): number => {
  const normalise = (v: string) =>
    v
      .replace(/\.post(\d+)/i, ".$1")
      .split(/[.\-]/)
      .map((seg) => (isNaN(Number(seg)) ? 0 : Number(seg)));
  const aN = normalise(a);
  const bN = normalise(b);
  const len = Math.max(aN.length, bN.length);
  for (let i = 0; i < len; i++) {
    const diff = (aN[i] ?? 0) - (bN[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

// ── Update markdown ───────────────────────────────────────────────────────

export const UPDATE_MD: Record<string, string> = {
  zh: `### v0.0.2 更新日志

- 新增全局“职位”对象，职位不再跟着 Agent 切换而消失；Chat 仍归属于当前 Agent。
- Chat 支持绑定 0 或 1 个职位，并在左侧按“职位 -> 多个 Chat”分组展示；未绑定对话统一收进 \`playground\`。
- 新增内置 \`job_creator\` 技能，可在未绑定职位的对话里创建职位，并自动把当前对话挂到该职位下。
- 支持 Agent 在识别出“当前对话明确属于某个已有职位”时自动完成绑定；已绑定后不可改绑。
- 默认 Agent 收敛为“Talora”，并确保 \`job_creator\`、\`job_intake_consultant\`、\`liepin_job_manage\`、\`resume_search\` 默认启用。
- 简历卡片优化：工作经历改为结构化展示公司、职位、时间，优先显示绝对时间，例如 \`2024.3-至今\`。
- Chat 工作台样式优化：左侧支持更紧凑的会话行、职位分组、按钮与版本提示样式调整。

### 升级方式

如果你是从源码部署，进入项目目录后执行：

\`\`\`
git pull origin main
pip install -e .
\`\`\`

如果你使用 Docker，请基于最新代码重新构建并重启容器。`,

  ru: `### v0.0.2 Release Notes

- Added a global Job entity so jobs persist across Agent switching; chats still belong to the current Agent.
- Chats can now bind to zero or one job and are grouped in the sidebar by “job -> chats”; unbound chats stay in \`playground\`.
- Added built-in \`job_creator\` skill to create a job inside an unbound chat and bind the current chat automatically.
- Agents can auto-bind an unbound chat to an existing job when the target job is uniquely clear.
- Default agent is now simplified to Talora with recruiting skills enabled by default.
- Resume cards now render work experience in a structured way with absolute dates when available.
- Chat workspace UI was refined with denser rows, grouped jobs, and updated button/version styling.

### Update

If installed from source:

\`\`\`
git pull origin main
pip install -e .
\`\`\`

If using Docker, rebuild your image from the latest code and restart the container.`,

  en: `### v0.0.2 Release Notes

- Added a global Job entity so jobs no longer disappear when switching Agents; chats still belong to the current Agent.
- Chats can bind to zero or one job and are grouped in the sidebar by “job -> chats”; unbound chats live under \`playground\`.
- Added the built-in \`job_creator\` skill so an unbound chat can create a job and auto-bind itself to that job.
- Agents can now auto-bind an unbound chat to an existing job when the target job is uniquely clear.
- Simplified the default setup to a single Talora agent with \`job_creator\`, \`job_intake_consultant\`, \`liepin_job_manage\`, and \`resume_search\` enabled by default.
- Resume cards now render work experience in a structured layout with absolute dates when available.
- Refined the Chat workspace UI with grouped jobs, denser rows, and updated button/version styling.

### Update

If installed from source:

\`\`\`
git pull origin main
pip install -e .
\`\`\`

If using Docker, rebuild your image from the latest code and restart the container.`,
};
