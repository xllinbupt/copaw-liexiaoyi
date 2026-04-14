---
name: resume_search
description: "一个面向招聘搜索的简历检索 skill。先把需求整理成职位、公司、简历关键词和固定筛选条件，再桥接成 bool 查询，调用 `/liexiaoxia/search_resume_by_token` 搜索，必要时调用 `/liexiaoxia/get_resume_detail_by_token` 拉详情。当前版本只支持正向包含搜索。进入正式推荐阶段时，必须输出结构化 `resume_card`。"
metadata:
  {
    "builtin_skill_version": "2.2",
    "copaw":
      {
        "emoji": "🎯",
        "requires": {}
      }
  }
---

# 简历搜索 Skill

## 这份 skill 是干什么的

这份 skill 只做一件事：帮你搜索候选人简历。

它的标准流程是：

1. 把招聘需求整理成简单搜索计划
2. 把搜索计划翻译成 `bool_obj`
3. 先确认 token，再调 `/liexiaoxia/search_resume_by_token`
4. 必要时调 `/liexiaoxia/get_resume_detail_by_token`
5. 输出搜索摘要或 `resume_card`

不要把它想成通用策略 skill。它更像一个“按模板组装搜索请求”的 skill。

## 给 agent 的最重要规则

- 不要发明新的搜索维度。
- 搜索时只使用这 3 个关键词维度：
  - `jobTitles`
  - `companies`
  - `resumeKeywords`
- 固定筛选条件单独放进 `fixedFilters`，不要混进关键词里。
- 当前版本只支持正向包含搜索。
- 搜索和详情都只走 `http://open-techarea-sandbox20620.sandbox.tongdao.cn` 这个 API 域名。
- 猎小侠相关接口统一要求 `Authorization: Bearer <token>`。
- token 只认两种来源：显式 `--token`，或环境变量 `LIEXIAOXIA_TOKEN`。
- 如果没有 `LIEXIAOXIA_TOKEN`，要明确提醒用户去 `https://vacs.tongdao.cn/visa/persionaccesstoken/list` 获取；不要假装还能继续搜。
- 如果接口暂时不可用、报鉴权异常、超时或网络错误，先检查当前 agent 所在网络环境是否能访问猎聘内网，再检查 token、请求体和分页参数。
- 企业版搜简历一律走 API，不要改用浏览器页面、不用浏览器模拟搜索，也不要让用户等你“打开网页试一下”。
- 进入正式推荐阶段时，必须输出结构化 `resume_card`。
- 正式推荐时保留 `resIdEncode`，并带上 `source_platform: "liexiaoxia"`。
- 如果没有真实可打开的详情链接，不要伪造 `resume_detail_url`。

## 搜索维度只看这两组

### 关键词维度

只允许这 3 个：

- `jobTitles`：职位名称
- `companies`：目标公司或公司背景
- `resumeKeywords`：简历关键词

### 可选高级写法：关键词篮子

如果你发现“把所有词都放进一个大数组”会让结果太松，就改用“关键词篮子”。

规则很简单：

- 一个篮子 = 一个必须命中的概念
- 同一个篮子里的多个词 = 互相替代，按 `OR`
- 不同篮子之间 = 都要满足，按 `AND`

你可以把它理解成：

- `(A OR B)`：表示同一个意思的不同写法
- `(C OR D OR E)`：表示另一组可替代词
- 最终搜索：`(A OR B) AND (C OR D OR E)`

什么时候适合用关键词篮子：

- 用户有 2 到 3 个明确 must-have 概念
- 你担心把所有词都塞进 `resumeKeywords` 会导致结果跑偏
- 你想把“职位词”“能力词”“场景词”拆开来搜

什么时候先不要用：

- 只是快速预览
- 只知道一个主概念
- 你还不确定哪些条件真的是 must-have

### 固定筛选条件

- `current_city`
- `expected_city`
- `experience_min`
- `experience_max`
- `education`
- `full_time_enroll`
- `age_min`
- `age_max`
- `gender`
- `languages`

## 什么叫 `resumeKeywords`

`resumeKeywords` 指的是“你希望在候选人简历里看到的关键词”。

它不是职位名，也不是抽象能力词。

好的例子：

- `Python`
- `SQL`
- `Django`
- `招投标`
- `大客户销售`
- `用户增长`
- `直播运营`
- `跨境电商`

不好的例子：

- `行业理解强`
- `沟通能力强`
- `有战略思维`
- `业务 sense`

原则：

- 先用简历里真的会出现的词
- 一轮先放 2 到 5 个
- 多了容易跑偏

## 使用流程

### Step 1：先整理搜索计划

先把用户需求整理成下面这个 JSON，别跳步：

```json
{
  "ok": true,
  "keywordPlan": {
    "jobTitles": [],
    "companies": [],
    "resumeKeywords": []
  },
  "fixedFilters": {
    "current_city": [],
    "expected_city": [],
    "experience_min": null,
    "experience_max": null,
    "education": [],
    "full_time_enroll": null,
    "age_min": null,
    "age_max": null,
    "gender": "不限",
    "languages": ""
  },
  "notes": [],
  "openQuestions": []
}
```

如果你需要更精准的搜索，可以在 `plan` 里额外写 `mustGroups`：

```json
{
  "mustGroups": [
    {
      "field": "jobTitles",
      "values": ["产品经理", "产品负责人"]
    },
    {
      "field": "resumeKeywords",
      "values": ["用户增长", "增长策略", "商业化"]
    },
    {
      "field": "resumeKeywords",
      "values": ["App", "移动端"]
    }
  ]
}
```

上面这组的含义就是：

`(产品经理 OR 产品负责人) AND (用户增长 OR 增长策略 OR 商业化) AND (App OR 移动端)`

详细规则见：`references/01_keyword_decomposition.md`

### Step 2：桥接成 `bool_obj`

把上面的 `plan` 翻译成 `bool_obj`，再生成：

```json
{
  "boolSearchJsonStr": "<JSON.stringify(bool_obj)>"
}
```

详细规则见：`references/02_bridge_plan_to_bool_query.md`

### Step 3：调用搜索接口

- 必须优先运行脚本，不要再现场手写 `urllib` / `requests` 调用

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/resume_search/scripts/search_resume.py \
  --job-titles '["产品经理","AI产品经理"]' \
  --resume-keywords '["AI","Agent","大模型"]' \
  --expected-city '["北京"]' \
  --page 1 \
  --page-size 20
```

- 脚本会统一处理 token：优先 `--token`，其次 `LIEXIAOXIA_TOKEN`
- 如果两者都没有，直接按 `token_error` 处理，并提醒用户去 `https://vacs.tongdao.cn/visa/persionaccesstoken/list` 获取 token 后放进 `LIEXIAOXIA_TOKEN`
- 如果需要表达 `(A OR B) AND (C OR D)` 这类 must-have 结构，使用 `--must-groups '<JSON数组>'`
- 脚本成功时返回结构化 JSON：`success / count / request_payload / results`
- 搜索底层接口仍是 `POST /liexiaoxia/search_resume_by_token`
- 请求体是第 2 步生成的 `boolSearchJsonStr`
- Header 是 `Content-Type: application/json` + `Authorization: Bearer <token>`
- `results` 若为空数组，表示接口调用成功但当前查询没有命中
- 如果脚本返回 `token_error / http_error / invalid_response`，按错误原文处理，不要伪造成功
- `token_error` 时，不要退回浏览器搜索链路；要明确告诉用户当前缺少 `LIEXIAOXIA_TOKEN`

详细规则见：`references/03_search_api_call_and_parse.md`

### Step 4：需要时拉详情

当你要正式推荐、补卡片、回答候选人细节、或加入 Pipeline 时，再拉详情：

- 接口：`POST /liexiaoxia/get_resume_detail_by_token`
- 入参：`{ "resIdEncode": "..." }`

详细规则见：`references/04_get_resume_detail.md`

## 默认搜索策略

- 快速预览：用户明确说“先看一眼”，可以只搜 1 页
- 默认搜索：至少先看 1 到 3 页，不要只看 20 条就停止
- 如果结果里真正合适的人太少，就继续翻页
- 如果翻页后还是不够，再改写搜索计划重新搜
- 如果结果很多但不准，优先改成“关键词篮子”搜索，而不是继续堆更多词

## 怎么组合搜索条件，兼顾准确度和召回

一个简单原则：

- `jobTitles` 决定你在找什么岗位
- `resumeKeywords` 决定你希望命中什么能力或经历
- `companies` 决定你是否要求某类背景
- `fixedFilters` 决定城市、年限、学历这些硬条件

组合时不要一上来就把所有条件都加满。更稳的顺序是：

1. 先定岗位
2. 再加 1 到 2 组 must-have 关键词
3. 结果太多时再补公司背景或更具体的关键词
4. 结果太少时先减少关键词，再放宽公司背景

### 示例 1：找做增长的产品经理

目标：既要产品岗位，又要增长方向，还要 App 场景。

推荐 plan：

```json
{
  "keywordPlan": {
    "jobTitles": ["产品经理", "产品负责人"],
    "companies": [],
    "resumeKeywords": ["用户增长", "增长策略", "商业化", "App"]
  },
  "mustGroups": [
    {
      "field": "jobTitles",
      "values": ["产品经理", "产品负责人"]
    },
    {
      "field": "resumeKeywords",
      "values": ["用户增长", "增长策略", "商业化"]
    },
    {
      "field": "resumeKeywords",
      "values": ["App", "移动端"]
    }
  ]
}
```

为什么这样组合：

- 第一组锁住岗位
- 第二组锁住增长能力
- 第三组锁住场景
- 不先加公司背景，先保证有足够召回

### 示例 2：找 ToB 大客户销售

目标：优先找到做大客户、企业客户、解决方案式销售的人。

推荐 plan：

```json
{
  "keywordPlan": {
    "jobTitles": ["销售经理", "客户经理", "销售总监"],
    "companies": [],
    "resumeKeywords": ["大客户销售", "KA", "企业客户", "解决方案销售"]
  },
  "mustGroups": [
    {
      "field": "jobTitles",
      "values": ["销售经理", "客户经理", "销售总监"]
    },
    {
      "field": "resumeKeywords",
      "values": ["大客户销售", "KA", "企业客户"]
    }
  ]
}
```

调节方法：

- 结果太散：再加一组 `["招投标", "项目制销售"]`
- 结果太少：先去掉公司背景，不要急着删岗位词

### 示例 3：找 Python 后端

目标：既要 Python，又希望偏后端，不想只搜到数据分析或测试。

推荐 plan：

```json
{
  "keywordPlan": {
    "jobTitles": ["Python开发工程师", "后端开发工程师"],
    "companies": [],
    "resumeKeywords": ["Python", "Django", "Flask", "后端"]
  },
  "mustGroups": [
    {
      "field": "jobTitles",
      "values": ["Python开发工程师", "后端开发工程师"]
    },
    {
      "field": "resumeKeywords",
      "values": ["Python"]
    },
    {
      "field": "resumeKeywords",
      "values": ["Django", "Flask", "后端"]
    }
  ]
}
```

为什么不直接把所有词放一组：

- 如果全放一组，会变成大 OR，容易把只写了 `Python` 的非后端人选也放进来
- 拆成两组后，更容易同时命中“语言”和“后端方向”

### 示例 4：找跨境电商运营

目标：既要运营岗位，也要跨境电商经验。

推荐 plan：

```json
{
  "keywordPlan": {
    "jobTitles": ["电商运营", "运营经理"],
    "companies": [],
    "resumeKeywords": ["跨境电商", "亚马逊", "独立站", "Shopify"]
  },
  "mustGroups": [
    {
      "field": "jobTitles",
      "values": ["电商运营", "运营经理"]
    },
    {
      "field": "resumeKeywords",
      "values": ["跨境电商", "亚马逊", "独立站", "Shopify"]
    }
  ]
}
```

调节方法：

- 想扩大召回：岗位词增加 `平台招商运营`
- 想提高准确度：增加城市、年限，或者把平台词拆成单独一组

## 调参顺序

想兼顾准确度和召回时，优先按这个顺序调：

1. 先改 `mustGroups`
2. 再改 `resumeKeywords`
3. 再改 `companies`
4. 最后再放宽 `fixedFilters`

不要一上来同时改 4 个地方，不然很难知道到底是哪一步把结果带偏了。

## 搜索结果怎么输出

还在试探或校准阶段时，优先输出：

```markdown
### 搜索摘要
- 岗位：
- 地点：
- 必须条件：

### 本次搜索计划
- 职位：
- 公司：
- 简历关键词：

### 搜索结果概览
- 命中数量：X
- 结论：可用 / 偏多 / 偏少 / 跑偏

### 候选人列表（最多 5 条）
1. 姓名/年龄/年限/学历/城市 - 最近公司&职位 - 一句匹配点评
2. ...

### 下一步建议
- 若偏少：放宽哪些词
- 若偏多：收紧哪些词
- 若跑偏：删掉哪些词，补哪些词
```

## 正式推荐怎么输出

正式推荐阶段必须输出 `resume_card`。

### `liexiaoxia` -> `resume_card` 映射

- `candidate_id` / `resIdEncode`：使用搜索结果里的 `resIdEncode`
- `source_platform`：固定写 `liexiaoxia`
- `resume_detail_url` / `detail_url`：优先使用详情里的 `urlPc`；如果没有真实链接，就留空
- `candidate_name`：候选人姓名
- `gender`：`sexName`
- `age`：`age`
- `current_title`：`title` 或 `jobtitleName`
- `current_company`：`companyName`
- `city`：`dqName`
- `education`：`eduLevelName`
- `current_salary`：`salary + salaryMonths`
- `expected_salary`：`expectList[0]`
- `education_experiences`：由 `eduExperienceList` 转换
- `work_experiences`：由 `workExperienceList` 转换
- `match_reason`：你自己的匹配判断
- `summary`：可用 `selfAssessment` 或 `additional` 兜底

示例：

```json
{
  "type": "resume_card",
  "source_platform": "liexiaoxia",
  "candidate_id": "6f0d7c7d9f8c4a1e9b2c3d4e5f607182",
  "resIdEncode": "6f0d7c7d9f8c4a1e9b2c3d4e5f607182",
  "resume_detail_url": "https://lpt.liepin.com/resume/detail?resIdEncode=6f0d7c7d9f8c4a1e9b2c3d4e5f607182",
  "candidate_name": "张三",
  "gender": "男",
  "age": 29,
  "current_title": "高级产品经理",
  "current_company": "某 AI 应用公司",
  "city": "北京",
  "education": "硕士",
  "match_reason": "关键词匹配度高，最近经历也贴近岗位要求。"
}
```

## 常见错误

- 只写关键词，不写 `jobTitles`
- 把抽象词当成 `resumeKeywords`
- 把固定条件混进 `resumeKeywords`
- 把多个 must-have 概念全部扔进同一个大 `resumeKeywords` 数组
- `boolSearchJsonStr` 不是合法 JSON 字符串
- `queryChainConditionList` 少了 `queryChain`
- PHRASE 写成 `query` 而不是 `value`
- 把 `resIdEncode` 当成明文 `resId`

## 一句话工作法

如果你是一个不太聪明的 agent，就照下面做：

1. 先写 `plan`
2. 再按模板写 `bool_obj`
3. 再调搜索接口
4. 看结果够不够
5. 不够就翻页
6. 结果太松就拆成“关键词篮子”
7. 还是不够就改 `resumeKeywords`
