---
name: pipeline_manager
description: "职位 Pipeline 管理。适用于当前 chat 已经绑定职位后，把候选人真实加入该职位的 Pipeline，或把候选人推进到新的 Pipeline 节点。默认用于招聘推进，不要用写 MEMORY、手改 JSON 或口头承诺来冒充已加入/已更新。该 skill 只在当前 chat 已绑定职位时可用。"
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

# 职位 Pipeline 管理 Skill

当用户要把候选人正式加入当前职位的 Pipeline，或要维护某个候选人在当前职位里的推进节点时，使用本 skill。

## 核心规则

1. 只能操作**当前 chat 已经绑定的职位**。
2. 如果当前 chat 还没有绑定职位，不要假装加入成功；应先提示用户绑定职位，必要时切换给 `job_creator`。
3. 只要你宣称“已加入 Pipeline”或“已更新节点”，就必须通过本 skill 的脚本真实落库。
4. 不要手工改 `recruitment_pipeline_entries.json`、`chats.json`、`MEMORY.md` 或其他文件来冒充成功。
5. 当前第一版的主要动作是：
   - 查看当前职位 Pipeline
   - 把候选人加入当前职位 Pipeline
   - 把候选人推进到新的节点
   - 更新我方判断（很合适 / 合适 / 待评估 / 淘汰）

## 默认阶段语义

- `lead`：线索
- `active`：推进中
- `interview`：面试中
- `offer`：Offer 中
- `closed`：已归档

不要把“我方是否看好”“候选人是否有意向”混成节点本身。节点只表示流程位置。

## 我方判断枚举

- `strong_yes`：很合适
- `yes`：合适
- `unsure`：待评估
- `no`：淘汰

这里的“我方判断”是招聘方对候选人的判断，不等于 Pipeline 节点本身。

## 默认初始化建议

### 候选人主动投递

- `source_type=inbound`
- `stage=lead`
- `recruiter_interest=unsure`
- `candidate_interest=yes`

### Agent / HR 主动搜到的人

- `source_type=outbound`
- `stage=lead`
- `recruiter_interest=unsure`
- `candidate_interest=unknown`

## 执行步骤

### Step 1：先确认当前 chat 已绑定职位

当前环境上下文里会给出：

- `Session ID`
- `User ID`
- `Channel`
- `Working directory`

如果你不确定当前职位下已有谁，或者要先确认节点状态，先运行查看脚本：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/pipeline_manager/scripts/list_pipeline.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>"
```

### Step 2：加入候选人到当前职位 Pipeline

当你已经拿到候选人的基本信息，且用户希望把 TA 正式放进当前职位推进时，运行：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/pipeline_manager/scripts/add_candidate.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>" \
  --name "<候选人姓名>" \
  --age "<年龄>" \
  --school "<学校>" \
  --education-experience "<教育经历摘要>" \
  --current-title "<当前职位>" \
  --current-company "<当前公司>" \
  --latest-work-experience "<最近一段工作经历摘要>" \
  --city "<城市>" \
  --education "<教育信息>" \
  --expected-salary "<期望薪资>" \
  --resume-detail-url "<简历详情页>" \
  --source-platform "<来源平台>" \
  --source-candidate-key "<平台候选人标识>" \
  --source-resume-id "<简历 ID>" \
  --source-type "outbound" \
  --stage "lead" \
  --recruiter-interest "unsure" \
  --candidate-interest "unknown" \
  --summary "<一句话推荐理由>"
```

补充说明：

- 如果已经在当前职位里了，脚本会返回已有记录，不会重复加入。
- 若是主动投递，把 `source-type` 改成 `inbound`，并把 `candidate-interest` 设为 `yes`。
- 如果信息足够，尽量把这些字段一起传进去：`age`、`school`、`education-experience`、`latest-work-experience`。不要只塞姓名和一句摘要。

### Step 3：把候选人推进到新节点

优先用稳定标识定位候选人：

- `entry-id`
- `candidate-id`
- `source-resume-id`

如果这些都没有，且当前职位下该姓名唯一，也可以用 `candidate-name`。

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/pipeline_manager/scripts/update_stage.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>" \
  --candidate-name "<候选人姓名>" \
  --stage "interview" \
  --note "<推进原因>"
```

### Step 4：更新我方判断

当用户说“把这个人标成很合适 / 合适 / 待评估 / 淘汰”时，运行：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/pipeline_manager/scripts/update_assessment.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>" \
  --candidate-name "<候选人姓名>" \
  --recruiter-interest "strong_yes" \
  --note "<判断原因>"
```

优先使用更稳定的定位方式：

- `entry-id`
- `candidate-id`
- `source-resume-id`
- `candidate-name` 只在当前职位下唯一时兜底使用

## 什么时候用这个 skill

- 用户说“把这个人加入 Pipeline”
- 用户说“把 TA 放到这个职位里跟进”
- 用户说“把这个候选人推进到面试中 / Offer 中 / 归档”
- 用户说“把这个候选人标成很合适 / 合适 / 待评估 / 淘汰”
- 你已经完成候选人推荐，并且用户明确要把其中某人正式纳入该职位推进

## 什么时候不要用

- 当前 chat 还没绑定职位
- 用户只是想看样本，不想真的入池
- 你还没拿到足够的候选人身份信息，无法稳定识别是谁

## 输出风格

- 结果要短、清楚、偏执行确认
- 说明当前候选人已加入、已移动到哪个节点，或我方判断已改成什么
- 如出现歧义，要明确指出是“同名候选人冲突”还是“当前 chat 未绑定职位”
