export type Lang = "zh" | "en";

export const i18n: Record<Lang, Record<string, string>> = {
  zh: {
    "nav.docs": "文档",
    "nav.more": "更多",
    "nav.releaseNotes": "更新日志",
    "nav.download": "下载",
    "nav.installGuide": "安装向导",
    "nav.github": "GitHub",
    "nav.githubComingSoon": "Coming Soon",
    "nav.lang": "EN",
    "nav.agentscopeTeam": "AgentScope",
    "hero.slogan": "给到 HR 的专属猎头 Agent 助手",
    "hero.sub":
      "面向猎头与招聘团队的 AI 助手；支持本地部署、多端接入、招聘流程自动化，并可通过内置招聘 Skills 持续扩展。",
    "hero.cta": "查看文档",
    "follow.title": "关注我们",
    "follow.sub": "第一时间获取猎小易的招聘自动化更新",
    "follow.xiaohongshu": "小红书：",
    "follow.x": "X：",
    "follow.community.title": "加入社区",
    "follow.community.discord": "Discord",
    "follow.community.dingtalk": "钉钉群",
    "brandstory.title": "为什么是猎小易？",
    "brandstory.para1":
      "猎小易是一位为 HR 和猎头顾问打造的专属招聘 Agent，围绕搜人、读简历、初筛与协同推进而设计。",
    "brandstory.para2":
      "它不是泛用聊天机器人，而是能嵌入招聘日常、连接招聘数据、帮你持续推进候选人流程的团队成员。",
    "features.title": "核心能力",
    "features.channels.title": "多端招聘协同",
    "features.channels.desc":
      "支持控制台、钉钉、飞书等协同场景，把岗位沟通、简历结论与面试推进集中在一个入口。",
    "features.private.title": "数据在你手里",
    "features.private.desc":
      "支持本地部署和私有数据管理，简历、候选人评估与招聘知识可以沉淀在你自己的环境里。",
    "features.multiagent.title": "招聘角色协作",
    "features.multiagent.desc":
      "可按招聘流程拆分成搜寻、初筛、面试协调、候选人跟进等角色，让多个 Agent 分工协作。",
    "features.skills.title": "招聘 Skills",
    "features.skills.desc":
      "内置招聘场景 Skills，可自动加载本地扩展，例如多猎简历检索、文件阅读与可视浏览器操作。",
    "testimonials.title": "招聘团队怎么说",
    "testimonials.viewAll": "查看全部",
    "testimonials.1": "把搜人、看简历、发起沟通放在一个入口里，招聘效率一下顺了很多。",
    "testimonials.2": "本地部署让候选人数据更安心，Skills 也能按团队流程自己加。",
    "testimonials.3": "很适合需要沉淀方法论和流程标准的猎头团队。",
    "usecases.title": "你可以用猎小易做什么",
    "usecases.sub": "",
    "usecases.category.social": "人才搜寻",
    "usecases.category.creative": "岗位拆解",
    "usecases.category.productivity": "招聘推进",
    "usecases.category.research": "人才研判",
    "usecases.category.assistant": "简历与文件",
    "usecases.category.explore": "扩展接入",
    "usecases.social.1":
      "基于职位 JD、城市、年限、学历和关键词组合检索候选人，快速形成首批推荐名单。",
    "usecases.social.2":
      "调用内置的多猎 Skill 搜索候选人，并直接查看简历详情，减少来回切系统的成本。",
    "usecases.social.3":
      "把历史搜寻条件沉淀成可复用模板，让同类岗位的搜人动作标准化。",
    "usecases.creative.1":
      "把模糊的招聘需求拆成职责关键词、行业背景、目标公司与排除条件，自动生成搜寻策略。",
    "usecases.creative.2":
      "根据目标岗位产出候选人画像、面试关注点与推荐话术，帮助顾问统一评估口径。",
    "usecases.productivity.1":
      "按候选人阶段整理待办，提醒跟进、约面、反馈与 offer 推进，减少流程遗漏。",
    "usecases.productivity.2":
      "汇总聊天记录、简历亮点与评估结论，生成适合发给 HR 团队的结构化候选人摘要。",
    "usecases.productivity.3":
      "将岗位、候选人、沟通记录串起来，帮助招聘团队在控制台中快速回看进展。",
    "usecases.research.1":
      "对比候选人与 JD 的匹配度，标出优势、风险项、待核实信息和面试建议。",
    "usecases.research.2":
      "沉淀常见岗位的筛选标准、行业地图和问法模板，支持团队持续复用。",
    "usecases.assistant.1":
      "阅读本地简历、职位说明书和面试反馈文档，自动提炼重点并与候选人信息串联。",
    "usecases.explore.1":
      "继续接入更多招聘系统、表格或内部流程工具，把猎小易扩展成团队专属招聘操作台。",
    "quickstart.title": "快速开始",
    "quickstart.serviceNotice":
      "几分钟，获得一位面向 HR 的专属招聘 Agent。可本地部署，也可按你的团队流程继续扩展。",
    "quickstart.hintBefore": "安装 → 初始化 → 启动；频道配置见 ",
    "quickstart.hintLink": "文档",
    "quickstart.hintAfter": "，即可在控制台或协同频道里使用猎小易处理招聘任务。",
    "quickstart.method.pip": "pip",
    "quickstart.method.script": "脚本安装",
    "quickstart.method.docker": "Docker",
    "quickstart.method.cloud": "云部署",
    "quickstart.method.desktop": "桌面应用",
    "quickstart.desc.pip": "适合自行管理 Python 环境的用户",
    "quickstart.desc.script":
      "无需手动配置 Python，一行命令自动完成安装。脚本会自动下载 uv、创建虚拟环境并安装猎小易运行所需依赖（含 Node.js 和前端资源）。",
    "quickstart.desc.docker":
      "使用官方 Docker 镜像快速部署，隔离环境、便于管理",
    "quickstart.desc.cloud": "云端一键部署或在线运行，无需本地环境配置",
    "quickstart.desc.desktop":
      "独立打包的桌面应用，内置完整 Python 环境、所有依赖和前端资源。双击即用，无需命令行，无需预装任何工具。",
    "quickstart.platform.mac": "macOS / Linux",
    "quickstart.platform.windows": "Windows",
    "quickstart.shell.cmd": "CMD",
    "quickstart.shell.ps": "PowerShell",
    "quickstart.docker.hub": "Docker Hub",
    "quickstart.cloud.aliyun": "阿里云",
    "quickstart.cloud.modelscope": "魔搭",
    "quickstart.cloud.aliyunDeploy": "前往阿里云一键部署",
    "quickstart.cloud.aliyunDoc": "查看说明文档",
    "quickstart.cloud.modelscopeGo": "前往魔搭创空间",
    "quickstart.desktop.platforms": "支持平台",
    "quickstart.desktop.downloadGithub": "从 GitHub 下载",
    "quickstart.desktop.downloadCDN": "镜像下载",
    "quickstart.desktop.viewGuide": "查看使用指南",
    "quickstart.desktop.recommended": "推荐",
    "quickstart.badgeBeta": "Beta",
    footer: "猎小易 — 给到 HR 的专属猎头 Agent 助手",
    "footer.poweredBy.p1": "由 ",
    "footer.poweredBy.p2": " 基于 ",
    "footer.poweredBy.p3": "、",
    "footer.poweredBy.p3b": " 与 ",
    "footer.poweredBy.p4": " 打造。",
    "footer.poweredBy.team": "AgentScope 团队",
    "footer.poweredBy.agentscope": "AgentScope",
    "footer.poweredBy.runtime": "AgentScope Runtime",
    "footer.poweredBy.reme": "ReMe",
    "footer.inspiredBy": "部分灵感来源于 ",
    "footer.inspiredBy.name": "OpenClaw",
    "footer.thanksSkills": "感谢 ",
    "footer.thanksSkills.name": "anthropics/skills",
    "footer.thanksSkills.suffix": " 提供 Agent Skills 规范与示例。",
    "docs.backToTop": "返回顶部",
    "docs.copy": "复制",
    "docs.copied": "已复制",
    "docs.searchPlaceholder": "搜索文档",
    "docs.searchLoading": "加载中…",
    "docs.searchNoResults": "无结果",
    "docs.searchResultsTitle": "搜索结果",
    "docs.searchResultsTitleEmpty": "搜索文档",
    "docs.searchHint": "在左侧输入关键词后按回车搜索。",
    "releaseNotes.title": "更新日志",
    "releaseNotes.noReleases": "暂无更新日志",
  },
  en: {
    "nav.docs": "Docs",
    "nav.more": "More",
    "nav.releaseNotes": "Release Notes",
    "nav.download": "Download",
    "nav.installGuide": "Installation Guide",
    "nav.github": "GitHub",
    "nav.githubComingSoon": "Coming Soon",
    "nav.lang": "中文",
    "nav.agentscopeTeam": "AgentScope",
    "hero.slogan": "Your dedicated AI headhunting assistant for HR teams",
    "hero.sub":
      "An AI recruiting assistant for HR and headhunting teams, built for private deployment, resume workflows, candidate search, and extensible recruiting skills.",
    "hero.cta": "Read the docs",
    "follow.title": "Follow us",
    "follow.sub": "Follow us for the latest LieXiaoYi recruiting workflow updates",
    "follow.xiaohongshu": "Rednote:",
    "follow.x": "X:",
    "follow.community.title": "Join the community",
    "follow.community.discord": "Discord",
    "follow.community.dingtalk": "DingTalk",
    "brandstory.title": "Why LieXiaoYi?",
    "brandstory.para1":
      "LieXiaoYi is designed for HR and executive search teams that want a focused recruiting agent instead of a generic chat bot.",
    "brandstory.para2":
      "It helps search for talent, read resumes, structure evaluations, and keep recruiting pipelines moving inside your own environment.",
    "features.title": "Key capabilities",
    "features.channels.title": "Recruiting collaboration",
    "features.channels.desc":
      "Use the console or team channels to keep candidate summaries, interview progress, and team collaboration in one place.",
    "features.private.title": "Private by default",
    "features.private.desc":
      "Candidate data, recruiting notes, and team know-how stay in your own environment with local or private deployment options.",
    "features.multiagent.title": "Role-based recruiting agents",
    "features.multiagent.desc":
      "Split work across sourcing, screening, interview coordination, and follow-up so multiple agents can collaborate on one hiring flow.",
    "features.skills.title": "Recruiting skills",
    "features.skills.desc":
      "Built-in recruiting skills auto-load from your workspace, including local sourcing and resume lookup skills such as Duolie.",
    "testimonials.title": "What recruiting teams say",
    "testimonials.viewAll": "View all",
    "testimonials.1":
      "Candidate search, resume review, and team sync finally live in one workflow.",
    "testimonials.2":
      "Private deployment made adoption easier, and custom recruiting skills fit our process quickly.",
    "testimonials.3": "It feels much closer to a recruiting copilot than a generic assistant.",
    "usecases.title": "What you can do with LieXiaoYi",
    "usecases.sub": "",
    "usecases.category.social": "Talent sourcing",
    "usecases.category.creative": "Role design",
    "usecases.category.productivity": "Pipeline execution",
    "usecases.category.research": "Candidate evaluation",
    "usecases.category.assistant": "Resumes & files",
    "usecases.category.explore": "Workflow extensions",
    "usecases.social.1":
      "Search candidates by role, city, years of experience, school background, and hiring keywords to build a first-pass shortlist quickly.",
    "usecases.social.2":
      "Use the built-in Duolie skill to search candidate records and open detailed resumes without leaving the recruiting workflow.",
    "usecases.social.3":
      "Turn proven sourcing filters into reusable templates for similar mandates across the team.",
    "usecases.creative.1":
      "Break a hiring brief into responsibilities, keywords, target companies, exclusions, and must-have signals for more accurate sourcing.",
    "usecases.creative.2":
      "Generate candidate personas, interview focus points, and recommendation angles for each role.",
    "usecases.productivity.1":
      "Track follow-ups, interview scheduling, feedback collection, and offer progress so fewer candidates slip through the cracks.",
    "usecases.productivity.2":
      "Summarize resumes, chat notes, and evaluation decisions into structured candidate updates for HR stakeholders.",
    "usecases.productivity.3":
      "Keep role context, candidate status, and recruiter notes connected in a single workspace.",
    "usecases.research.1":
      "Compare candidates against the JD and flag strengths, risks, missing signals, and interview questions to validate.",
    "usecases.research.2":
      "Build a reusable internal knowledge base of role scorecards, market maps, and evaluation patterns.",
    "usecases.assistant.1":
      "Read local resumes, JDs, and interview feedback files, then extract the most relevant points for the hiring team.",
    "usecases.explore.1":
      "Connect more recruiting systems, spreadsheets, or internal workflows and turn LieXiaoYi into your team's recruiting control center.",
    "quickstart.title": "Quick start",
    "quickstart.serviceNotice":
      "Get a recruiting-first AI agent for your HR team in minutes, then extend it with your own sourcing and resume workflows.",
    "quickstart.hintBefore":
      "Install → init → start. Configure channels if you want to use LieXiaoYi across team tools. See ",
    "quickstart.hintLink": "docs",
    "quickstart.hintAfter": ".",
    "quickstart.method.pip": "pip",
    "quickstart.method.script": "Script",
    "quickstart.method.docker": "Docker",
    "quickstart.method.cloud": "Cloud",
    "quickstart.method.desktop": "Desktop",
    "quickstart.desc.pip": "If you prefer managing Python yourself",
    "quickstart.desc.script":
      "No Python setup required. One command downloads uv, creates a virtual environment, and installs LieXiaoYi with all required dependencies, including Node.js and frontend assets.",
    "quickstart.desc.docker":
      "Quick deployment with official Docker images, isolated environment and easy management",
    "quickstart.desc.cloud":
      "One-click cloud deployment or online execution, no local setup required",
    "quickstart.desc.desktop":
      "Standalone desktop app with bundled Python environment, all dependencies, and frontend assets. Double-click to run, no command line, no prerequisites required.",
    "quickstart.platform.mac": "macOS / Linux",
    "quickstart.platform.windows": "Windows",
    "quickstart.shell.cmd": "CMD",
    "quickstart.shell.ps": "PowerShell",
    "quickstart.docker.hub": "Docker Hub",
    "quickstart.cloud.aliyun": "Aliyun",
    "quickstart.cloud.modelscope": "ModelScope",
    "quickstart.cloud.aliyunDeploy": "Deploy on Aliyun ECS",
    "quickstart.cloud.aliyunDoc": "View Documentation",
    "quickstart.cloud.modelscopeGo": "Go to ModelScope Studio",
    "quickstart.desktop.platforms": "Supported Platforms",
    "quickstart.desktop.downloadGithub": "Download from GitHub",
    "quickstart.desktop.downloadCDN": "Mirror Download",
    "quickstart.desktop.viewGuide": "View User Guide",
    "quickstart.desktop.recommended": "recommended",
    "quickstart.badgeBeta": "Beta",
    footer: "LieXiaoYi — Your dedicated AI headhunting assistant for HR teams",
    "footer.poweredBy.p1": "Built by ",
    "footer.poweredBy.p2": " with ",
    "footer.poweredBy.p3": ", ",
    "footer.poweredBy.p3b": ", and ",
    "footer.poweredBy.p4": ".",
    "footer.poweredBy.team": "AgentScope team",
    "footer.poweredBy.agentscope": "AgentScope",
    "footer.poweredBy.runtime": "AgentScope Runtime",
    "footer.poweredBy.reme": "ReMe",
    "footer.inspiredBy": "Partly inspired by ",
    "footer.inspiredBy.name": "OpenClaw",
    "footer.thanksSkills": "Thanks to ",
    "footer.thanksSkills.name": "anthropics/skills",
    "footer.thanksSkills.suffix": " for the Agent Skills spec and examples.",
    "docs.backToTop": "Back to top",
    "docs.copy": "Copy",
    "docs.copied": "Copied",
    "docs.searchPlaceholder": "Search docs",
    "docs.searchLoading": "Loading…",
    "docs.searchNoResults": "No results",
    "docs.searchResultsTitle": "Search results",
    "docs.searchResultsTitleEmpty": "Search docs",
    "docs.searchHint": "Enter a keyword and press Enter to search.",
    "releaseNotes.title": "Release Notes",
    "releaseNotes.noReleases": "No release notes available",
  },
};

export function t(lang: Lang, key: string): string {
  return i18n[lang][key] ?? key;
}
