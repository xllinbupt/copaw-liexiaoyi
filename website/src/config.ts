export interface SiteConfig {
  projectName: string;
  projectTaglineEn: string;
  projectTaglineZh: string;
  repoUrl: string;
  docsPath: string;
  /** When true or omitted, show Testimonials on homepage. */
  showTestimonials?: boolean;
  /**
   * ModelScope Studio one-click setup URL (no Python install).
   * Replace target when officially launched.
   */
  modelScopeForkUrl?: string;
}

const defaultConfig: SiteConfig = {
  projectName: "猎小易",
  projectTaglineEn: "Your dedicated AI headhunting assistant for HR teams",
  projectTaglineZh: "给到 HR 的专属猎头 Agent 助手",
  repoUrl: "https://github.com/agentscope-ai/CoPaw",
  docsPath: "/docs/",
  showTestimonials: true,
  modelScopeForkUrl:
    "https://modelscope.cn/studios/fork?target=AgentScope/CoPaw",
};

let cached: SiteConfig | null = null;

export async function loadSiteConfig(): Promise<SiteConfig> {
  if (cached) return cached;
  try {
    const r = await fetch("/site.config.json");
    if (r.ok) {
      cached = (await r.json()) as SiteConfig;
      return cached;
    }
  } catch {
    /* use defaults */
  }
  return defaultConfig;
}
