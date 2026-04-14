## 02 桥接（照模板填空）

目标：把 `plan` 翻译成 `bool_obj`，然后生成：

```json
{
  "boolSearchJsonStr": "<JSON.stringify(bool_obj)>"
}
```

## 最重要的规则

- `boolSearchJsonStr` 必须是严格 JSON 字符串
- 至少要有 1 个可映射 PHRASE，最稳的是 `JOB_NAME`
- PHRASE 必须使用 `value`
- `matchOperator` 只能是 `INCLUDE`
- `queryChainConditionList` 不能省略 `queryChain`
- 当前版本只支持正向包含搜索

## 上层字段怎么映射

- `jobTitles` -> `JOB_NAME`
- `companies` -> `COMP_NAME`
- `resumeKeywords` -> `context_bm25`
- `mustGroups[].field = jobTitles` -> 一个独立 `queryChainConditionList[]` 段，内部映射到 `JOB_NAME`
- `mustGroups[].field = companies` -> 一个独立 `queryChainConditionList[]` 段，内部映射到 `COMP_NAME`
- `mustGroups[].field = resumeKeywords` -> 一个独立 `queryChainConditionList[]` 段，内部映射到 `context_bm25`
- `expected_city` -> `want_dqs`
- `gender` -> `sex`
- `education` -> `edu_level`
- `full_time_enroll` -> `edu_level_tzs`
- `age_min / age_max` -> `birth_date`

## 最小可用模板

先照这个模板写，不要擅自发明新结构：

```json
{
  "currentPage": 0,
  "pageSize": 20,
  "searcherId": 0,
  "filterFields": [],
  "groupSortFields": [],
  "keywordCondition": {
    "synonym": true
  },
  "logCondition": {},
  "multiFields": [],
  "phraseFields": [],
  "queryChainConditionList": [
    {
      "queryChain": [
        {
          "logicalOperator": "AND",
          "matchOperator": "INCLUDE",
          "queryChains": [],
          "queryFields": []
        }
      ]
    }
  ],
  "rangeFields": [],
  "shieldCondition": {},
  "sortChainCondition": {
    "sortChain": []
  },
  "sortFields": [],
  "tripartite": {}
}
```

## 关键词怎么放进去

### 1. 职位词 `jobTitles`

放到 `queryChainConditionList` 里，使用 `JOB_NAME`：

```json
{
  "field": "JOB_NAME",
  "operator": "INCLUDE",
  "queryType": "PHRASE",
  "rangeType": "CLOSE_CLOSE",
  "slop": 0,
  "standard": "EXTEND",
  "value": "产品经理"
}
```

### 2. 公司词 `companies`

使用 `COMP_NAME`：

```json
{
  "field": "COMP_NAME",
  "operator": "INCLUDE",
  "queryType": "PHRASE",
  "rangeType": "CLOSE_CLOSE",
  "slop": 0,
  "standard": "EXTEND",
  "value": "阿里巴巴"
}
```

### 3. 简历关键词 `resumeKeywords`

统一走 `context_bm25`：

```json
{
  "fieldName": "context_bm25",
  "operator": "INCLUDE",
  "queryType": "PHRASE",
  "rangeType": "CLOSE_CLOSE",
  "slop": 10,
  "standard": "TEMPLATE",
  "value": "Python"
}
```

### 4. 同一维度多个值

第二个开始加 `logicalOperator: "OR"`。

例如多个简历关键词：

```json
[
  {
    "fieldName": "context_bm25",
    "operator": "INCLUDE",
    "queryType": "PHRASE",
    "rangeType": "CLOSE_CLOSE",
    "slop": 10,
    "standard": "TEMPLATE",
    "value": "Python"
  },
  {
    "fieldName": "context_bm25",
    "logicalOperator": "OR",
    "operator": "INCLUDE",
    "queryType": "PHRASE",
    "rangeType": "CLOSE_CLOSE",
    "slop": 10,
    "standard": "TEMPLATE",
    "value": "Django"
  }
]
```

## 更有效的搜索法：关键词篮子

如果普通写法太松，就用 `mustGroups`。

桥接规则：

- 一个 `mustGroup` = 一个独立的 `queryChainConditionList[]`
- 同一个 `mustGroup.values` 里的多个词 = 放进同一个 `queryFields`，第二个开始写 `logicalOperator: "OR"`
- 多个 `mustGroup` 之间天然就是 `AND`

所以：

```json
{
  "mustGroups": [
    {
      "field": "jobTitles",
      "values": ["产品经理", "产品负责人"]
    },
    {
      "field": "resumeKeywords",
      "values": ["用户增长", "增长策略"]
    },
    {
      "field": "resumeKeywords",
      "values": ["App", "移动端"]
    }
  ]
}
```

要被翻译成：

`(产品经理 OR 产品负责人) AND (用户增长 OR 增长策略) AND (App OR 移动端)`

最简单的落地方式就是 3 段 `queryChainConditionList`：

```json
[
  {
    "queryChain": [
      {
        "logicalOperator": "AND",
        "matchOperator": "INCLUDE",
        "queryChains": [],
        "queryFields": [
          {
            "field": "JOB_NAME",
            "operator": "INCLUDE",
            "queryType": "PHRASE",
            "rangeType": "CLOSE_CLOSE",
            "slop": 0,
            "standard": "EXTEND",
            "value": "产品经理"
          },
          {
            "field": "JOB_NAME",
            "logicalOperator": "OR",
            "operator": "INCLUDE",
            "queryType": "PHRASE",
            "rangeType": "CLOSE_CLOSE",
            "slop": 0,
            "standard": "EXTEND",
            "value": "产品负责人"
          }
        ]
      }
    ]
  },
  {
    "queryChain": [
      {
        "logicalOperator": "AND",
        "matchOperator": "INCLUDE",
        "queryChains": [],
        "queryFields": [
          {
            "fieldName": "context_bm25",
            "operator": "INCLUDE",
            "queryType": "PHRASE",
            "rangeType": "CLOSE_CLOSE",
            "slop": 10,
            "standard": "TEMPLATE",
            "value": "用户增长"
          },
          {
            "fieldName": "context_bm25",
            "logicalOperator": "OR",
            "operator": "INCLUDE",
            "queryType": "PHRASE",
            "rangeType": "CLOSE_CLOSE",
            "slop": 10,
            "standard": "TEMPLATE",
            "value": "增长策略"
          }
        ]
      }
    ]
  },
  {
    "queryChain": [
      {
        "logicalOperator": "AND",
        "matchOperator": "INCLUDE",
        "queryChains": [],
        "queryFields": [
          {
            "fieldName": "context_bm25",
            "operator": "INCLUDE",
            "queryType": "PHRASE",
            "rangeType": "CLOSE_CLOSE",
            "slop": 10,
            "standard": "TEMPLATE",
            "value": "App"
          },
          {
            "fieldName": "context_bm25",
            "logicalOperator": "OR",
            "operator": "INCLUDE",
            "queryType": "PHRASE",
            "rangeType": "CLOSE_CLOSE",
            "slop": 10,
            "standard": "TEMPLATE",
            "value": "移动端"
          }
        ]
      }
    ]
  }
]
```

什么时候优先用 `mustGroups`：

- 有 2 到 3 个明确 must-have 概念
- 搜索结果太多但不准
- 你想明确表达“这些概念都要命中”

## 固定筛选条件怎么放

### 城市

```json
{
  "fieldName": "want_dqs",
  "filterValues": ["北京"],
  "operator": "INCLUDE",
  "queryType": "FILTER",
  "rangeType": "CLOSE_CLOSE",
  "slop": 0,
  "standard": "TEMPLATE"
}
```

### 性别

- 女 -> `0`
- 男 -> `1`
- 不限 -> `9`

### 学历码

- 本科 -> `"040"`
- 硕士 -> `"030"`
- MBA / EMBA -> `"020"`
- 博士 -> `"010"`
- 大专 -> `"050"`

## 最后检查

发送前只检查这 5 件事：

1. `boolSearchJsonStr` 是字符串
2. 里面至少有一个 `JOB_NAME`
3. PHRASE 都用 `value`
4. `matchOperator` 都是 `INCLUDE`
5. `queryChainConditionList` 里面保留了 `queryChain`
