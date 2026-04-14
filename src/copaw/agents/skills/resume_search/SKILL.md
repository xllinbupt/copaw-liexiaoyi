---
name: resume_search
description: "一个面向招聘搜索的简历检索 skill。根据招聘要求提取结构化筛选属性，组装 `boolSearchJsonStr` 字符串，调用 `/liexiaoxia/search_resume_by_token` 搜索简历，并在需要时调用 `/liexiaoxia/get_resume_detail_by_token` 拉取详情。"
metadata:
  {
    "builtin_skill_version": "2.3",
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
2. 把属性数组压缩成 `boolSearchJsonStr`
3. 调 `/liexiaoxia/search_resume_by_token`
4. 需要补信息时再调 `/liexiaoxia/get_resume_detail_by_token`

## 最重要的规则

- 不要发明新的筛选维度，只能使用白名单属性
- 当前协议不再使用旧版 `bool_obj`，而是直接传属性数组字符串
- 多选属性统一使用 `boolSearchValue`
- 搜索和详情都固定走 `http://open-techarea-sandbox20620.sandbox.tongdao.cn`
- token 只认两种来源：显式 `--token`，或环境变量 `LIEXIAOXIA_TOKEN`
- 如果没有 `LIEXIAOXIA_TOKEN`，要明确提醒用户去 `https://vacs.tongdao.cn/visa/persionaccesstoken/list` 获取
- 企业版搜简历一律走 API，不要退回浏览器页面
- 进入正式推荐阶段时，必须输出结构化 `resume_card`
- 正式推荐时保留 `resIdEncode`，并带上 `source_platform: "liexiaoxia"`
- 如果没有真实可打开的详情链接，不要伪造 `resume_detail_url`

## 允许使用的属性

- 单选：`sex`、`resLanguage`、`marriage`、`ageLow`、`ageHigh`、`workYearLow`、`workYearHigh`、`yearSalary`、`wantYearSalLow`、`wantYearSalHigh`、`abroadExp`、`abroadEdu`、`abroad`、`manageExp`
- 多选：`dqs`、`wantDqs`、`houseHolds`、`graduationYear`、`languageContents`、`schools`、`specials`、`eduLevel`、`schoolDqs`、`eduLevelTzs`、`compsNormalized`、`titlesWithPayload`、`contextBm25`、`resTagList`

详细字段说明见：`references/01_keyword_decomposition.md`

## 使用流程

### Step 1：提取属性

把招聘要求提炼成属性数组。格式示例：

```json
[
  {
    "propertyName": "sex",
    "value": "女"
  },
  {
    "propertyName": "wantDqs",
    "value": "北京,上海",
    "boolSearchValue": "OR"
  },
  {
    "propertyName": "titlesWithPayload",
    "value": "后端开发工程师,AI产品经理",
    "boolSearchValue": "OR"
  },
  {
    "propertyName": "contextBm25",
    "value": "(Java or Python or Go) and (高并发 or 分布式 or 微服务)"
  }
]
```

提取规则见：`references/01_keyword_decomposition.md`

### Step 2：桥接成请求体

把上面的数组压缩成字符串：

```json
{
  "boolSearchJsonStr": "[{\"propertyName\":\"sex\",\"value\":\"女\"}]"
}
```

桥接规则见：`references/02_bridge_plan_to_bool_query.md`

### Step 3：调用搜索接口

必须优先运行脚本，不要现场手写 `urllib` / `requests` 调用。

推荐写法：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/resume_search/scripts/search_resume.py \
  --criteria-json '[{"propertyName":"wantDqs","value":"北京","boolSearchValue":"OR"},{"propertyName":"titlesWithPayload","value":"AI产品经理,产品经理","boolSearchValue":"OR"},{"propertyName":"contextBm25","value":"(Agent or AI) and (增长 or 商业化)"}]'
```

如果你只是想先检查请求体是否合法，可先加：

```bash
--print-payload-only
```

兼容旧参数，但新任务优先使用 `--criteria-json`。复杂逻辑请直接传：

- `--criteria-json`
- 或 `--bool-search-json-str`

搜索接口与返回解析见：`references/03_search_api_call_and_parse.md`

### Step 4：需要时拉详情

当你要正式推荐、回答候选人细节、补齐卡片、或写入下游系统时，再调详情：

- 接口：`POST /liexiaoxia/get_resume_detail_by_token`
- 入参：`{ "resIdEncode": "..." }`

详情规则见：`references/04_get_resume_detail.md`

## 默认搜索策略

- 快速预览：先看搜索摘要，不急着拉详情
- 默认招聘检索：先确认硬条件，再搜索
- 结果太少：先放宽 `contextBm25`，再放宽职位或公司条件
- 结果太多：先收紧 `contextBm25` 或职位条件，不要盲目叠加软条件
- 结果跑偏：优先检查 `contextBm25` 是否混入了抽象词、泛词或职务词

## `contextBm25` 的使用建议

`contextBm25` 是最容易把结果拉偏的字段，必须谨慎使用：

- 写简历里会真实出现的词
- 优先写技能、项目、业务场景、工作产出
- 不要写软性能力、语言要求、通用办公技能
- 不要把职位名塞进 `contextBm25`
- 需要区分多个 must-have 概念时，优先写成分组表达式，例如：
  - `(Python or SQL) and (资产配置 or 反欺诈)`
  - `(React or Vue) and (中台系统 or 可视化)`

## 正式推荐输出要求

进入正式推荐阶段时：

- 输出结构化 `resume_card`
- 保留 `resIdEncode`
- 补上 `source_platform: "liexiaoxia"`
- 只有拿到真实详情链接时，才填 `resume_detail_url`

## 常见错误

- 使用了白名单之外的属性
- 多选属性忘了写 `boolSearchValue`
- 把未提及的条件强行补进筛选
- 把职位名称、软性能力塞进 `contextBm25`
- 没有 token 还继续调用接口
- 搜索失败后退回浏览器页面
