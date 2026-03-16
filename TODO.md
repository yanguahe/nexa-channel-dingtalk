# TODO

> Auto-generated from GitHub Issues (2026-02-14)

## 🐛 Bug Fixes

### Priority: High

- [ ] **[#112](https://github.com/soimy/nexa-channel-dingtalk/issues/112)** - dingtalk plugins 不能正常链接，request failed with status code 400
  - 连接尝试 10 次后失败，返回 400 错误
  - 可能与配置或用户 ID 格式相关
  - Dup: #63

- [ ] **[#95](https://github.com/soimy/nexa-channel-dingtalk/issues/95)** - Accounts Unsupported schema node. Use Raw mode
  - 多帐号配置 UI 显示问题
  - 不影响主帐号使用
  - 临时方案：在 nexa.json 中手动配置多帐号

- [ ] **[#94](https://github.com/soimy/nexa-channel-dingtalk/issues/94)** - channel is not running
  - Gateway 启动后 channel 状态不更新
  - 不影响实际使用，仅状态显示问题

### Priority: Medium

- [ ] **[#63](https://github.com/soimy/nexa-channel-dingtalk/issues/63)** - 主动发送消息返回 400 错误
  - 与 agent 提供的 target 格式相关
  - 需要验证 staffId 格式是否正确
  - 参考: [钉钉 API Explorer](https://open.dingtalk.com/document/api/explore/explorer-page?api=robot_1.0%23BatchSendOTO&devType=org)

### Priority: Low (Resolved)

- [x] **[#106](https://github.com/soimy/nexa-channel-dingtalk/issues/106)** - 几个小时不用就报错连不上钉钉
  - 原因：`dingtalk-stream` SDK 心跳超时 (8秒硬编码)
  - 修复：PR #96 已合并，增加无限重试循环
  - 建议：更新到最新版本

---

## ✨ Feature Requests

### Priority: High

- [ ] **[#86](https://github.com/soimy/nexa-channel-dingtalk/issues/86)** - 支持将图片/媒体消息整合进 AI 流式卡片中
  - 当前：图片/文件作为独立消息发送，视觉上被切断
  - 目标：图片直接嵌入 AI 回复卡片，形成统一图文简报
  - 方案：
    1. 模板升级：支持图片变量占位符
    2. 状态追踪：AICardInstance 增加媒体状态
    3. 逻辑整合：sendMedia 检测活跃卡片并更新
  - 限制：视频无法直接嵌入，只能做超链接

- [ ] **[#67](https://github.com/soimy/nexa-channel-dingtalk/issues/67)** - 机器人群聊中支持 @ 某人
  - 当前：机器人回复不会 @ 群成员
  - 目标：检测文本中的 "@某某人" 并转换为钉钉格式
  - 扩展：支持 @ 机器人实现多机器人对话

### Priority: Medium

- [ ] **[#110](https://github.com/soimy/nexa-channel-dingtalk/issues/110)** - AI Card 模式支持 thinking/tool usage 显示
  - 当前：thinking 和 tool usage 只显示"处理中"
  - 限制：每次更新消耗 API 调用（免费版 5000/月）
  - 方案：需要定制卡片模板
  - 参考: #111

- [ ] **[#111](https://github.com/soimy/nexa-channel-dingtalk/issues/111)** - AI Card 模式支持 usage footer
  - 开启 `/usage full` 后 usage 信息不显示
  - 需要卡片模板支持

- [ ] **[#76](https://github.com/soimy/nexa-channel-dingtalk/issues/76)** - 对话打断功能
  - 当前：AI 处理中无法停止
  - 目标：支持用户中断正在执行的任务
  - 场景：AI 执行错误任务时可以及时停止

- [ ] **[#63](https://github.com/soimy/nexa-channel-dingtalk/issues/63)** - 主动发送消息支持
  - 目标：支持 agent 主动向用户发送消息
  - 相关：定时提醒、cron job 等场景

### Priority: Low

- [ ] **[#101](https://github.com/soimy/nexa-channel-dingtalk/issues/101)** - 钉盘文件访问支持
  - 当前：不支持钉盘/钉钉文档
  - 方案：利用钉钉服务端 API，扩展 downloadMedia/uploadMedia
  - Dup: #107

---

## 📋 Statistics

| Category        | Count  |
| --------------- | ------ |
| Bug (Open)      | 4      |
| Bug (Fixed)     | 1      |
| Feature Request | 7      |
| **Total**       | **12** |

---

## 🔗 Quick Links

- [All Issues](https://github.com/soimy/nexa-channel-dingtalk/issues)
- [Pull Requests](https://github.com/soimy/nexa-channel-dingtalk/pulls)
- [CONNECTION_ROBUSTNESS.md](./CONNECTION_ROBUSTNESS.md) - 连接稳定性说明
