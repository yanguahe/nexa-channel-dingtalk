/**
 * Type definitions for DingTalk Channel Plugin
 *
 * Provides comprehensive type safety for:
 * - Configuration objects
 * - DingTalk API request/response models
 * - Message content and formats
 * - Media files and streams
 * - Session and token management
 */

import type { NexaConfig } from 'nexa/plugin-sdk';

/**
 * DingTalk channel configuration (extends base nexa config)
 */
export interface DingTalkConfig extends NexaConfig {
  clientId: string;
  clientSecret: string;
  robotCode?: string;
  corpId?: string;
  agentId?: string;
  name?: string;
  enabled?: boolean;
  dmPolicy?: 'open' | 'pairing' | 'allowlist';
  groupPolicy?: 'open' | 'allowlist';
  allowFrom?: string[];
  showThinking?: boolean;
  debug?: boolean;
  messageType?: 'markdown' | 'card';
  cardTemplateId?: string;
  cardTemplateKey?: string;
  groups?: Record<string, { systemPrompt?: string }>;
  accounts?: Record<string, DingTalkConfig>;
  // Connection robustness configuration
  maxConnectionAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectJitter?: number;
}

/**
 * Multi-account DingTalk configuration wrapper
 */
export interface DingTalkChannelConfig {
  enabled?: boolean;
  clientId: string;
  clientSecret: string;
  robotCode?: string;
  corpId?: string;
  agentId?: string;
  name?: string;
  dmPolicy?: 'open' | 'pairing' | 'allowlist';
  groupPolicy?: 'open' | 'allowlist';
  allowFrom?: string[];
  showThinking?: boolean;
  debug?: boolean;
  messageType?: 'markdown' | 'card';
  cardTemplateId?: string;
  cardTemplateKey?: string;
  groups?: Record<string, { systemPrompt?: string }>;
  accounts?: Record<string, DingTalkConfig>;
  maxConnectionAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectJitter?: number;
}

/**
 * DingTalk token info for caching
 */
export interface TokenInfo {
  accessToken: string;
  expireIn: number;
}

/**
 * DingTalk API token response
 */
export interface TokenResponse {
  accessToken: string;
  expireIn: number;
}

/**
 * DingTalk API generic response wrapper
 */
export interface DingTalkApiResponse<T = unknown> {
  data?: T;
  code?: string;
  message?: string;
  success?: boolean;
}

/**
 * Media download response from DingTalk API
 */
export interface MediaDownloadResponse {
  downloadUrl?: string;
  downloadCode?: string;
}

/**
 * Media file metadata
 */
export interface MediaFile {
  path: string;
  mimeType: string;
}

/**
 * DingTalk incoming message (Stream mode)
 */
export interface DingTalkInboundMessage {
  msgId: string;
  msgtype: string;
  createAt: number;
  text?: {
    content: string;
  };
  content?: {
    downloadCode?: string;
    fileName?: string;
    recognition?: string;
    richText?: Array<{
      type: string;
      text?: string;
      atName?: string;
      downloadCode?: string; // For picture type in richText
    }>;
  };
  conversationType: string;
  conversationId: string;
  conversationTitle?: string;
  senderId: string;
  senderStaffId?: string;
  senderNick?: string;
  chatbotUserId: string;
  sessionWebhook: string;
}

/**
 * Extracted message content for unified processing
 */
export interface MessageContent {
  text: string;
  mediaPath?: string;
  mediaType?: string;
  messageType: string;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  title?: string;
  useMarkdown?: boolean;
  atUserId?: string | null;
  log?: any;
  mediaPath?: string;
  filePath?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'voice' | 'video' | 'file';
}

/**
 * Session webhook response
 */
export interface SessionWebhookResponse {
  msgtype: string;
  markdown?: {
    title: string;
    text: string;
  };
  text?: {
    content: string;
  };
  at?: {
    atUserIds: string[];
    isAtAll: boolean;
  };
}

/**
 * Message handler parameters
 */
export interface HandleDingTalkMessageParams {
  cfg: NexaConfig;
  accountId: string;
  data: DingTalkInboundMessage;
  sessionWebhook: string;
  log?: any;
  dingtalkConfig: DingTalkConfig;
}

/**
 * Proactive message payload
 */
export interface ProactiveMessagePayload {
  robotCode: string;
  msgKey: string;
  msgParam: string;
  openConversationId?: string;
  userIds?: string[];
}

/**
 * Account descriptor
 */
export interface AccountDescriptor {
  accountId: string;
  config?: DingTalkConfig;
  enabled?: boolean;
  name?: string;
  configured?: boolean;
}

/**
 * Account resolver result
 */
export interface ResolvedAccount {
  accountId: string;
  config: DingTalkConfig;
  enabled: boolean;
}

/**
 * HTTP request config for axios
 */
export interface AxiosRequestConfig {
  url?: string;
  method?: string;
  data?: any;
  headers?: Record<string, string>;
  responseType?: 'arraybuffer' | 'json' | 'text';
}

/**
 * HTTP response from axios
 */
export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * DingTalk Stream callback listener types
 */
export interface StreamCallbackResponse {
  headers?: {
    messageId?: string;
  };
  data: string;
}

/**
 * Reply dispatcher context
 */
export interface ReplyDispatchContext {
  responsePrefix?: string;
  deliver: (payload: any) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Reply dispatcher result
 */
export interface ReplyDispatcherResult {
  dispatcher: any;
  replyOptions: any;
  markDispatchIdle: () => void;
}

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  log?: any;
}

/**
 * Channel log sink
 * Matches nexa SDK's ChannelLogSink type
 */
export interface ChannelLogSink {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug?: (msg: string) => void;
}

/**
 * @deprecated Use ChannelLogSink instead
 */
export type Logger = ChannelLogSink;

/**
 * Channel account snapshot
 * Matches nexa SDK's ChannelAccountSnapshot type
 */
export interface ChannelAccountSnapshot {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  reconnectAttempts?: number;
  lastConnectedAt?: number | null;
  lastDisconnect?:
    | string
    | {
        at: number;
        status?: number;
        error?: string;
        loggedOut?: boolean;
      }
    | null;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
  lastError?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  mode?: string;
  dmPolicy?: string;
  allowFrom?: string[];
  tokenSource?: string;
  botTokenSource?: string;
  appTokenSource?: string;
  credentialSource?: string;
  secretSource?: string;
  audienceType?: string;
  audience?: string;
  webhookPath?: string;
  webhookUrl?: string;
  baseUrl?: string;
  allowUnmentionedGroups?: boolean;
  cliPath?: string | null;
  dbPath?: string | null;
  port?: number | null;
  probe?: unknown;
  lastProbeAt?: number | null;
  audit?: unknown;
  application?: unknown;
  bot?: unknown;
  publicKey?: string | null;
  profile?: unknown;
  channelAccessToken?: string;
  channelSecret?: string;
}

/**
 * @deprecated Use ChannelAccountSnapshot instead
 */
export type ChannelSnapshot = ChannelAccountSnapshot;

/**
 * Plugin gateway start context
 * Matches nexa SDK's ChannelGatewayContext type
 */
export interface GatewayStartContext {
  cfg: NexaConfig;
  accountId: string;
  account: ResolvedAccount;
  runtime: unknown;
  abortSignal: AbortSignal;
  log?: ChannelLogSink;
  getStatus: () => ChannelAccountSnapshot;
  setStatus: (next: ChannelAccountSnapshot) => void;
}

/**
 * Plugin gateway account stop result
 */
export interface GatewayStopResult {
  stop: () => void;
}

/**
 * DingTalk channel plugin definition
 * Matches nexa SDK's ChannelPlugin type structure
 */
export interface DingTalkChannelPlugin {
  id: 'dingtalk';
  meta: {
    id: 'dingtalk';
    label: string;
    selectionLabel: string;
    docsPath: string;
    docsLabel?: string;
    blurb: string;
    aliases: string[];
    order?: number;
  };
  capabilities: {
    chatTypes: ('direct' | 'group')[];
    reactions: boolean;
    threads: boolean;
    media: boolean;
    nativeCommands: boolean;
    blockStreaming: boolean;
    outbound: boolean;
  };
  defaults?: {
    queue?: {
      debounceMs?: number;
    };
  };
  reload?: {
    configPrefixes: string[];
    noopPrefixes?: string[];
  };
  onboarding?: {
    channel: string;
    getStatus: (params: { cfg: NexaConfig }) => Promise<{
      channel: string;
      configured: boolean;
      statusLines: string[];
      selectionHint: string;
      quickstartScore: number;
    }>;
    configure: (params: {
      cfg: NexaConfig;
      prompter: unknown;
      accountOverrides: Record<string, string>;
      shouldPromptAccountIds: boolean;
    }) => Promise<{ cfg: NexaConfig; accountId: string }>;
  };
  config: {
    listAccountIds: (cfg: NexaConfig) => string[];
    resolveAccount: (cfg: NexaConfig, accountId?: string | null) => ResolvedAccount & { configured: boolean };
    defaultAccountId: (cfg?: NexaConfig) => string;
    setAccountEnabled?: (params: { cfg: NexaConfig; accountId: string; enabled: boolean }) => NexaConfig;
    deleteAccount?: (params: { cfg: NexaConfig; accountId: string }) => NexaConfig;
    isConfigured: (account: ResolvedAccount, cfg?: NexaConfig) => boolean;
    describeAccount: (account: ResolvedAccount, cfg?: NexaConfig) => AccountDescriptor;
  };
  configSchema?: {
    schema: Record<string, unknown>;
    uiHints?: Record<
      string,
      { label?: string; help?: string; advanced?: boolean; sensitive?: boolean; placeholder?: string }
    >;
  };
  security: {
    resolveDmPolicy: (ctx: { account: ResolvedAccount; cfg: NexaConfig }) => {
      policy: 'open' | 'pairing' | 'allowlist';
      allowFrom: string[];
      policyPath: string;
      allowFromPath: string;
      approveHint: string;
      normalizeEntry: (raw: string) => string;
    } | null;
    collectWarnings?: (ctx: { account: ResolvedAccount; cfg: NexaConfig }) => string[] | Promise<string[]>;
  };
  groups: {
    resolveRequireMention: (ctx: { cfg: NexaConfig; groupChannel?: string; groupId?: string }) => boolean;
    resolveGroupIntroHint?: (ctx: { groupId?: string; groupChannel?: string }) => string | undefined;
  };
  messaging: {
    normalizeTarget: (params: { target?: string }) => { targetId: string } | null;
    targetResolver: {
      looksLikeId: (id: string) => boolean;
      hint: string;
    };
  };
  outbound: {
    deliveryMode: 'direct' | 'gateway' | 'hybrid';
    resolveTarget?: (params: {
      cfg?: NexaConfig;
      to?: string;
      allowFrom?: string[];
      accountId?: string | null;
      mode?: string;
    }) => { ok: true; to: string } | { ok: false; error: Error };
    sendText: (ctx: {
      cfg: NexaConfig;
      to: string;
      text: string;
      replyToId?: string | null;
      threadId?: string | number | null;
      accountId?: string | null;
    }) => Promise<{ ok: boolean; messageId?: string; data?: unknown; error?: string | Error }>;
    sendMedia?: (ctx: {
      cfg: NexaConfig;
      to: string;
      text?: string;
      mediaUrl?: string;
      mediaPath?: string;
      mediaType?: 'image' | 'voice' | 'video' | 'file';
      accountId?: string | null;
    }) => Promise<{ ok: boolean; messageId?: string; data?: unknown; error?: string | Error }>;
  };
  status: {
    defaultRuntime?: ChannelSnapshot & { accountId: string };
    collectStatusIssues?: (accounts: (ChannelSnapshot & { configured: boolean; accountId: string })[]) => Array<{
      channel: string;
      accountId: string;
      kind: 'config' | 'runtime' | 'auth';
      message: string;
    }>;
    buildChannelSummary?: (params: {
      account: ResolvedAccount;
      cfg: NexaConfig;
      defaultAccountId: string;
      snapshot: ChannelSnapshot;
    }) => Record<string, unknown>;
    probeAccount?: (params: {
      account: ResolvedAccount & { configured: boolean };
      timeoutMs: number;
      cfg: NexaConfig;
    }) => Promise<{ ok: boolean; error?: string; details?: unknown }>;
    buildAccountSnapshot: (params: {
      account: ResolvedAccount & { configured: boolean };
      cfg: NexaConfig;
      runtime?: ChannelSnapshot;
      snapshot?: ChannelSnapshot;
      probe?: { ok: boolean; error?: string; details?: unknown };
    }) => ChannelSnapshot & {
      accountId: string;
      name?: string;
      enabled: boolean;
      configured: boolean;
      clientId?: string | null;
      probe?: { ok: boolean; error?: string; details?: unknown };
    };
  };
  gateway: {
    startAccount: (ctx: GatewayStartContext) => Promise<GatewayStopResult>;
  };
}

/**
 * Result of target resolution validation
 */
export interface TargetResolutionResult {
  ok: boolean;
  to?: string;
  error?: Error;
}

/**
 * Parameters for resolveTarget validation
 */
export interface ResolveTargetParams {
  to?: string | null;
  [key: string]: any;
}

/**
 * Parameters for sendText delivery
 */
export interface SendTextParams {
  cfg: DingTalkConfig;
  to: string;
  text: string;
  accountId?: string;
  [key: string]: any;
}

/**
 * Parameters for sendMedia delivery
 */
export interface SendMediaParams {
  cfg: DingTalkConfig;
  to: string;
  mediaPath: string;
  accountId?: string;
  [key: string]: any;
}

/**
 * DingTalk outbound handler configuration
 */
export interface DingTalkOutboundHandler {
  deliveryMode: 'direct' | 'queued' | 'batch';
  resolveTarget: (params: ResolveTargetParams) => TargetResolutionResult;
  sendText: (params: SendTextParams) => Promise<{ ok: boolean; data?: any; error?: any }>;
  sendMedia?: (params: SendMediaParams) => Promise<{ ok: boolean; data?: any; error?: any }>;
}

/**
 * AI Card status constants
 */
export const AICardStatus = {
  PROCESSING: '1',
  INPUTING: '2',
  FINISHED: '3',
  FAILED: '5',
} as const;

/**
 * AI Card state type
 */
export type AICardState = (typeof AICardStatus)[keyof typeof AICardStatus];

/**
 * AI Card instance
 */
export interface AICardInstance {
  cardInstanceId: string;
  accessToken: string;
  conversationId: string;
  createdAt: number;
  lastUpdated: number;
  state: AICardState; // Current card state: PROCESSING, INPUTING, FINISHED, FAILED
  config?: DingTalkConfig; // Store config reference for token refresh
}

/**
 * AI Card streaming update request (new API)
 */
export interface AICardStreamingRequest {
  outTrackId: string;
  guid: string;
  key: string;
  content: string;
  isFull: boolean;
  isFinalize: boolean;
  isError: boolean;
}

/**
 * Connection state enum for lifecycle management
 */
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  FAILED = 'FAILED',
}

/**
 * Connection manager configuration
 */
export interface ConnectionManagerConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  jitter: number;
  /** Callback invoked when connection state changes */
  onStateChange?: (state: ConnectionState, error?: string) => void;
}

/**
 * Connection attempt result
 */
export interface ConnectionAttemptResult {
  success: boolean;
  attempt: number;
  error?: Error;
  nextDelay?: number;
}

// ============ Onboarding Helper Functions ============

const DEFAULT_ACCOUNT_ID = 'default';

/**
 * List all DingTalk account IDs from config
 */
export function listDingTalkAccountIds(cfg: NexaConfig): string[] {
  const dingtalk = cfg.channels?.dingtalk as DingTalkChannelConfig | undefined;
  if (!dingtalk) return [];

  const accountIds: string[] = [];

  // Check for direct configuration (default account)
  if (dingtalk.clientId || dingtalk.clientSecret) {
    accountIds.push(DEFAULT_ACCOUNT_ID);
  }

  // Check accounts object
  if (dingtalk.accounts) {
    accountIds.push(...Object.keys(dingtalk.accounts));
  }

  return accountIds;
}

/**
 * Resolved DingTalk account with configuration status
 */
export interface ResolvedDingTalkAccount extends DingTalkConfig {
  accountId: string;
  configured: boolean;
}

/**
 * Resolve a specific DingTalk account configuration
 */
export function resolveDingTalkAccount(cfg: NexaConfig, accountId?: string | null): ResolvedDingTalkAccount {
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const dingtalk = cfg.channels?.dingtalk as DingTalkChannelConfig | undefined;

  // If default account, return top-level config
  if (id === DEFAULT_ACCOUNT_ID) {
    const config: DingTalkConfig = {
      clientId: dingtalk?.clientId ?? '',
      clientSecret: dingtalk?.clientSecret ?? '',
      robotCode: dingtalk?.robotCode,
      corpId: dingtalk?.corpId,
      agentId: dingtalk?.agentId,
      name: dingtalk?.name,
      enabled: dingtalk?.enabled,
      dmPolicy: dingtalk?.dmPolicy,
      groupPolicy: dingtalk?.groupPolicy,
      allowFrom: dingtalk?.allowFrom,
      showThinking: dingtalk?.showThinking,
      debug: dingtalk?.debug,
      messageType: dingtalk?.messageType,
      cardTemplateId: dingtalk?.cardTemplateId,
      cardTemplateKey: dingtalk?.cardTemplateKey,
      groups: dingtalk?.groups,
      accounts: dingtalk?.accounts,
      maxConnectionAttempts: dingtalk?.maxConnectionAttempts,
      initialReconnectDelay: dingtalk?.initialReconnectDelay,
      maxReconnectDelay: dingtalk?.maxReconnectDelay,
      reconnectJitter: dingtalk?.reconnectJitter,
    };
    return {
      ...config,
      accountId: id,
      configured: Boolean(config.clientId && config.clientSecret),
    };
  }

  // If named account, get from accounts object
  const accountConfig = dingtalk?.accounts?.[id];
  if (accountConfig) {
    return {
      ...accountConfig,
      accountId: id,
      configured: Boolean(accountConfig.clientId && accountConfig.clientSecret),
    };
  }

  // Account doesn't exist, return empty config
  return {
    clientId: '',
    clientSecret: '',
    accountId: id,
    configured: false,
  };
}
