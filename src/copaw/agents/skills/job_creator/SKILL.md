---
name: job_creator
description: "职位创建与职位绑定。适用于用户想先建一个职位框架、在当前 chat 里创建职位、或把当前 chat 绑定到明确已有职位的场景。只有当前 chat 尚未绑定职位时才允许使用；若已绑定职位，必须拒绝继续创建或绑定，因为系统不支持改绑。只要创建或绑定成功，就必须输出结构化 `job_card`，不要只给表格、列表或长段落。"
metadata:
  {
    "builtin_skill_version": "1.0",
    "copaw":
      {
        "emoji": "🧱",
        "requires": {}
      }
  }
---

# 职位创建 / 绑定 Skill

当用户明确希望“创建职位 / 建一个岗位框架 / 先把职位建起来”，或你已经能明确判断“当前 chat 就是在围绕某个已有职位推进”时，使用本 skill。

## 最重要的输出规则（先看这个）

- 只要职位创建成功，或已有职位绑定成功，就必须输出一个结构化 `job_card`。
- 不要只输出普通 markdown 表格、项目列表、长段落，或“卡片样式的文本”。
- 可以先用 1 到 2 句说明结果，但正式结果必须落到 `job_card`。
- 为了让前端稳定识别，`job_card` 应放在一个独立的 ```json 代码块里输出。
- `job_card` 至少要包含：`type`、`job_id`、`job_name`、`status`、`description`、`requirements`。
- 只有失败、拒绝、追问补充信息这几类情况，才不输出 `job_card`。

## 核心规则

1. 只能在**当前 chat 尚未绑定职位**时创建或绑定职位。
2. 如果当前 chat 已经绑定职位，**禁止**在这个 chat 里再次创建职位，也禁止继续绑定任何其他职位；系统不支持改绑。
3. 创建成功后，要把新职位**直接绑定到当前 chat**；如果是已有职位，就把该已有职位**直接绑定到当前 chat**。
4. 是否自动关联职位，可以由 Agent 自行判断，但前提必须是：当前 chat 尚未绑定职位，且你能明确判断它就是某一个具体职位。
5. 只有脚本成功返回，才算“职位已创建 / 已绑定”；不要用写 `MEMORY.md`、`PROFILE.md`、手工改 json 或普通文本确认来冒充成功。

## Agent 自动关联规则

当下面 3 个条件同时满足时，你可以直接把当前 chat 自动关联到已有职位，不必额外等用户下指令：

1. 当前 chat 还没有绑定职位。
2. 你能明确识别出是**哪一个具体职位**，不存在多个同名或多个候选职位。
3. 当前对话的目标、上下文、招聘推进内容明显都在围绕这个职位。

适合自动关联的典型情况：

- 用户直接说“继续刚才那个 AI 产品经理职位，帮我搜人”
- 用户在未绑定 chat 里持续讨论某个已存在职位的 JD、人选、反馈、推进动作
- 你刚完成职位访谈，已经能确认它对应的就是现有职位库中的唯一职位

不允许自动关联的情况：

- 你只是猜测“可能像是这个职位”
- 存在多个同名职位，或多个职位都可能匹配
- 用户明显在比较多个职位

如果不够确定，就先简短确认，不要强行绑错。

## 最小职位框架

创建职位时，至少沉淀这 3 个字段：

- 职位名称
- 职位描述
- 职位要求

如果用户信息不完整，不要把用户变成填表的人。优先基于当前上下文补成一个最小可用版本：

- 名称缺失：先追问 1 次，或按用户当前意图给出一个临时职位名
- 描述缺失：用 1 到 3 句概括岗位目标
- 要求缺失：用 3 到 6 条最关键要求归纳

## 执行步骤

### Step 1：先判断当前 chat 是否已绑定职位

当前环境上下文里会给出：

- `Session ID`
- `User ID`
- `Channel`
- `Working directory`

先使用这些值执行脚本；脚本会再次校验当前 chat 是否已绑定职位。

如果脚本返回“当前对话已绑定职位”，就不要继续创建或绑定，并直接告诉用户：

- 这个 chat 已经绑定职位
- 不能在当前 chat 里再新建职位
- 不能在当前 chat 里继续绑定或改绑职位
- 如需新职位，请新开一个未绑定的 chat

### Step 2：判断是“创建新职位”还是“绑定已有职位”

分两种路径：

- 路径 A：当前 chat 讨论的是一个**还不存在的新职位**
  走“创建新职位并绑定”
- 路径 B：当前 chat 讨论的是一个**已存在且能唯一确定的职位**
  走“绑定已有职位”

如果你要自动关联，必须满足上面的“Agent 自动关联规则”。

### Step 3A：补齐最少字段（仅创建新职位时）

如果名称、描述、要求已经足够，就不要追问。

如果缺得比较多，最多补 1 轮，优先问最影响建档的一项。

### Step 3B：运行脚本绑定已有职位（仅绑定已有职位时）

优先使用 `job_id`；如果只有职位名且能唯一命中，也可以用 `job_name`。

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/job_creator/scripts/bind_job.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>" \
  --job-id "<职位 ID>"
```

如果没有职位 ID，但你能唯一确定职位名：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/job_creator/scripts/bind_job.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>" \
  --job-name "<职位名称>"
```

### Step 4：运行脚本创建职位并绑定 chat（仅创建新职位时）

在当前 workspace 根目录下执行：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/job_creator/scripts/create_job.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>" \
  --name "<职位名称>" \
  --description "<职位描述>" \
  --requirements "<职位要求>"
```

不要手工改职位数据或 `chats.json`；统一走脚本。职位会写入全局职位库，chat 绑定只写当前 Agent 的 `chats.json`。

### Step 5：向用户确认结果

创建或绑定成功后，先用 1 到 2 句简短说明结果，然后输出一个结构化 `job_card`。

不要只给表格或列表。前端会把 `job_card` 渲染成职位卡片。

建议至少包含：

- `type`: 固定为 `job_card`
- `job_id`
- `job_name`
- `status`
- `description`
- `requirements`

可以按需补充：

- `city`
- `salary_range`
- `tags`
- `highlights`

你可以这样确认：

- 已创建职位，或已关联到已有职位
- 当前 chat 已绑定该职位
- 后续可继续做职位访谈、搜人、推荐

示例：

```json
{
  "type": "job_card",
  "job_id": "37033b9f-2558-45b7-b1ea-081f3a973eb9",
  "job_name": "AI 产品经理",
  "status": "未开始",
  "description": "负责 AI 方向产品规划与业务落地，推动模型能力在招聘场景中的应用。",
  "requirements": "1. 3 年以上产品经验；2. 熟悉 AI / 大模型相关产品；3. 有招聘或人力资源相关经验优先。",
  "city": "北京",
  "salary_range": "30万左右",
  "highlights": ["当前 chat 已绑定职位", "可继续完善 JD", "可直接开始搜人"]
}
```

## 输出风格

- 不要写成后台日志
- 不要长篇解释内部机制
- 以“已经帮你建好当前职位框架”为主

## 常见错误处理

### 错误 1：当前 chat 已绑定职位

直接拒绝重复创建或继续绑定，并说明系统不支持改绑。

### 错误 2：当前 chat 不存在

告诉用户当前对话上下文异常，请刷新后重试。

### 错误 3：职位不存在或无法唯一确定

不要强绑。告诉用户你需要更明确的职位标识，或先帮他确认到底是哪一个职位。

### 错误 4：名称为空

先补一个最小追问，不要直接执行空名称创建。
