# SailerCRM (出海咨询) data model

Writable columns per resource (from the Open API whitelist) and the controlled vocabularies.
The live source of truth is `get_schema` (segments/tracks/stages/sources) and `list_resources` (columns) — this file is a quick reference; if they disagree, trust the tools.

## Resources & writable columns

### leads
`name, region, source, website, phone, email, wechat, contact_name, contacts_json, address, industry, category, raw, notes, status, type, external_ref, customer_id`
- `raw` — keep the cleaned source snippet here for traceability.
- `contacts_json` — JSON array of `{name, phone, email, wechat, title}` when there are several people.
- `customer_id` — set only once a lead has been converted to a customer.

### customers
`name_cn, name_en, owner_id, am_id, segment, flag, region, kind, stage, source, platforms_json, services_json, products_json, notes, external_ref, first_contact, last_contact, lost, archived`
- `kind` — `customer` (in 客户管理) vs `opportunity` (still just in the funnel, pre-win).
- `flag` — `new` (新客户) | `key` (重点客户) | omit for none.
- `segment` — see segments below (a customer may span several; store the primary).

### opportunities
`customer_id, owner_id, title, segment, track, platform, amount, currency, stage, status, probability, expected_close, closed_at, archived`
- `customer_id` — **required**; create/find the customer first.
- `title` — short deal name, often "客户 + 产品/服务".
- `segment` + `track` + `stage` — must be internally consistent (a stage key belongs to exactly one segment/track). See below.
- `currency` — `CNY` (default) | `USD` (reporting converts USD×7.2).
- `status` — `open` | `won` | `lost`.

### partners
`name, type, region, contact_name, phone, email, wechat, website, industry, cooperation, notes, status, external_ref`

### contacts
`customer_id, name, email, phone, wechat, title`

### activities
`customer_id, opportunity_id, type, content, source, evidence_ref, actor, occurred_at, created_by`
- `source` — see activity sources. `content` — the interaction summary. `occurred_at` — ISO datetime if known.

### customer_intelligence  (pk = `customer_id`)
`customer_id, industry, founded, main_products, sales_scale, annual_revenue, employee_count, hq_region, business_model, decision_makers, detail, profile_json`
- `profile_json` — free-form long-tail intel (org structure, decision chain, pain points, competitors, history).

## Vocabularies

### Segments (业务板块) → funnel stages
Each opportunity's `stage` must be a key from its segment (and track). Stage keys are globally unique by prefix.

**strategy — 战略咨询** (no track):
`st_contact` 初步接洽 → `st_diagnosis` 需求诊断 → `st_proposal` 提交方案 → `st_contract` 合同签订 → `st_payment` 收款确认 → `st_kickoff` 项目启动 → `st_delivery` 项目交付完成

**ma — 跨境并购** (track required): `track` = `sell` (卖方) | `buy` (买方)
- sell: `mas_contact` 初步接洽 → `mas_contract` 合同签订 → `mas_findbuyer` 寻找买家 → `mas_loi` LOI 阶段 → `mas_dd` 尽职调查 → `mas_valuation` 估值与交易结构 → `mas_closing` 签约交割 → `mas_commission` 收款(佣金)确认 → `mas_integration` 投后整合
- buy: `mab_contact` 初步接洽 → `mab_contract` 合同签订 → `mab_servicefee` 收款(服务费) → `mab_findtarget` 寻找标的 → `mab_loi` LOI 阶段 → `mab_dd` 尽职调查 → `mab_valuation` 估值与交易结构 → `mab_closing` 签约交割 → `mab_commission` 收款(佣金)确认 → `mab_integration` 投后整合

**channel — 渠道扩张** (track required): `track` = `online` (线上) | `offline` (线下)
- online: `cho_contact` 初步咨询 → `cho_qualify` 需求确认 → `cho_quote` 渠道方案/报价 → `cho_prep` 资料准备 → `cho_contract` 合同签订 → `cho_payment` 收款确认 → `cho_apply` 渠道申请 → `cho_refund` 失败退款
- offline: `chf_contact` 初步咨询 → `chf_qualify` 需求确认 → `chf_quote` 渠道方案/报价 → `chf_prep` 资料准备 → `chf_contract` 合同签订 → `chf_apply` 渠道申请 → `chf_success` 成功进驻 → `chf_payment` 收款确认 → `chf_refund` 失败退款

**enterprise — 企业服务** (no track):
`ent_contact` 初步咨询 → `ent_qualify` 需求确认 → `ent_quote` 报价 → `ent_contract` 合同签订 → `ent_payment` 收款确认 → `ent_execution` 服务执行 → `ent_renewal` 续约/年审

### Lead source (`leads.source`, `customers.source`)
`referral` 转介绍 · `website` 官网/搜索 · `exhibition` 展会/线下活动 · `ad` 广告投放 · `wechat_ad` 微信广告 · `social` 社媒 · `wechat` 公众号 · `telesales` 电销 · `feishu` 飞书 · `linkedin` 领英 · `cold` 主动开发 · `partner` 渠道合作 · `other` 其他

### Lead type (`leads.type`)
`cold` 冷线索(只有联系方式) · `hot` 热线索(有询价/问方案)

### Lead category (`leads.category`)
`amazon_seller` 亚马逊卖家 · `dtc` 独立站卖家 · `trading` 外贸公司 · `alibaba_supplier` 阿里巴巴供应商 · `factory` 工厂 · `other` 其他

### Lead status (`leads.status`)
`new` 待处理 · `reviewing` 跟进中 · `in_deal` 已转商机(转客户后、成交前) · `converted` 已转客户 · `discarded` 已弃用

### Customer flag (`customers.flag`)
`new` 新客户 · `key` 重点客户 · (omit for none)

### Activity source (`activities.source`)
`feishu` 飞书 · `wechat` 微信 · `video_meeting` 视频会议 · `onsite_meeting` 现场会议 · `phone` 电话 · `email` 邮件 · `note` 备注 · `manual` 手动 · `claude` AI录入 (use `claude` for records you ingest)

## Relationships & rules
- opportunity → customer (`customer_id`, required). contact → customer. activity → customer (+ optional opportunity). customer_intelligence → customer (1:1).
- Create a customer before its opportunities/contacts/intelligence.
- Lead is standalone until converted; on conversion set `customer_id` and `status:"converted"`.
- Won opportunity via Open API: set `status:"won"`, and separately set the customer `kind:"customer"` (the app-side win side-effects do not run through the Open API).
