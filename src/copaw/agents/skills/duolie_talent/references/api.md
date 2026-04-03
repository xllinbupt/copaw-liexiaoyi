# 多猎 API 参考文档

---

## 接口一：搜索人才

**路径**：`https://api-rcn.duolie.com/api/com.liepin.rcnagi.rcntool.search-res`

### 入参字段（均为可选）

| 字段 | 类型 | 说明 |
|------|------|------|
| jobId | string | 职位唯一标识，示例：J34E4982C32FA4 |
| boolKeyWord | string | 工作经验关键词，格式：`(A or B or C) and (E or F)`，组内 or、组间 and |
| salaryLow | int | 年薪下限，单位：万元 |
| salaryHigh | int | 年薪上限，单位：万元 |
| ageLow | int | 年龄下限 |
| ageHigh | int | 年龄上限，不超过 46 岁 |
| city | string | 城市，多个用空格分隔（或关系），可填「全国」表示不限 |
| title | string | 职务名称，多个用空格分隔（或关系） |
| edu | string | 最低学历要求，取值：博士 / 硕士 / 本科 / 大专 |
| tz | string | 统招要求，取值：统招大专 / 统招本科 / 统招硕士 / 统招博士 / 不限 |
| schoolType | string | 学校层次，多个用空格分隔，取值：211 / 985 / 双一流 / 一本院校 / QS100 / QS200 等 |
| workYearLow | int | 工作年限下限 |
| workYearHigh | int | 工作年限上限 |
| companyName | string | 任职过的公司名称，多个用空格分隔（或关系） |
| sex | string | 性别，取值：男 / 女 / 不限 |
| language | string | 语言要求，多个用空格分隔 |
| filterCompany | string | 排除公司名称，多个用空格分隔 |
| abroad | bool | 是否要求海外工作经历 |
| gradeYears | string | 毕业年份，多个用空格分隔（或关系） |
| gradeSchool | string | 毕业院校名称，多个用空格分隔（或关系） |
| filterSchool | string | 排除院校名称，多个用空格分隔 |
| politics | string | 政治面貌，多个用空格分隔（或关系） |
| page | int | 当前页，从 0 开始 |

### 入参格式

所有入参通过 `input` 字段包装为 JSON，且应进行 URL 编码：

```text
body = "input=" + encodeURIComponent(JSON.stringify({ keyword: "Java", city: "上海 北京", workYearLow: 3 }))
```

### 返回结构

```text
total        long    搜索结果总条数
list[]              简历摘要列表
  resumeId   string  简历唯一ID（调用详情接口时作为 resumeIdEncode 传入）
  name       string  姓名
  sex        string  性别
  age        int     年龄
  workYears  int     工作年限（年）
  city       string  当前城市
  edu        string  最高学历
  salaryCurrent   string  当前薪资（可为 null）
  salaryExpected  string  期望薪资
```

---

## 接口二：简历详情

**路径**：`https://api-rcn.duolie.com/api/com.liepin.rcnagi.rcntool.show-res`

### 入参字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| resumeIdEncode | string | 是 | 简历唯一 ID（来自搜索接口返回的 `resumeId` 或用户手动提供） |

### 返回结构

```text
resumeId       string    简历ID
basicInfo              基本信息
jobIntentions[]         求职期望列表
workExperience[]        工作经历列表
education[]             教育经历列表
selfEvaluation  string  自我评价（可为 null）
languages       []string 语言能力列表（可为 null）
certificates    []string 资格证书列表（可为 null）
projects[]              项目经历列表（可为 null）
```

---

## 错误处理

| 情况 | 返回 |
|------|------|
| 未登录 / Cookie 过期 / Token 无效 | `code: "-1401"`，`msg` 包含“过期”或“重新登录” |
| 系统错误（通常是入参格式错误） | `code: "-1"`，`msg: "系统错误"`，检查 `input` 包装是否正确 |
| 请求参数错误 / 请求头缺失 | `code: "-1400"` 或 HTTP `400`，优先检查 `input` 是否 URL 编码、`x-fscp-*` 请求头是否完整 |
| 简历不存在或 `resumeIdEncode` 非法 | BizException 提示 |

**凭据过期时**：需要重新执行完整登录流程。

**搜索排障建议**：

- 如果搜索接口连续返回 `400`、`-1400` 或 `-1`，不要切到页面实际搜索
- 优先检查 `input` 是否已 URL 编码、请求头是否完整、`referer` 是否稳定、XSRF token 是否有效
- 建议先用最小参数集验证接口，再逐步加回城市、年限、学历、关键词等筛选项
- 如果某轮请求失败，要明确定位是“编码问题 / 字段问题 / 请求头问题 / 登录态问题”，再继续沿 API 修复
