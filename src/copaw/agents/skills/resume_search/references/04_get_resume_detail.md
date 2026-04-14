## 04 获取简历详情（用于精筛 / 入表前补齐信息）

### 何时使用

- 需要按 `resIdEncode` 拉取完整结构化简历详情时使用
- 搜索接口返回的是列表摘要；当你要精筛、写入系统、加入 Pipeline、或回答候选人细节时，优先对重点候选人调用详情接口

### 接口

- Method：`POST`
- 固定 base URL：`http://open-techarea-sandbox20620.sandbox.tongdao.cn`
- 固定详情 URL：`http://open-techarea-sandbox20620.sandbox.tongdao.cn/liexiaoxia/get_resume_detail_by_token`
- Headers：`Content-Type: application/json` + `Authorization: Bearer <token>`

### 入参

```json
{
  "resIdEncode": "（搜索列表返回的加密简历 ID）"
}
```

注意：

- 必须使用搜索列表返回的 `resIdEncode` 原值
- 不要把明文 `resId` 当成 `resIdEncode`
- 如果 `resIdEncode` 为空、空白或未传，通常会返回空字段对象

### 出参解析

- 若返回以 `{` 开头：按 JSON 对象解析
- 若返回以 `[` 开头：按数组解析
- 否则：按中文提示或错误处理

详情对象通常可包含：

- 基本信息：性别、年龄、当前薪资、学历、行业、城市、当前职位、当前公司
- 求职意向：期望薪资、行业、地点、职能
- 教育经历：学校、专业、统招、时间
- 工作经历：公司、职位、地点、职责、时间
- 项目经历
- 语言能力
- 证书
- 自我评价
- 简历详情链接：如 `urlPc`

如果详情里有真实可打开的 `urlPc`，推荐在 `resume_card` 里映射为：

- `resume_detail_url`
- `detail_url`

如果没有真实链接，就保持为空，不要伪造。

### 默认策略

- 默认只对 Top 5 到 10 位重点候选人调用，不要全量批量拉
- 若用户只是想快速扫一眼结果，可以先不拉详情
- 若你要正式推荐或加入 Pipeline，建议先拉详情再组织结论

### 错误与边界

- 未登录 / 无法识别用户：可能返回业务异常
- token 缺失 / 失效：可能返回鉴权异常，应先换新 token 再重试
- 密文有效但无数据：通常返回空字段对象
- 密文非法：行为以联调环境为准，因此应始终使用搜索接口返回的原始 `resIdEncode`
