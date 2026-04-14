## 02 桥接成 `boolSearchJsonStr`

目标：把上一步提取出的属性，整理成一个 JSON 数组，再压缩成字符串。

最终请求体固定是：

```json
{
  "boolSearchJsonStr": "[{\"propertyName\":\"sex\",\"value\":\"女\"}]"
}
```

## 基本规则

- `boolSearchJsonStr` 必须是字符串
- 字符串内容必须是合法 JSON
- JSON 内容必须是数组
- 数组元素必须是对象，字段只允许：
  - `propertyName`
  - `value`
  - `boolSearchValue`（仅多选属性使用）
- 没提到的属性直接跳过，不要生成空对象

## 单选属性

格式：

```json
{
  "propertyName": "sex",
  "value": "女"
}
```

适用字段：

- `sex`
- `resLanguage`
- `marriage`
- `ageLow`
- `ageHigh`
- `workYearLow`
- `workYearHigh`
- `yearSalary`
- `wantYearSalLow`
- `wantYearSalHigh`
- `abroadExp`
- `abroadEdu`
- `abroad`
- `manageExp`

## 多选属性

格式：

```json
{
  "propertyName": "dqs",
  "value": "北京,上海",
  "boolSearchValue": "OR"
}
```

规则：

- `value` 用英文逗号 `,` 连接
- `boolSearchValue` 只允许 `AND` / `OR` / `NOT`
- 即使只有 1 个值，也建议保留 `boolSearchValue: "OR"`

适用字段：

- `dqs`
- `wantDqs`
- `houseHolds`
- `graduationYear`
- `languageContents`
- `schools`
- `specials`
- `eduLevel`
- `schoolDqs`
- `eduLevelTzs`
- `compsNormalized`
- `titlesWithPayload`
- `resTagList`

## `contextBm25` 的桥接方式

有两种常见写法：

### 写成逗号列表

```json
{
  "propertyName": "contextBm25",
  "value": "Python,SQL,风控建模",
  "boolSearchValue": "OR"
}
```

### 写成分组表达式

```json
{
  "propertyName": "contextBm25",
  "value": "(Python or SQL) and (资产配置 or 反欺诈)"
}
```

如果你已经在 `value` 里写成完整表达式，就不要再把它拆坏。

## 完整示例

用户要求：

“想找在北京或上海、女性、做过后端开发或者 AI 产品经理，并且有 Java/Python 和高并发经验的人”

桥接结果：

```json
[
  {
    "propertyName": "sex",
    "value": "女"
  },
  {
    "propertyName": "dqs",
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
    "value": "(Java or Python) and (高并发 or 分布式)"
  }
]
```

压缩后，放进请求体：

```json
{
  "boolSearchJsonStr": "[{\"propertyName\":\"sex\",\"value\":\"女\"},{\"propertyName\":\"dqs\",\"value\":\"北京,上海\",\"boolSearchValue\":\"OR\"},{\"propertyName\":\"titlesWithPayload\",\"value\":\"后端开发工程师,AI产品经理\",\"boolSearchValue\":\"OR\"},{\"propertyName\":\"contextBm25\",\"value\":\"(Java or Python) and (高并发 or 分布式)\"}]"
}
```

## 脚本调用建议

优先使用脚本，不要现场手写请求：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/resume_search/scripts/search_resume.py \
  --criteria-json '[{"propertyName":"wantDqs","value":"北京","boolSearchValue":"OR"},{"propertyName":"titlesWithPayload","value":"AI产品经理,产品经理","boolSearchValue":"OR"},{"propertyName":"contextBm25","value":"(Agent or AI) and (增长 or 商业化)"}]'
```

如需先核对 payload，可加：

```bash
--print-payload-only
```
