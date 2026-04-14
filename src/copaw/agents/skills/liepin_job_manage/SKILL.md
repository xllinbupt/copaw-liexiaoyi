---
name: liepin_job_manage
description: "猎聘企业版职位管理。适用于查看企业版职位列表、拉取职位详情，以及把猎聘企业版职位真实绑定到当前 CoPaw 职位。查询和绑定都必须走本 skill 提供的脚本，不要只做口头确认。"
metadata:
  {
    "builtin_skill_version": "1.4",
    "copaw":
      {
        "emoji": "🔗",
        "requires": {}
      }
  }
---

# 猎聘企业版职位管理 Skill

当用户要做下面任一件事时，使用本 skill：

- 查看猎聘企业版职位列表
- 拉取某个猎聘企业版职位详情
- 把 CoPaw 内部职位与猎聘企业版职位建立真实对应关系
- 校验当前职位是否已绑定企业版职位

## 最重要规则

- 只要你声称“已查到企业版职位”或“已建立职位对应关系”，就必须运行本 skill 里的脚本，不能只靠文档推断。
- 如果用户要建立职位对应关系，而当前 chat 还没有绑定 CoPaw 职位，先切换到 `job_creator` 完成职位创建或绑定。
- 猎小侠相关接口现在统一要求 token；默认优先读取 `LIEXIAOXIA_TOKEN`，没有的话脚本会尝试从 `https://vacs.tongdao.cn/visa/persionaccesstoken/list` 自动解析。
- 如果企业版职位接口暂时不可用、报鉴权异常、超时或网络错误，先检查当前 agent 所在网络环境是否能访问猎聘内网，再继续排查 token 或接口参数。
- 绑定外部职位时，优先把职位详情快照一起写入关系记录，便于详情页直接展示。
- `copawExternalJobId` 优先复用列表接口真实返回的 `ejobId`；只有当列表里没有 `ejobId` 时，才会退回 `liepin:list:*` 占位 ID。
- 在没有拿到接口真实返回的 `ejobPcUrl` / `urlPc` 之前，不要手工猜测或拼接职位 URL；拿不到就留空。
- 同一个 CoPaw 职位只允许绑定 1 个猎聘企业版职位；如果脚本报冲突，不要强行覆盖，先告诉用户。

## 可执行能力

### 1. 获取企业版职位列表

运行：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/liepin_job_manage/scripts/list_ejobs.py
```

说明：

- 默认请求 `http://open-techarea-sandbox20620.sandbox.tongdao.cn/liexiaoxia/get_ejob_list_by_token`
- Header 自动带 `Authorization: Bearer <token>`
- 请求体默认发送 `{"ejobId": 0}`，保持和职位详情接口同一字段结构；如果脚本拿不到 token，不要伪造成功，应直接反馈 token 错误
- 返回为职位数组时，按 JSON 解析
- 如果原始列表结果已经带 `ejobId`，脚本会直接把它透传为 `copawExternalJobId`；如果没有，才会额外补出 `liepin:list:*` 占位 ID
- 做外部职位绑定时，优先把整条列表项原样作为 `remote_snapshot_json` 一起写入
- 如果返回不是 JSON 数组，不要假装成功，应把错误原文告诉用户

### 2. 获取企业版职位详情

当你已经拿到 `ejobId` 时，运行：

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/liepin_job_manage/scripts/get_ejob_detail.py \
  --ejob-id "<ejobId>"
```

说明：

- 默认请求 `http://open-techarea-sandbox20620.sandbox.tongdao.cn/liexiaoxia/get_ejob_detail`
- Header 自动带 `Authorization: Bearer <token>`
- 请求体必须是 `{"ejobId": 123}`
- 当列表返回里已有真实 `ejobId` 时，可直接把该值传给 `--ejob-id`
- 如果 `copawExternalJobId` 仍是 `liepin:list:*`，说明列表里没给真实 `ejobId`，这时不要直接拿它去调用详情接口
- 成功时返回单个职位对象
- 失败时保留原始错误文本，不要编造职位详情

### 3. 绑定猎聘企业版职位到 CoPaw 职位

#### 路径 A：当前 chat 已绑定职位，直接绑定外部职位

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/liepin_job_manage/scripts/bind_external_job_link.py \
  --workspace-dir . \
  --session-id "<Session ID>" \
  --user-id "<User ID>" \
  --channel "<Channel>" \
  --platform "liepin" \
  --external-job-id "<ejobId>" \
  --external-job-title "<职位名称>" \
  --external-job-url "<职位链接>" \
  --external-status "<职位状态>" \
  --account-key "<企业版账号标识>" \
  --account-name "<企业版账号名称>" \
  --remote-snapshot-json '<职位详情 JSON>'
```

#### 路径 B：你已经明确知道 CoPaw `job_id`

```bash
PYTHON_BIN="/app/venv/bin/python"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

"$PYTHON_BIN" skills/liepin_job_manage/scripts/bind_external_job_link.py \
  --workspace-dir . \
  --job-id "<CoPaw job_id>" \
  --platform "liepin" \
  --external-job-id "<ejobId>" \
  --external-job-title "<职位名称>" \
  --account-key "<企业版账号标识>" \
  --account-name "<企业版账号名称>"
```

说明：

- 若 `account-key` 对应的平台账号不存在，脚本会自动创建平台账号记录
- 若当前 CoPaw 职位已经绑定了其他企业版职位，脚本会报冲突
- 如果列表页已经返回真实 `ejobId`，绑定时直接使用它作为 `external-job-id`
- 如果列表页仍然没有真实 `ejobId`，允许先把 `copawExternalJobId` 当作稳定占位 ID 写入，并把原始列表项作为 `remote_snapshot_json`
- 只有当接口真实返回了 `ejobPcUrl` / `urlPc` 时，才写 `external-job-url`；否则保持为空，后续拿到真实详情再补
- 后续一旦拿到真实 `ejobId`，应继续调用绑定脚本回写；系统会把同名的列表占位关系升级成真实 ID，而不是新增重复关系
- 成功后，CoPaw 职位详情页里的“企业版关联”会直接显示这条关系

## 推荐执行顺序

1. 如果当前 chat 还没绑定 CoPaw 职位，先用 `job_creator`
2. 用本 skill 查企业版职位列表
3. 如果用户是基于某个列表里的职位创建 CoPaw 职位，创建后立刻用该项的 `copawExternalJobId` 补绑外部关系，不要只创建本地职位
4. 如果列表里已经有真实 `ejobId`，继续拉详情并回写真实关系和真实 URL
5. 向用户反馈：查到了什么、绑定到了哪个 CoPaw 职位、是否已可在详情页看到

## 输出要求

- 查看列表：给简明列表，至少包含职位名称、地区、薪资、刷新时间
- 查看详情：给结构化摘要，至少包含 `ejobId`、职位名称、地区、薪资、工作年限、学历、JD 摘要、职位链接
- 绑定成功：先用 1 句说明，然后输出一个 JSON 代码块，至少包含：

```json
{
  "type": "external_job_link",
  "platform": "liepin",
  "job_id": "copaw-job-id",
  "job_name": "CoPaw 职位名称",
  "external_job_id": "123456",
  "external_job_title": "猎聘企业版职位名称",
  "account_name": "企业版账号名称",
  "status": "active"
}
```

## 常见错误处理

- 当前 chat 未绑定 CoPaw 职位：先转 `job_creator`
- 企业版职位列表里没有唯一可确认的职位：先让用户确认，不要乱绑
- 详情接口返回“职位不存在”或“参数非法”：直接如实反馈
- 绑定时报“当前 CoPaw 职位已绑定其他企业版职位”：告诉用户当前存在既有对应关系，不要自动覆盖
