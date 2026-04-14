## 03 调用搜索接口并解析返回

### 接口

- Method：`POST`
- 固定 base URL：`http://open-techarea-sandbox20620.sandbox.tongdao.cn`
- 固定搜索 URL：`http://open-techarea-sandbox20620.sandbox.tongdao.cn/liexiaoxia/search_resume_by_token`
- Headers：`Content-Type: application/json` + `Authorization: Bearer <token>`

请求体固定为：

```json
{
  "boolSearchJsonStr": "<非空 JSON 字符串>"
}
```

## 强规则

- 调用前必须先拿到 token；没有 token 就停下并提示用户去 `https://vacs.tongdao.cn/visa/persionaccesstoken/list` 获取
- 搜索链路只走 API，不要退回浏览器页面
- `boolSearchJsonStr` 必须是字符串，且字符串内容必须是合法 JSON

## 返回值

接口返回值是一个字符串。通常需要先反序列化，再判断是不是列表。

- 如果返回以 `[` 开头：按简历列表解析
- 如果不是数组：更可能是错误提示、鉴权问题或服务端异常，不要当成功处理

## 列表字段说明

### 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `resIdEncode` | `String` | 加密简历 ID，下游主键。 |
| `resName` | `String` | 对外展示姓名。 |
| `age` | `Integer` | 年龄。 |
| `workYears` | `Integer` | 工作年数。 |
| `eduLevelName` | `String` | 学历名称。 |
| `dqName` | `String` | 当前地点名称。 |
| `expectDqName` | `String` | 第一条期望工作地点名称。 |
| `expectJobtitleName` | `String` | 第一条期望职位名称。 |
| `expectSalaryShowName` | `String` | 期望薪资展示文案。 |
| `recentWorkList` | `List` | 最近至多 3 段工作经历。 |
| `highestEdu` | `Object` | 第一条教育经历摘要。 |

### `recentWorkList` 元素

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `companyName` | `String` | 公司名称。 |
| `titleName` | `String` | 职位名称。 |
| `startTime` | `String` | 入职时间展示。 |
| `endTime` | `String` | 离职时间展示。 |

### `highestEdu`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schoolName` | `String` | 学校名称。 |
| `majorName` | `String` | 专业名称。 |
| `eduLevelName` | `String` | 学历名称。 |
| `unifiedEnrollmentName` | `String` | 是否统招的展示名。 |
| `enrollTime` | `String` | 入学时间展示。 |
| `graduateTime` | `String` | 毕业时间展示。 |

## 时间字段展示规则

适用于：

- `recentWorkList[].startTime`
- `recentWorkList[].endTime`
- `highestEdu.enrollTime`
- `highestEdu.graduateTime`

规则：

- 空值或空串的开始时间 / 入学时间：显示为 `未知`
- 结束时间 / 毕业时间为 `999999`：显示为 `至今`
- 结束时间 / 毕业时间为空：保留 `null`
- 6 位 `yyyyMM`：转成 `yyyy.MM`
- 其它特殊文案：原样返回

## 使用建议

- 搜索结果合并或去重时，一律使用 `resIdEncode`
- 样本校准阶段先展示 3 到 5 条摘要，不要一上来就全量推荐
- 正式推荐、追问细节、写入系统时，再调用详情接口补齐
- 如果结果为空，说明本次查询没命中；先调条件，不要伪造候选人
