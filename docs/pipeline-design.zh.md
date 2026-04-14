# Pipeline 设计草案

## 1. 设计目标

这一版 `pipeline` 的目标，不是做完整 ATS，而是把“简历推荐”和“职位推进”真正沉淀成一个可操作的职位内候选人看板。

核心原则：

- `pipeline` 的底层是 **候选人与职位之间的关系**
- 同一个候选人可以出现在多个职位里，但候选人主档应尽量复用
- 早期流程不是单一路径，而是“来源 + 双边意向”共同决定是否继续推进
- 用户可以调整展示节点，但底层状态语义要稳定，方便后续统计、提醒和 Agent 自动化

## 2. 核心概念

### 2.1 CandidateProfile

`CandidateProfile` 表示“这个人是谁”，是全局人才主档。

建议一个候选人只保留一个 `CandidateProfile`，不同职位共用。

建议字段：

- `id`
- `source_platform`
- `source_candidate_key`
- `name`
- `gender`
- `age`
- `current_title`
- `current_company`
- `city`
- `years_experience`
- `education`
- `current_salary`
- `expected_salary`
- `resume_snapshot`
- `resume_detail_url`
- `avatar_url`
- `created_at`
- `updated_at`

说明：

- `resume_snapshot` 用来保存当前看到的简历摘要，避免后续外部简历变化后历史无法追溯
- `source_candidate_key` 用于后续去重，例如外部简历系统里的唯一标识

### 2.2 PipelineEntry

`PipelineEntry` 表示“这个候选人与这个职位当前是什么关系”，这是 pipeline 的核心对象。

建议字段：

- `id`
- `job_id`
- `candidate_id`
- `current_stage_id`
- `system_stage`
- `source_type`
- `recruiter_interest`
- `candidate_interest`
- `outcome`
- `status`
- `added_by`
- `owner_user_id`
- `source_chat_id`
- `source_session_id`
- `source_resume_id`
- `summary`
- `latest_activity_at`
- `created_at`
- `updated_at`

说明：

- `job_id + candidate_id` 在逻辑上应唯一，避免同一职位重复加入同一个人
- `summary` 保存“为什么进入当前阶段”的一句话摘要
- `status` 建议用于总开关，例如 `active / hired / closed`
- `added_by` 用于表示是谁把这条关系放进 pipeline，例如 `user / agent / system`
- `outcome` 只用于最终结果表达，不参与中间流转

### 2.3 PipelineStageDefinition

`PipelineStageDefinition` 表示展示层节点定义。

这里不建议做成完全自由状态机，而建议做“系统阶段 + 展示节点”的混合模式。

建议字段：

- `id`
- `workspace_id`
- `name`
- `system_stage`
- `color`
- `sort_order`
- `is_default`
- `is_archived`
- `created_at`
- `updated_at`

说明：

- `workspace_id` 用于同一个团队共享一套 pipeline 模板
- `system_stage` 用于保证底层语义稳定
- 用户可以增减、改名、调整顺序，但应映射到固定系统阶段

### 2.4 PipelineActivity

`PipelineActivity` 表示围绕候选人产生的历史变化记录。

建议字段：

- `id`
- `candidate_id`
- `job_id`
- `pipeline_entry_id`
- `job_name_snapshot`
- `action_type`
- `from_stage_id`
- `to_stage_id`
- `actor_type`
- `actor_name`
- `note`
- `payload`
- `created_at`

说明：

- 这张表的主视角应是“候选人”，不是“职位”
- `candidate_id` 是主归属字段，保证能串起同一候选人在不同职位里的完整历史
- `job_id` 是可选关联字段，用于表示这条记录发生在哪个职位上下文里
- `job_name_snapshot` 用于避免职位后来改名后，时间线回看时失去语义
- `pipeline_entry_id` 仍然保留，方便定位这次事件对应的是哪个职位关系
- 这张表用于记录“谁在什么时候把谁从哪个阶段改到了哪个阶段”
- 后续也可以记录“候选人回复了”“安排了面试”“标记无意向”“补了一条人工备注”等动作

## 3. 为什么 pipeline 不能只有一个 stage

招聘不是单边流程，而是双边关系。

前期最常见的分叉有两种：

1. 候选人主动投递
2. 招聘方主动搜人

这两种情况都不适合直接塞进阶段本身，更适合用关系字段表达。

建议增加以下维度：

### 3.1 来源 `source_type`

建议枚举：

- `inbound`
- `outbound`
- `referral`
- `talent_pool`
- `manual`

### 3.2 招聘侧判断 `recruiter_interest`

建议枚举：

- `yes`
- `unsure`
- `no`

### 3.3 候选人侧反馈 `candidate_interest`

建议枚举：

- `unknown`
- `yes`
- `no`
- `no_response`

这样一来：

- “候选人主动投递” = `source_type=inbound`
- “HR 主动找候选人” = `source_type=outbound`
- “双方初步看对眼” = `recruiter_interest=yes` 且 `candidate_interest=yes`

也就是说，前期不是靠 stage 分叉，而是靠关系属性决定是否推进。

## 4. 系统阶段建议

第一版建议把 `stage` 收得非常克制，只表达“流程走到哪一步”，不要混入“谁先有意向”“是否看上”这种判断语义。

建议第一版固定一套系统阶段：

- `lead`
- `active`
- `interview`
- `offer`
- `closed`

含义建议：

- `lead`：这名候选人已经和职位建立关系，但还没进入正式推进
- `active`：已经有实质沟通、筛选、协调、跟进动作
- `interview`：已进入正式面试流程
- `offer`：谈薪、审批、发 Offer、确认入职前
- `closed`：流程结束，不再继续推进

这里特别注意：

- `stage` 不表达招聘方是否看好
- `stage` 不表达候选人是否有意向
- `stage` 也不表达来源是主动投递还是主动搜人

这些都应该分别落在 `recruiter_interest`、`candidate_interest`、`source_type` 上。

## 5. 最终结果 `outcome`

为了避免把“流程位置”和“最终结果”混在一起，建议增加单独的 `outcome` 字段。

建议枚举：

- `unknown`
- `hired`
- `rejected_by_recruiter`
- `rejected_by_candidate`
- `no_response`
- `talent_pool`
- `job_closed`

说明：

- `outcome` 主要在 `stage=closed` 时使用
- `outcome=hired` 也可以视为已完成成功结果
- 这样就不需要把 `hired` 作为一个独立 `stage`

## 6. 展示节点如何做“灵活”

建议第一版采用：

- 底层 `system_stage` 固定
- 用户可配置 `display stage`

例如系统阶段和展示列可以这样映射：

- `lead` -> `新投递`
- `lead` -> `新搜到`
- `active` -> `接触中`
- `active` -> `推进中`
- `interview` -> `一面`
- `interview` -> `终面`
- `offer` -> `谈薪中`
- `closed` -> `归档`

这样用户有灵活度，但系统不会失去统计语义。

不建议第一版支持：

- 任意分叉图
- 任意节点类型
- 没有系统阶段映射的自由列

因为后续的提醒、统计、自动推进和 Agent 推荐都会依赖稳定语义。

## 7. 典型初始化规则

### 7.1 候选人主动投递

例如候选人主动投递到某职位，被 Agent 或系统加入 pipeline。

建议默认值：

- `source_type = inbound`
- `stage = lead`
- `recruiter_interest = unsure`
- `candidate_interest = yes`
- `outcome = unknown`
- `added_by = agent` 或 `system`

含义：

- 来源是候选人主动进来
- 候选人已经明确表达兴趣
- 招聘方还没有明确判断
- 当前只是建立关系，尚未正式推进

### 7.2 Agent 主动找到候选人

例如 Agent 搜到一个可能合适的人，并把 TA 放进某个职位。

建议默认值：

- `source_type = outbound`
- `stage = lead`
- `recruiter_interest = unsure`
- `candidate_interest = unknown`
- `outcome = unknown`
- `added_by = agent`

含义：

- 来源是我方主动搜人
- 这时招聘方是否真的认可还未确认
- 候选人也还没有表态
- 只是先建立关系，后续再决定是否推进

### 7.3 HR 明确要继续推进

当 HR 或 Agent 产生明确推进动作，例如已联系、已安排沟通、已做初筛。

建议变更：

- `stage = active`
- 若我方明确认可，可设置 `recruiter_interest = yes`

### 7.4 正式进入面试

- `stage = interview`

### 7.5 进入谈薪 / Offer

- `stage = offer`

### 7.6 流程结束

- `stage = closed`
- 同时填写 `outcome`

## 8. MVP 推荐数据结构

### 6.1 后端文件存储

当前职位还是 JSON 文件模式，因此 pipeline 第一版建议沿用同样思路：

- `recruitment_candidates.json`
- `recruitment_pipeline_entries.json`
- `recruitment_pipeline_stages.json`
- `recruitment_pipeline_activities.json`

这样改动最小，后面若需要再迁移数据库。

### 8.2 Pydantic 模型建议

建议新增：

- `CandidateProfile`
- `PipelineEntry`
- `PipelineStageDefinition`
- `PipelineActivity`

并分别提供：

- `CandidatesFile`
- `PipelineEntriesFile`
- `PipelineStagesFile`
- `PipelineActivitiesFile`

## 9. MVP API 设计

建议第一版接口只做最小闭环。

### 7.1 候选人

- `GET /pipeline/candidates/{candidate_id}`
- `POST /pipeline/candidates/upsert`

### 7.2 职位下的 pipeline 列表

- `GET /jobs/{job_id}/pipeline`
  - 返回该职位下所有 `PipelineEntry`
  - 同时带上对应候选人简要信息

### 7.3 从简历卡片加入 pipeline

- `POST /jobs/{job_id}/pipeline`

建议请求体：

- `candidate`
- `initial_stage_id`
- `source_type`
- `recruiter_interest`
- `candidate_interest`
- `summary`
- `source_chat_id`
- `source_session_id`

逻辑：

- 先 upsert `CandidateProfile`
- 再创建或返回现有 `PipelineEntry`
- 默认初始阶段建议是 `待沟通`

### 7.4 更新阶段

- `PATCH /pipeline/entries/{entry_id}/stage`

建议请求体：

- `to_stage_id`
- `note`

同时写入 `PipelineActivity`

### 7.5 更新关系状态

- `PATCH /pipeline/entries/{entry_id}`

允许更新：

- `recruiter_interest`
- `candidate_interest`
- `summary`
- `owner_user_id`
- `status`

### 7.6 候选人跟进记录

- `GET /pipeline/candidates/{candidate_id}/activities`
  - 支持可选参数：`job_id`
  - 默认按 `created_at DESC` 返回
  - 用于候选人详情页展示完整时间线

- `POST /pipeline/candidates/{candidate_id}/activities`
  - 第一版可以先不开放给用户手动写
  - 先由系统在关键动作时自动写入

建议第一版自动写入这些事件：

- `added_to_job`
- `stage_changed`
- `assessment_changed`
- `candidate_interest_changed`

后续再增加：

- `note_added`
- `interview_scheduled`
- `offer_progressed`

## 10. 前端设计建议

### 8.1 右侧 Job Detail Panel

当前已经有 `Pipeline` tab 占位，第一版直接替换为真正看板即可。

建议结构：

- 顶部：阶段列统计
- 中间：多列看板
- 卡片：候选人简卡

候选人简卡建议先显示：

- 姓名
- 当前职位 / 公司
- 城市
- 期望薪资
- 推荐理由一句话
- 来源标签
- 双边意向标签
- 最近更新时间

### 8.2 简历卡片入口

在简历卡片上增加：

- `加入 Pipeline`

点击后：

- 如果当前 chat 未绑定职位，先提示“请先绑定职位”
- 如果已绑定职位，默认加入当前职位的 pipeline

### 8.3 第一版交互建议

第一版支持：

- 点击加入
- 右侧看板查看
- 切换阶段
- 编辑来源/意向

第一版不急着做：

- 拖拽排序
- 跨列拖放动画
- 复杂筛选
- 多职位共享候选人视图

### 8.4 候选人详情与跟进记录

建议点击候选人卡片后，打开“候选人详情抽屉”。

抽屉结构建议：

- 顶部：候选人基础信息
- 中部：当前职位下的 Pipeline 关键信息
- 下部：跟进记录时间线

时间线顶部提供筛选切换：

- `当前职位`
- `全部职位`

默认行为：

- 如果用户是从某个职位的 Pipeline 卡片点开的，默认筛选 `当前职位`
- 用户可以主动切换到 `全部职位`，查看该候选人在其他职位里的历史

每条时间线建议展示：

- 时间
- 操作来源：`Agent / 人工 / 系统`
- 事件文案
- 所属职位标签（如果有）
- 备注信息（如果有）

示例文案：

- `今天 14:32 Agent 将候选人加入 AI 产品经理 Pipeline`
- `今天 14:35 人工将节点从 线索 调整为 推进中`
- `今天 15:10 人工将匹配度改为 很合适`

## 11. 第一版业务闭环

建议先跑通这条链路：

1. Agent 推荐简历
2. 用户点击“加入 Pipeline”
3. 系统自动创建 `CandidateProfile`
4. 系统自动创建该职位下的 `PipelineEntry`
5. 右侧 `Pipeline` tab 立即可见
6. 用户手动切换阶段
7. 系统记录 `PipelineActivity`
8. 点击候选人时，可查看该候选人的跟进时间线（默认按当前职位过滤）

只要这条链路跑通，pipeline 就已经有很强的产品意义了。

## 12. 后续扩展方向

在 MVP 稳定之后，可以再考虑：

- 面试轮次对象
- 面试反馈结构化记录
- Offer 审批与状态
- 候选人主档去重合并
- 跨职位人才库视图
- 超时未跟进提醒
- Agent 自动建议推进下一步

## 13. 当前建议结论

当前版本最合理的定义是：

- `CandidateProfile` = 人才主档
- `PipelineEntry` = 人才与职位之间的推进关系
- `PipelineStageDefinition` = 用户可调整的展示节点
- `PipelineActivity` = 候选人维度的跟进记录

并且：

- `stage` 只表达流程位置：`lead / active / interview / offer / closed`
- `source_type` 表达候选人从哪来
- `recruiter_interest` 与 `candidate_interest` 表达双边判断
- `outcome` 表达最终结果
- 底层保留固定系统阶段，展示层允许适度灵活

这是第一版最稳，也最容易做出产品价值的方案。

## 14. 跟进记录的设计结论

关于“跟进记录”，这一版建议明确按下面的原则设计：

- 不要把跟进记录锁死在单个职位下
- 跟进记录主归属应是 `candidate_id`
- `job_id` 是上下文与过滤维度，不是唯一归属维度

也就是说：

- 入口可以发生在某个职位下
- 展示时可以默认只看当前职位
- 但底层必须允许串起该候选人在多个职位里的完整历史

这样才能支持真实招聘场景：

1. 候选人先被加入职位 A
2. 后来在职位 A 中止推进
3. 之后又被加入职位 B
4. 在职位 B 中继续推进到面试或 Offer

如果跟进记录只挂在职位下，这段历史会被切碎；如果挂在候选人下，再按职位过滤展示，就能同时满足：

- 职位视角下的局部跟进
- 候选人视角下的全局历史

因此，这部分我建议正式定为：

- 跟进记录主归属：`candidate_id`
- 关联字段：`job_id`、`pipeline_entry_id`
- 默认入口：从职位 Pipeline 卡片进入
- 默认筛选：当前职位
- 可切换视图：全部职位

## 15. 候选人详情与职位详情的交互关系

随着候选人详情抽屉加入，系统里会同时存在两类详情内容：

- 职位详情
- 候选人详情

如果继续沿用“每种详情各自一个抽屉”的思路，会很容易出现：

- 职位抽屉上再叠一层候选人抽屉
- 候选人抽屉里再叠一层职位抽屉
- 右侧层级混乱、关闭逻辑不清楚、拖拽宽度异常

因此，这一版建议明确采用：

- **右侧始终只有一个详情侧栏容器**
- 不允许“抽屉套抽屉”或多个详情抽屉并排

### 15.1 推荐方案：统一 Detail Panel Shell

建议将右侧详情区域抽象成一个统一容器，例如：

- `DetailPanelShell`

该容器只负责：

- 统一宽度与拖拽逻辑
- 顶部返回 / 关闭 / 标题区域
- 内容区切换不同详情视图

内部视图类型建议先支持：

- `job`
- `candidate`

也就是说：

- 从聊天区点职位名 -> 打开 `job` 详情视图
- 从职位 Pipeline 卡片点候选人 -> 切到 `candidate` 详情视图
- 从候选人详情再点职位 -> 切回 `job` 详情视图

但整个右侧始终只是一块面板。

### 15.2 推荐导航模型：单面板 + 小历史栈

建议右侧详情区内部维护一个轻量级 navigation stack。

例如：

1. 用户先打开职位详情 A
2. 在职位 A 中点击候选人 X
3. 右侧切换成候选人 X 详情，并把“职位 A”压入栈
4. 用户点击顶部返回
5. 回到职位 A 详情

同理：

1. 用户在候选人 X 详情里点击职位 B
2. 右侧切到职位 B 详情
3. 返回时可回到候选人 X

这样用户会获得“在详情区内部浏览上下文”的感觉，而不是打开一层又一层浮层。

### 15.3 关闭与返回的行为定义

建议明确区分：

- `关闭`
- `返回`

含义：

- `关闭`：直接关闭整个右侧详情区
- `返回`：回到上一个详情页面

因此：

- 有历史栈时，顶部显示 `返回`
- 无历史栈时，不显示返回，只显示关闭

这样用户心智会非常稳定：

- 我只是想退出详情区 -> 点关闭
- 我只是想回到刚刚那个职位 / 候选人 -> 点返回

### 15.4 默认打开规则

建议第一版采用以下规则：

- 从聊天页点职位 -> 打开 `job detail`
- 从职位 Pipeline 卡片点候选人 -> 切到 `candidate detail`
- 从候选人详情点职位 -> 切到 `job detail`
- 从跟进记录里的职位标签点职位 -> 切到对应 `job detail`

同时：

- 进入候选人详情时，自动记录“来源职位”
- 进入职位详情时，自动记录“来源候选人”或“来源聊天”

### 15.5 候选人详情页的默认上下文

因为候选人跟进记录是候选人维度的全局时间线，但职位内打开时应该保留职位上下文，所以建议：

- 候选人详情页内部保存 `context_job_id`
- 如果是从职位 A 打开候选人 X，则默认 `context_job_id = A`
- 时间线默认筛选当前职位 A
- 用户可手动切换为“全部职位”

这样既不丢候选人全局视角，也不打断当前职位下的工作流。

### 15.6 为什么不建议多抽屉叠加

不建议做：

- 职位抽屉上叠候选人抽屉
- 候选人抽屉上再叠职位抽屉
- 两个详情抽屉左右并排

原因：

- 关闭逻辑会很混乱
- 宽度拖拽会互相影响
- 聊天区已经占一块，右侧再叠层会非常拥挤
- 移动端和窄屏下几乎不可控

### 15.7 当前建议结论

这一版详情区的推荐交互是：

- **一个右侧详情容器**
- **内部切换职位详情 / 候选人详情**
- **使用轻量历史栈实现返回**
- **禁止抽屉套抽屉**

这是最稳、最容易维护，也最符合当前产品形态的方案。
