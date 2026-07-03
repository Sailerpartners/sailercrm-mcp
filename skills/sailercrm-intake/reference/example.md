# Worked example: raw transcript → confirmation table

How a messy input should be cleaned, classified, and presented for confirmation. Follow this shape.

## Input (user pastes)

> 【6/28 电话记录】下午跟深圳蓝湾科技的王总(王建国,创始人)通了 40 分钟。他们做智能宠物用品,亚马逊美国站年销大概 800 万美金,团队 60 人左右。之前在我们公众号看到文章加的微信。想做欧洲市场,问了 VAT 注册和海外仓的报价,预算说 30 万以内。约了下周三给方案。对了,他提到他们的物流商"迅达国际"也想跟我们聊聊合作,联系人 Lisa,lisa@xunda.com。
> 另外,上次那个杭州优品家居的并购项目,对方已经签了我们的买方服务协议,服务费这周到账了。

## What gets dropped

Pleasantries, "聊了 40 分钟", "约了下周三"(kept only as next-step context in notes)。Everything else has CRM value.

## Step 2 output — after querying the CRM

- `query_records customers {name_cn: "深圳蓝湾科技"}` → no match → **NEW**
- `query_records leads {name: "深圳蓝湾科技"}` → no match → **NEW**(hot: 有询价+预算)
- `query_records customers {name_cn: "杭州优品家居"}` → id 87, has opportunity id 45 (segment `ma`, track `buy`, stage `mab_contract`) → **UPDATE**(签约后服务费到账 → 推进到 `mab_servicefee`)
- `query_records partners {name: "迅达国际"}` → no match → **NEW**

## Step 3 — confirmation table shown to the user

**📥 拟导入 SailerCRM,请确认(未经确认不会写入):**

**线索(1 新增)**
| # | 操作 | 名称 | 类型 | 来源 | 分类 | 备注 |
|---|------|------|------|------|------|------|
| 1 | 新增 | 深圳蓝湾科技 | hot 热线索 | wechat 公众号 | amazon_seller | 智能宠物用品,亚马逊美国站年销$800万,团队~60人;想做欧洲,询 VAT+海外仓,预算≤30万;下周三给方案。联系人:王建国(创始人),微信已加 |

**商机(1 更新)**
| # | 操作 | 目标 | 变更 |
|---|------|------|------|
| 2 | 更新 | 商机 #45(杭州优品家居 · 跨境并购/买方) | stage: `mab_contract` 合同签订 → `mab_servicefee` 收款(服务费) |

**合作伙伴(1 新增)**
| # | 操作 | 名称 | 类型 | 联系人 |
|---|------|------|------|--------|
| 3 | 新增 | 迅达国际 | 物流服务商 | Lisa · lisa@xunda.com |

**活动(2 新增)**
| # | 操作 | 挂靠 | 来源 | 内容摘要 |
|---|------|------|------|---------|
| 4 | 新增 | 线索"深圳蓝湾科技" → 转客户后挂靠* | phone | 6/28 电话:欧洲市场需求沟通,询 VAT/海外仓报价 |
| 5 | 新增 | 客户 #87 / 商机 #45 | note | 买方服务协议已签,服务费到账 |

\* 活动表需要 customer_id;蓝湾科技当前只是线索,该电话内容先存入线索的 `raw`/`notes` 字段,待转客户后再补活动。(此类脚注要向用户说明。)

**确认导入?也可以指出要修改的行。**

## Step 4 — after user approves

1. `create_record leads {...}` → id
2. `update_record opportunities 45 {stage: "mab_servicefee"}`
3. `create_record partners {...}` → id
4. `create_record activities {customer_id: 87, opportunity_id: 45, type: "note", content: "买方服务协议已签,服务费到账", source: "claude"}`

Report: 「已完成:新增 2(线索 #x、伙伴 #y),更新 1(商机 #45 → 收款(服务费)),活动 1。」

## Notes on judgment calls this example encodes

- 有询价+预算 → `hot`;只有联系方式 → `cold`。
- 蓝湾没有成交意向确认前是**线索**,不建客户/商机。
- 服务费到账≠赢单:并购买方流程里 `mab_servicefee` 是中途阶段,商机继续 `open`。
- 迅达国际是供应商性质 → partner,不是 lead。
- 金额币种:$800万是背景情报(写 notes/raw),不是商机金额;预算30万(CNY)在建商机时才用。
