# DingTalk Onboarding 设计文档

**日期:** 2026-02-15
**状态:** 设计完成，待实现
**参考:** tlon 扩展 (https://github.com/nexa/nexa/tree/main/extensions/tlon)

## 概述

为 DingTalk 插件实现交互式 onboarding 功能，允许用户通过命令行向导配置插件参数，而非手动编辑配置文件。

## 目标

1. 提供与 nexa 其他 channel 一致的 onboarding 体验
2. 支持多账户配置
3. 分步引导必填和可选配置项
4. 支持增量配置（后续修改部分参数）

## 文件结构

```
src/
├── channel.ts          # 现有：添加 onboarding 属性
├── onboarding.ts       # 新增：onboarding 适配器实现
├── types.ts            # 修改：添加 listDingTalkAccountIds, resolveDingTalkAccount
└── config-schema.ts    # 现有：无修改
```

## Onboarding 流程

```
1. 显示帮助说明
   └── 钉钉开发者后台链接和文档

2. 必填配置（基本连接）
   ├── clientId (AppKey)
   └── clientSecret (AppSecret)

3. 可选配置（引导询问）
   ├── 是否配置完整凭证? (robotCode, corpId, agentId)
   ├── 是否启用 AI 互动卡片?
   │   └── 如果是：输入 cardTemplateId + cardTemplateKey
   ├── 私聊策略 (open/allowlist)
   │   └── 如果是 allowlist：输入允许的用户 ID
   └── 群聊策略 (open/allowlist)
       └── 如果是 allowlist：输入允许的群 ID

4. 生成配置并返回
```

## 核心组件

### 1. src/onboarding.ts

```typescript
import type { NexaConfig } from 'nexa/plugin-sdk';
import {
  formatDocsLink,
  promptAccountId,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  type ChannelOnboardingAdapter,
  type WizardPrompter,
} from 'nexa/plugin-sdk';
import type { DingTalkConfig } from './types.js';
import { listDingTalkAccountIds, resolveDingTalkAccount } from './types.js';

const channel = 'dingtalk' as const;

function isConfigured(account: DingTalkConfig): boolean {
  return Boolean(account.clientId && account.clientSecret);
}

function applyAccountConfig(params: {
  cfg: NexaConfig;
  accountId: string;
  input: Partial<DingTalkConfig>;
}): NexaConfig {
  // 实现配置合并逻辑
}

async function noteDingTalkHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      'You need DingTalk application credentials.',
      '1. Visit https://open-dev.dingtalk.com/',
      '2. Create an enterprise internal application',
      "3. Enable 'Robot' capability",
      "4. Configure message receiving mode as 'Stream mode'",
      `Docs: ${formatDocsLink('/channels/dingtalk', 'channels/dingtalk')}`,
    ].join('\n'),
    'DingTalk setup'
  );
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const dingtalkOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const accountIds = listDingTalkAccountIds(cfg);
    const configured =
      accountIds.length > 0
        ? accountIds.some((accountId) => isConfigured(resolveDingTalkAccount(cfg, accountId)))
        : isConfigured(resolveDingTalkAccount(cfg, DEFAULT_ACCOUNT_ID));

    return {
      channel,
      configured,
      statusLines: [`DingTalk: ${configured ? 'configured' : 'needs setup'}`],
      selectionHint: configured ? 'configured' : '钉钉企业机器人',
      quickstartScore: configured ? 1 : 4,
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    // 实现完整配置流程
  },
};
```

### 2. src/types.ts 新增函数

```typescript
import { DEFAULT_ACCOUNT_ID } from 'nexa/plugin-sdk';

export function listDingTalkAccountIds(cfg: NexaConfig): string[] {
  const dingtalk = cfg.channels?.dingtalk as DingTalkChannelConfig | undefined;
  if (!dingtalk) return [];

  const accountIds: string[] = [];

  if (dingtalk.clientId || dingtalk.clientSecret) {
    accountIds.push(DEFAULT_ACCOUNT_ID);
  }

  if (dingtalk.accounts) {
    accountIds.push(...Object.keys(dingtalk.accounts));
  }

  return accountIds;
}

export function resolveDingTalkAccount(
  cfg: NexaConfig,
  accountId?: string | null
): DingTalkConfig & { configured: boolean } {
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const dingtalk = cfg.channels?.dingtalk as DingTalkChannelConfig | undefined;

  if (id === DEFAULT_ACCOUNT_ID) {
    const config: DingTalkConfig = {
      clientId: dingtalk?.clientId ?? '',
      clientSecret: dingtalk?.clientSecret ?? '',
      robotCode: dingtalk?.robotCode,
      corpId: dingtalk?.corpId,
      agentId: dingtalk?.agentId,
      dmPolicy: dingtalk?.dmPolicy,
      groupPolicy: dingtalk?.groupPolicy,
      allowFrom: dingtalk?.allowFrom,
      messageType: dingtalk?.messageType,
      cardTemplateId: dingtalk?.cardTemplateId,
      cardTemplateKey: dingtalk?.cardTemplateKey,
      // ... 其他字段
    };
    return {
      ...config,
      configured: Boolean(config.clientId && config.clientSecret),
    };
  }

  const accountConfig = dingtalk?.accounts?.[id];
  if (accountConfig) {
    return {
      ...accountConfig,
      configured: Boolean(accountConfig.clientId && accountConfig.clientSecret),
    };
  }

  return {
    clientId: '',
    clientSecret: '',
    configured: false,
  };
}
```

### 3. src/channel.ts 修改

```typescript
import { dingtalkOnboardingAdapter } from "./onboarding.js";

export const dingtalkPlugin: DingTalkChannelPlugin = {
  id: 'dingtalk',
  meta: { ... },
  capabilities: { ... },

  // 添加 onboarding 属性
  onboarding: dingtalkOnboardingAdapter,

  config: { ... },
  // ... 其他属性保持不变
};
```

## 交互详情

### 必填字段验证

- `clientId`: 非空验证
- `clientSecret`: 非空验证

### 可选字段

| 字段            | 类型     | 触发条件                                |
| --------------- | -------- | --------------------------------------- |
| robotCode       | string   | 用户选择配置完整凭证                    |
| corpId          | string   | 用户选择配置完整凭证                    |
| agentId         | string   | 用户选择配置完整凭证                    |
| cardTemplateId  | string   | 用户选择启用 AI 卡片                    |
| cardTemplateKey | string   | 用户选择启用 AI 卡片（默认 msgContent） |
| dmPolicy        | enum     | 始终询问                                |
| allowFrom       | string[] | dmPolicy = allowlist 时                 |
| groupPolicy     | enum     | 始终询问                                |

## 测试计划

1. **单元测试**
   - `listDingTalkAccountIds` 返回正确账户列表
   - `resolveDingTalkAccount` 正确解析默认账户和命名账户
   - `isConfigured` 正确判断配置状态

2. **集成测试**
   - 首次配置流程完整走通
   - 修改现有配置
   - 多账户配置

## 风险与缓解

| 风险                  | 影响 | 缓解措施                 |
| --------------------- | ---- | ------------------------ |
| nexa SDK API 变更 | 中   | 使用类型导入，编译时报错 |
| 配置格式不兼容        | 高   | 参考 tlon 实现确保一致性 |

## 参考

- tlon onboarding: https://github.com/nexa/nexa/blob/main/extensions/tlon/src/onboarding.ts
- nexa SDK types: https://github.com/nexa/nexa/blob/main/src/plugins/types.ts
- ChannelPlugin interface: https://github.com/nexa/nexa/blob/main/src/channels/plugins/types.plugin.ts
