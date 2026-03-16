import type { NexaPluginApi } from 'nexa/plugin-sdk';
import { emptyPluginConfigSchema } from 'nexa/plugin-sdk';
import { dingtalkPlugin } from './src/channel';
import { setDingTalkRuntime } from './src/runtime';

const plugin = {
  id: 'dingtalk',
  name: 'DingTalk Channel',
  description: 'DingTalk (钉钉) messaging channel via Stream mode',
  configSchema: emptyPluginConfigSchema(),
  register(api: NexaPluginApi): void {
    setDingTalkRuntime(api.runtime);
    api.registerChannel({ plugin: dingtalkPlugin });
  },
};

export default plugin;
