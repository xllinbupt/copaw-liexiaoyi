## 03 调用搜索接口 + 解析返回

### 接口

- Method：`POST`
- 固定 base URL：`http://open-techarea-sandbox20620.sandbox.tongdao.cn`
- 固定搜索 URL：`http://open-techarea-sandbox20620.sandbox.tongdao.cn/liexiaoxia/search_resume_by_token`
- Headers：`Content-Type: application/json` + `Authorization: Bearer <token>`
- Body：

```json
{
  "boolSearchJsonStr": "<非空 JSON 字符串>"
}
```

### `boolSearchJsonStr` 的要求

- 它必须是一个字符串
- 字符串内容必须是严格 JSON
- 建议直接使用 `JSON.stringify(bool_obj)` 生成
- 不要把未经转义的多行 `{ ... }` 直接拼进字符串

### 强规则

- 搜索只能调用上面的固定 URL
- 调用前必须先拿到 token；没有 token 时先停下来补 token，不要裸调接口
- 如果调用失败，先检查请求体和网络，不要自动退回浏览器搜索

### 返回解析

- 如果返回内容不是以 `[` 开头，说明它更可能是中文提示句或错误信息，不要当 JSON 数组解析
- 如果返回内容以 `[` 开头，再按简历列表 JSON 数组解析

### 主键规则

- 列表项里下游链路真正使用的主键是 `resIdEncode`
- 不要再依赖明文 `resId` 去拉详情、入表或做跨页去重
- 合并多页结果时，以 `resIdEncode` 去重

### 分页策略

- 快速预览模式：允许只拉 1 页
- 默认招聘检索模式：至少先拉 1 到 3 页，再进入精筛
- 若入围候选人还不够，应继续翻页；单套检索最多约 10 页，之后再考虑改写计划
- 在 `bool_obj` 中显式设置：
  - `currentPage`: 按联调环境的起始规则递增
  - `pageSize`: 建议 20
- 每次复用相同搜索条件，只改 `currentPage`

### 搜索摘要建议

- 只展示前 3 到 5 条候选人摘要
- 对“偏多 / 偏少 / 跑偏”给出 1 到 2 条下一步建议
- 如果任务还处在样本校准阶段，优先给判断，不急着进入正式推荐
