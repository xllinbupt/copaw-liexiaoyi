## 01 搜索词拆解（最简版）

目标：把招聘需求整理成一个简单、稳定、低歧义的 `plan`。

只允许 3 个关键词维度：

- `jobTitles`
- `companies`
- `resumeKeywords`

固定筛选条件单独放到 `fixedFilters`。

当前版本只支持正向包含搜索。

当搜索需求里有多个“必须同时满足”的概念时，可以额外写 `mustGroups`。

`mustGroups` 的规则：

- 一个 group = 一个 must-have 概念
- group 内多个词 = `OR`
- group 与 group 之间 = `AND`

## 规则

### 1. `jobTitles`

- 这是最重要的维度
- 通常必须有
- 写候选人简历里会出现的职位名

例子：

- `产品经理`
- `销售总监`
- `Java开发`

### 2. `companies`

- 只有在用户明确要求某类公司背景时再写
- 如果用户给的是具体公司，就写具体公司名
- 如果用户给的是“外企 / 大厂 / 连锁”这类集合概念，可以展开成代表公司

### 3. `resumeKeywords`

- 写简历里会出现的关键词
- 一轮先写 2 到 5 个
- 用真实词，不要用抽象能力词

好的例子：

- `Python`
- `SQL`
- `招投标`
- `直播运营`
- `跨境电商`

不好的例子：

- `沟通能力`
- `学习能力`
- `行业理解`
- `有战略性`

### 4. 固定筛选条件

这些不要混进关键词维度：

- 城市
- 年限
- 学历
- 统招
- 年龄
- 性别
- 语言

## 输出格式

只输出下面这个 JSON：

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

如果需要更精准的搜索，可以额外加上：

```json
{
  "mustGroups": [
    {
      "field": "jobTitles",
      "values": []
    },
    {
      "field": "resumeKeywords",
      "values": []
    }
  ]
}
```

## 什么时候要写 `mustGroups`

- 用户明确给了两个以上 must-have 条件
- 你发现普通 `resumeKeywords` 搜出来太散
- 你需要表达 `(A OR B) AND (C OR D)` 这种结构

例子：

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

它的意思是：

`(产品经理 OR 产品负责人) AND (用户增长 OR 增长策略 OR 商业化) AND (App OR 移动端)`

## 组合搜索的经验规则

- 先有 `jobTitles`
- 再补 1 到 2 组最关键的 `mustGroups`
- 公司背景不是默认必加，只有用户明确要求时再加
- 结果太多：优先拆组，不要先堆更多词
- 结果太少：优先减少关键词，不要先删岗位词
- 一次只改一层，这样才知道是哪一层让结果变好或变差

## 改写原则

- 结果太少：增加同义词，减少关键词数量，放宽职位词
- 结果太多：删泛词，保留最关键的 2 到 3 个关键词
- 结果跑偏：删掉容易误导的关键词，换成更具体的简历关键词
- 结果太散：优先拆成 `mustGroups`，不要把所有词堆在一个数组里
