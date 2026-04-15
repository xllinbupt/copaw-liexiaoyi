---
name: guidance
description: "回答用户关于 Talora 安装、配置、产品使用与本地开发的问题：优先定位并阅读本地文档与当前代码，再提炼答案；若本地信息不足，兜底访问官网文档。"
metadata:
  {
    "builtin_skill_version": "1.1",
    "copaw":
      {
        "emoji": "🧭",
        "requires": {}
      }
  }
---

# Talora 安装、配置与产品使用问答指南

当用户询问以下问题时，使用本 skill：

- Talora 的安装、初始化、升级、依赖要求、环境变量、模型配置
- 本地开发、调试、构建、部署方式
- 某个产品能力怎么用，某个页面/接口/命令/skill 是否支持
- 当前版本的实际行为，与文档是否一致

核心原则：

- 先查本地文档，再查当前代码，最后才兜底官网
- 回答要基于已读到的内容，不臆测
- 回答语言与用户提问语言保持一致
- 如果问题涉及“当前版本 / 当前仓库 / 当前页面”，以本地代码为准
- 如果问题是某个具体 skill 的使用方式，优先阅读对应的 `SKILL.md`

## 标准流程

### 第一步：定位文档位置

优先按这个顺序找文档：

1. 当前项目源码中的 `website/public/docs`
2. `~/.copaw/memory` 里记录过的文档目录
3. 当前工作目录或 `copaw` 安装路径附近的 docs

推荐命令：

```bash
# 1) 优先看当前项目 docs
rg --files website/public/docs 2>/dev/null

# 2) 看 memory 里是否记过文档目录
find ~/.copaw/memory -type f -name "*.md" 2>/dev/null | head -n 50

# 3) 如果需要，从 copaw 安装路径反推源码根目录
COP_PATH=$(command -v copaw 2>/dev/null)
if [ -n "$COP_PATH" ] && [[ "$COP_PATH" == *"/.copaw/bin/copaw" ]]; then
  COPAW_ROOT="${COP_PATH%/.copaw/bin/copaw}"
  DOC_DIR="$COPAW_ROOT/website/public/docs"
  find "$DOC_DIR" -type f -name "*.md" 2>/dev/null | head -n 100
fi

# 4) 兜底全局搜索
find . -path "*/website/public/docs/*.md" -o -path "*/docs/*.md" | head -n 100
```

如果确定了文档目录，请记录到 memory，格式如下：

```markdown
# 文档目录
$DOC_DIR = <doc_path>
```

### 第二步：文档检索与匹配

文档文件通常命名为 `<topic>.<lang>.md`，例如：

- `quickstart.zh.md`
- `config.en.md`
- `skills.zh.md`
- `models.zh.md`
- `commands.zh.md`
- `faq.en.md`

先列目录，再按关键词选文档。优先选择与用户语言一致的版本。

```bash
find "$DOC_DIR" -type f -name "*.md"
```

常见关键词映射：

- 安装 / 初始化 / 启动：`quickstart`, `cli`, `desktop`
- 配置 / 环境变量 / 模型：`config`, `models`, `channels`
- skill / 命令 / 使用方式：`skills`, `commands`, `faq`
- 多智能体 / MCP / memory：`multi-agent`, `mcp`, `memory`

### 第三步：阅读文档内容

找到候选文档后，读取并确认与问题相关的段落。优先读取最相关的部分，不要整篇照搬。

可使用：

- `cat <doc_path>`
- `rg -n "<keyword>" <doc_path>`
- `file_reader` skill（适合长文档或分段读取）

如果用户问的是“当前版本到底支不支持 / 页面为什么这样 / 某个接口返回什么”，只看文档不够，必须继续看代码。

重点代码位置通常包括：

- 后端：`src/copaw/...`
- 前端：`console/src/...`
- skill 定义：`src/copaw/agents/skills/<skill>/SKILL.md`

### 第四步：提取信息并作答

从文档中提取关键信息，组织成可执行答案：

- 先给直接结论
- 再给步骤/命令/配置示例
- 补充必要前置条件、版本前提与常见坑
- 如果答案来自代码而不是文档，要明确说明“这是根据当前代码判断”

语言要求：回答语言必须与用户提问语言一致（中文问就中文答，英文问就英文答）。

## 输出质量要求

- 不编造不存在的配置项或命令
- 遇到文档与代码不一致时，明确说明：当前仓库代码优先，文档可能滞后
- 遇到版本差异时，明确标注“需以当前版本为准”
- 涉及路径、命令、配置键时，尽量给可复制的原文片段
- 若信息仍不足，明确缺口并告诉用户还需要哪类信息（例如操作系统、安装方式、报错日志、具体页面）
