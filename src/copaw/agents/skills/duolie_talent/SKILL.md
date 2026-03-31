---
name: duolie_talent
description: "多猎人才搜索与简历查看。适用于用户要按城市、年龄、职位、学历、公司背景等条件搜索候选人，或通过 resumeId 查看完整简历详情的场景。"
metadata:
  {
    "builtin_skill_version": "1.0",
    "copaw":
      {
        "emoji": "🎯",
        "requires": {}
      }
  }
---

# 多猎人才查询 Skill

## 核心能力

1. **搜索人才** - 按城市、年龄、职位、学历、公司背景等条件筛选候选人（浏览器内 API 调用）
2. **查看简历详情** - 通过 `resumeIdEncode` 获取完整简历
3. **结构化输出** - 将搜索结果与简历信息整理成招聘可读的摘要

## 使用前提

- 该 skill 依赖你已登录多猎系统
- API 调用在浏览器内执行，自动携带 HttpOnly cookies，无需手动管理认证信息
- 详细字段说明见 `references/api.md`

## 设计理念

**浏览器即认证容器**。登录后的浏览器自动管理所有 cookies（包括 HttpOnly 的 `duolie_auth`），API 调用在浏览器内执行，无需手动提取和保存认证信息。

补充约束：

- 浏览器的职责是登录、搜索和通过 API 取数，不是拿来给用户直接展示候选人详情页面
- 默认不要为了“推荐候选人”而导航到单个候选人的网页简历详情页
- 默认优先用 `show-res` 这类 API 获取详情，再把结果返回给上层 Agent 组织成聊天区卡片
- 也就是说，默认应在聊天区返回候选人信息与卡片，而不是把浏览器切到多猎网页详情页
- 只有用户明确要求“打开原始网页简历 / 去网页里看这位候选人 / 打开多猎详情页”时，才允许把浏览器切到具体候选人详情页

## 使用流程

### Step 1：启动浏览器并登录

```javascript
await browser.start({ profile: "openclaw" })
await browser.navigate({ targetUrl: "https://www.duolie.com/login" })
await new Promise(r => setTimeout(r, 3000))

const snapshot = await browser.snapshot({ refs: "aria" })
if (!JSON.stringify(snapshot).includes("请输入手机号码")) {
  console.log("已登录，可直接使用")
} else {
  await duolieLogin(browser)
}
```

### Step 1.1：登录函数（如需登录）

登录约束：

- 如果检测到浏览器已经登录多猎，就直接复用当前登录态，不要再次向用户索要手机号、密码或验证码
- 如果检测到浏览器未登录，可以主动向用户索要登录所需信息，并代用户完成登录
- 优先索要当前登录方式真正需要的凭据；如果页面是密码登录模式，可以主动索要手机号和密码；如果页面要求短信验证码，也可以继续向用户索要验证码
- 不要在已经登录的情况下重复打扰用户提供凭据

```javascript
async function duolieLogin(browser) {
  const phone = await askUser("请输入多猎登录手机号：")

  await browser.act({
    kind: "evaluate",
    fn: `(function(val){
      var el=document.querySelector('input[placeholder*="手机"]');
      if(!el) throw new Error('手机号输入框未找到');
      var nativeSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      nativeSetter.call(el,val);
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return el.value;
    })('${phone}')`
  })

  await browser.act({ kind: "click", ref: "e44" })
  await new Promise(r => setTimeout(r, 2000))

  const code = await askUser("请输入短信验证码：")

  await browser.act({
    kind: "evaluate",
    fn: `(function(val){
      var el=document.querySelector('input[placeholder*="验证码"]');
      if(!el) throw new Error('验证码输入框未找到');
      var nativeSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      nativeSetter.call(el,val);
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return el.value;
    })('${code}')`
  })

  const hasSlider = await browser.act({
    kind: "evaluate",
    fn: `!!document.querySelector('.slider,.geetest')`
  })
  if (hasSlider.result) {
    await askUser("检测到滑块验证，请手动完成后告诉我")
  }

  await browser.act({ kind: "click", ref: "e51" })
  await new Promise(r => setTimeout(r, 3000))

  const url = await browser.act({ kind: "evaluate", fn: "window.location.href" })
  if (url.result.includes("login")) {
    throw new Error("登录失败，请检查验证码是否正确")
  }
}
```

### Step 2：搜索人才（浏览器内 API）

```javascript
async function searchTalent(browser, params) {
  const requestBody = {}
  const fields = [
    "jobId", "boolKeyWord", "salaryLow", "salaryHigh", "ageLow", "ageHigh",
    "city", "title", "edu", "tz", "schoolType", "workYearLow", "workYearHigh",
    "companyName", "sex", "language", "filterCompany", "abroad",
    "gradeYears", "gradeSchool", "filterSchool", "politics", "page"
  ]

  for (const key of fields) {
    if (params[key] !== undefined && params[key] !== null) {
      requestBody[key] = params[key]
    }
  }

  const body = "input=" + JSON.stringify(requestBody)
  const result = await browser.act({
    kind: "evaluate",
    fn: `(async function(body){
      const xsrfToken = document.cookie.split(';').find(c=>c.trim().startsWith('XSRF-TOKEN'))?.split('=')[1];
      if(!xsrfToken) throw new Error('未找到 XSRF-TOKEN，可能未登录');

      const response = await fetch('https://api-rcn.duolie.com/api/com.liepin.rcnagi.rcntool.search-res', {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/x-www-form-urlencoded',
          'origin': 'https://www.duolie.com',
          'referer': 'https://www.duolie.com/newtalent/talentlist',
          'x-client-type': 'web',
          'x-fscp-bi-stat': '{"location": "https://www.duolie.com/newtalent/talentlist"}',
          'x-fscp-fe-version': '',
          'x-fscp-std-info': '{"client_id": "40362"}',
          'x-fscp-trace-id': crypto.randomUUID(),
          'x-fscp-version': '1.1',
          'x-requested-with': 'XMLHttpRequest',
          'x-xsrf-token': xsrfToken
        },
        credentials: 'include',
        body: body
      });
      const result = await response.json();
      if(result.code === '-1401') throw new Error('Token 已过期，需要重新登录');
      return JSON.stringify(result);
    })('${body}')`
  })

  return JSON.parse(result.result)
}
```

### Step 3：查看简历详情（浏览器内 API）

```javascript
async function getResumeDetail(browser, resumeIdEncode) {
  const body = "input=" + JSON.stringify({ resumeIdEncode })

  const result = await browser.act({
    kind: "evaluate",
    fn: `(async function(body){
      const xsrfToken = document.cookie.split(';').find(c=>c.trim().startsWith('XSRF-TOKEN'))?.split('=')[1];
      if(!xsrfToken) throw new Error('未找到 XSRF-TOKEN，可能未登录');

      const response = await fetch('https://api-rcn.duolie.com/api/com.liepin.rcnagi.rcntool.show-res', {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/x-www-form-urlencoded',
          'origin': 'https://www.duolie.com',
          'referer': 'https://www.duolie.com/newtalent/talentlist',
          'x-client-type': 'web',
          'x-fscp-bi-stat': '{"location": "https://www.duolie.com/newtalent/talentlist"}',
          'x-fscp-fe-version': '',
          'x-fscp-std-info': '{"client_id": "40362"}',
          'x-fscp-trace-id': crypto.randomUUID(),
          'x-fscp-version': '1.1',
          'x-requested-with': 'XMLHttpRequest',
          'x-xsrf-token': xsrfToken
        },
        credentials: 'include',
        body: body
      });
      const result = await response.json();
      if(result.code === '-1401') throw new Error('Token 已过期，需要重新登录');
      return JSON.stringify(result);
    })('${body}')`
  })

  return JSON.parse(result.result)
}
```

## 输出建议

- 搜索结果优先按「匹配关键词 / 当前岗位 / 学历 / 城市 / 年限 / 当前公司」整理摘要
- 查看简历详情时，优先提炼：基本信息、最近工作经历、教育背景、求职意向、匹配点、风险点与待核实问题

## 正式推荐输出协议

当你已经完成样本校准，或用户明确要求“正式推荐候选人 / 直接给我推荐结果”时，不要只输出普通 markdown 列表、表格或长段落。

正确做法是：

1. 先用 1 到 3 行说明这一轮推荐的判断依据
2. 然后为每位正式推荐的候选人输出一个结构化 `resume_card`
3. 每张卡片只放最关键的匹配信息，不要把整份简历原文塞进去

`resume_card` 至少应包含这些字段：

- `type`: 固定为 `resume_card`
- `candidate_id`: 候选人唯一标识；没有时可留空字符串，但优先填写
- `candidate_name`: 候选人姓名
- `current_title`: 当前职位
- `current_company`: 当前公司
- `city`: 当前城市
- `years_experience`: 工作年限
- `education`: 最高学历或核心教育背景
- `tags`: 2 到 5 个标签
- `highlights`: 2 到 4 条亮点
- `match_reason`: 你为什么正式推荐他
- `resume_detail_url`: 可打开详情的简历链接；如果底层能力拿到了详情链接，这个字段必须带上

示例：

```json
{
  "type": "resume_card",
  "candidate_id": "duolie_123",
  "candidate_name": "张三",
  "current_title": "AI 产品经理",
  "current_company": "某头部互联网公司",
  "city": "北京",
  "years_experience": 8,
  "education": "北京大学硕士",
  "tags": ["AI 产品", "搜索", "大厂背景"],
  "highlights": [
    "负责过搜索与推荐产品",
    "带过跨职能协作项目",
    "对生成式 AI 场景熟悉"
  ],
  "match_reason": "更符合你要的 AI 产品主力画像，兼具大厂方法论和落地经验。",
  "resume_detail_url": "https://example.com/resume/123"
}
```

注意：

- `resume_card` 是正式推荐的呈现方式，不是底层搜索结果原样透出
- 如果仍处在样本校准阶段，可以先不给卡片，只给判断结论
- 一旦进入正式推荐，不要只发普通项目符号、表格或“卡片样式的文本”
- 不要为了向用户展示候选人，再额外打开浏览器页面或把站外详情页直接甩给用户
