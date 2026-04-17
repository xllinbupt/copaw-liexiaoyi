## 02 桥接成 `boolSearchJsonStr`

目标：把上一步提取出的属性对象压缩成字符串，再放进请求体。

最终请求体固定是：

```json
{
  "boolSearchJsonStr": "{\"sex\":\"女\",\"wantDqs\":\"北京,上海\",\"jobTitle\":\"AI产品经理 产品经理\",\"keyword\":\"(Agent or AI) and (增长 or 商业化)\",\"curPage\":1,\"pageSize\":20}"
}
```

## 基本规则

- `boolSearchJsonStr` 必须是字符串
- 字符串内容必须是合法 JSON
- JSON 内容必须是对象，不是数组
- 没提到的属性直接跳过，不要生成空字段

## 字段值格式

### 单选属性

保持标量：

```json
{
  "sex": "女",
  "ageLow": 25,
  "pageSize": 20
}
```

### 多值字符串属性

按字段要求拼成字符串：

```json
{
  "wantDqs": "北京,上海",
  "eduLevel": "本科 硕士",
  "company": "阿里巴巴 腾讯"
}
```

规则：

- 地区类字段：英文逗号 `,`
- 其它多值字段：空格

### `keyword`

优先直接放完整表达式：

```json
{
  "keyword": "(Python or SQL) and (资产配置 or 反欺诈)"
}
```

如果只是简单罗列几个关键词，也可以先组一层 `or`：

```json
{
  "keyword": "(AI or Agent or 商业化)"
}
```

## 完整示例

用户要求：

“想找在北京或上海、女性、做过后端开发或者 AI 产品经理，并且有 Java/Python 和高并发经验的人，第 2 页，每页 30 个”

桥接结果：

```json
{
  "sex": "女",
  "wantDqs": "北京,上海",
  "jobTitle": "后端开发工程师 AI产品经理",
  "keyword": "(Java or Python) and (高并发 or 分布式)",
  "curPage": 2,
  "pageSize": 30
}
```

压缩后，放进请求体：

```json
{
  "boolSearchJsonStr": "{\"sex\":\"女\",\"wantDqs\":\"北京,上海\",\"jobTitle\":\"后端开发工程师 AI产品经理\",\"keyword\":\"(Java or Python) and (高并发 or 分布式)\",\"curPage\":2,\"pageSize\":30}"
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
  --criteria-json '{"wantDqs":"北京","jobTitle":"AI产品经理 产品经理","keyword":"(Agent or AI) and (增长 or 商业化)","curPage":1,"pageSize":20}'
```

如需先核对 payload，可加：

```bash
--print-payload-only
```
