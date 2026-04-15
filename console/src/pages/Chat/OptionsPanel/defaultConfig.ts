import type { TFunction } from "i18next";

const defaultConfig = {
  theme: {
    colorPrimary: "#FF7F16",
    darkMode: false,
    prefix: "copaw",
    leftHeader: {
      logo: "",
      title: "Talora",
    },
  },
  sender: {
    attachments: true,
    maxLength: 10000,
    disclaimer: "给到 HR 的专属猎头 Agent 助手",
  },
  welcome: {
    greeting: "你好，我是Talora。",
    description: "我会帮你处理搜人、读简历、初筛和招聘推进。",
    avatar: `${import.meta.env.BASE_URL}copaw-symbol.svg`,
    prompts: [
      {
        value: "帮我导入一个猎聘企业版职位",
      },
      {
        value: "帮我针对某个职位开始寻访",
      },
      {
        value: "帮我先完善这个职位的 JD 和画像",
      },
    ],
  },
  api: {
    baseURL: "",
    token: "",
  },
} as const;

export function getDefaultConfig(t: TFunction) {
  return {
    ...defaultConfig,
    sender: {
      ...defaultConfig.sender,
      disclaimer: t("chat.disclaimer"),
    },
    welcome: {
      ...defaultConfig.welcome,
      greeting: t("chat.greeting"),
      description: t("chat.description"),
      prompts: [
        { value: t("chat.prompt1") },
        { value: t("chat.prompt2") },
        { value: t("chat.prompt3") },
      ],
    },
  };
}

export default defaultConfig;

export type DefaultConfig = typeof defaultConfig;
