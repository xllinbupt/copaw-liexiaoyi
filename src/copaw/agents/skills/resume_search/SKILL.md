---
name: resume_search
description: "一个面向招聘搜索的简历检索 skill。根据招聘要求提取结构化筛选属性，组装对象型 `boolSearchJsonStr` 字符串，调用猎小侠搜索简历 API，并基于返回的简历摘要与结构化字段完成样本判断和正式推荐。"
metadata:
  {
    "builtin_skill_version": "3.0",
    "copaw":
      {
        "emoji": "🎯",
        "requires": {}
      }
  }
---

# 简历搜索 Skill

## 这份 skill 做什么

它负责把招聘需求变成可执行的搜人请求，并把接口返回的候选人摘要整理出来。

标准流程：

1. 从招聘要求中提取结构化属性
2. 把属性对象压缩成 `boolSearchJsonStr`
3. 调猎小侠搜索接口并解析列表结果

## 最重要的规则

- 不要发明新的筛选维度，只能使用白名单属性
- 当前协议的 `boolSearchJsonStr` 内层必须是 JSON 对象，不再是旧版属性数组
- 请求体固定为 `{ "boolSearchJsonStr": "<第二步生成的字符串>" }`
- 搜索请求固定走 `http://open-agent-sandbox20711.sandbox.tongdao.cn/liexiaoxia/resume/search_resume`
- token 只认两种来源：显式 `--token`，或环境变量 `LIEXIAOXIA_TOKEN`
- 如果没有 `LIEXIAOXIA_TOKEN`，要明确提醒用户去 `https://vacs.tongdao.cn/visa/persionaccesstoken/list` 获取
- 企业版搜简历一律走 API，不要退回浏览器页面
- 进入正式推荐阶段时，必须输出结构化 `resume_card`
- 正式推荐时保留 `resIdEncode`，并带上 `source_platform: "liexiaoxia"`
- 如果没有真实可打开的详情链接，不要伪造 `resume_detail_url`
- 搜索结果转 `resume_card` 时，优先保留搜索接口的原始字段名，不要自己发明近似字段

## 允许使用的属性

- 单选：`sex`、`resLanguage`、`marriage`、`ageLow`、`ageHigh`、`workYearLow`、`workYearHigh`、`yearSalLow`、`yearSalHigh`、`wantYearSalLow`、`wantYearSalHigh`、`abroadExp`、`abroadEdu`、`manageExp`、`curPage`、`pageSize`、`filterChat`、`filterDownload`、`filterRead`
- 多选 / 多值字符串：`dqs`、`wantDqs`、`houseHolds`、`graduationYear`、`languageContents`、`schools`、`specials`、`eduLevel`、`schoolDqs`、`eduLevelTzs`、`company`、`jobTitle`、`resTagList`
- 关键词表达式：`keyword`

详细字段说明见：`references/01_keyword_decomposition.md`

## 使用流程

### Step 1：提取属性

把招聘要求提炼成一个对象。格式示例：

```json
{
  "sex": "女",
  "wantDqs": "北京,上海",
  "jobTitle": "后端开发工程师 AI产品经理",
  "keyword": "(Java or Python) and (高并发 or 分布式)",
  "curPage": 1,
  "pageSize": 20
}
```

提取规则见：`references/01_keyword_decomposition.md`

### Step 2：桥接成请求体

把上面的对象压缩成字符串后，放进请求体：

```json
{
  "boolSearchJsonStr": "{\"sex\":\"女\",\"wantDqs\":\"北京,上海\",\"jobTitle\":\"后端开发工程师 AI产品经理\",\"keyword\":\"(Java or Python) and (高并发 or 分布式)\",\"curPage\":1,\"pageSize\":20}"
}
```

桥接规则见：`references/02_bridge_plan_to_bool_query.md`

### Step 3：调用搜索接口并解析返回

必须优先运行脚本，不要现场手写 `urllib` / `requests` 调用。

推荐写法：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/resume_search/scripts/search_resume.py \
  --criteria-json '{"wantDqs":"北京","jobTitle":"AI产品经理 产品经理","keyword":"(Agent or AI) and (增长 or 商业化)","curPage":1,"pageSize":20}'
```

如果你只是想先检查请求体是否合法，可先加：

```bash
--print-payload-only
```

兼容旧参数，但新任务优先使用：

- `--criteria-json`
- 或 `--bool-search-json-str`

搜索接口与返回解析见：`references/03_search_api_call_and_parse.md`

## 默认搜索策略

- 快速预览：先看搜索摘要，先判断召回方向对不对
- 搜索结果里如果有 `brief`，优先结合 `brief`、最近工作经历和最高学历做首轮判断
- 默认招聘检索：先确认硬条件，再搜索
- 结果太少：先放宽 `keyword`，再放宽职位或公司条件
- 结果太多：先收紧 `keyword` 或职位条件，不要盲目叠加软条件
- 结果跑偏：优先检查 `keyword` 是否混入了抽象词、泛词或职务词

## 正式推荐前的排序规则

- 不要只因为候选人“历史上做过相关岗位”就放进 Top 推荐
- 正式推荐时，优先检查 `brief`、`expectJobtitleName`、`recentWorkList[0]` 是否同时支持你的判断
- 当前岗位、最近一段经历、期望岗位都明显偏离 JD 的候选人，默认降权，不要放进 Top 3
- 只有一段较早经历匹配、但当前岗位和期望岗位都不匹配时，最多标为“边缘候选人 / 可补充沟通”，不要当核心推荐
- 如果推荐理由主要来自招聘平台背景、行业背景或单一历史经历，必须把这个局限写进 `match_reason`

## `keyword` 的使用建议

`keyword` 是最容易把结果拉偏的字段，必须谨慎使用：

- 写简历里会真实出现的词
- 优先写技能、项目、业务场景、工作产出
- 不要写软性能力、语言要求、通用办公技能
- 不要把职位名塞进 `keyword`
- 需要区分多个 must-have 概念时，优先写成分组表达式，例如：
  - `(Python or SQL) and (资产配置 or 反欺诈)`
  - `(React or Vue) and (中台系统 or 可视化)`

## 正式推荐输出要求

进入正式推荐阶段时：

- 输出结构化 `resume_card`
- 保留 `resIdEncode`
- 优先利用返回的 `brief` 组织候选人摘要；如果 `brief` 为空，再回退到 `recentWorkList` / `highestEdu`
- 补上 `source_platform: "liexiaoxia"`
- 只有拿到真实详情链接时，才填 `resume_detail_url`

### `resume_card` 输出协议

优先保留搜索接口原始字段，并只补充少量推荐字段。推荐最小结构如下：

```json
{
  "type": "resume_card",
  "resIdEncode": "fddbe7659cNd2001f6e4719",
  "source_platform": "liexiaoxia",
  "resName": "何月彤",
  "age": 31,
  "workYears": 4,
  "dqName": "北京",
  "expectDqName": "北京",
  "expectJobtitleName": "大客户销售",
  "expectSalaryShowName": "10k-15k·13薪",
  "brief": "拥有4年B端大客户销售经验，现任京东方科技集团大客户销售经理……",
  "recentWorkList": [
    {
      "companyName": "京东方科技集团股份有限公司",
      "titleName": "大客户销售经理",
      "startTime": "2021.05",
      "endTime": "至今"
    }
  ],
  "highestEdu": {
    "schoolName": "梅西大学",
    "majorName": "市场营销",
    "eduLevelName": "硕士",
    "unifiedEnrollmentName": "统招",
    "enrollTime": "2017.09",
    "graduateTime": "2019.06"
  },
  "match_reason": "4年B端大客户销售经验，最近经历与目标岗位一致，且当前地点与期望地点都在北京。"
}
```

补充规则：

- 推荐卡片优先保留这些原始字段：`resIdEncode`、`resName`、`age`、`workYears`、`dqName`、`expectDqName`、`expectJobtitleName`、`expectSalaryShowName`、`brief`、`recentWorkList`、`highestEdu`
- 只额外补充：`type`、`source_platform`、`match_reason`、`resume_detail_url`
- 不要把原始字段改写成自造名字，例如 `recentWork`、`matchReason`、`currentCity`、`expectCity`、`expectJobtitle`、`expectSalary`
- 不要手工拼不存在的教育经历或工作经历；列表里没有就留空
- `match_reason` 必须解释“为什么匹配”，不要只重复 `brief`

## 常见错误

- 使用了白名单之外的属性
- 误把 `boolSearchJsonStr` 内层写成数组
- 把未提及的条件强行补进筛选
- 把职位名称、软性能力塞进 `keyword`
- 没有 token 还继续调用接口
- 把接口返回的字符串直接当成已解析列表使用
- 搜索失败后退回浏览器页面
