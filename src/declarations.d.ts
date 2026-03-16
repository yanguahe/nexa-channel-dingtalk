declare module 'nexa/plugin-sdk' {
  export interface NexaPluginApi {
    [key: string]: any;
  }

  export interface NexaConfig {
    [key: string]: any;
  }

  export interface PluginRuntime {
    [key: string]: any;
  }

  export const emptyPluginConfigSchema: any;
  export const buildChannelConfigSchema: any;
}