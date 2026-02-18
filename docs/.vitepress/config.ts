import { defineConfig } from "vitepress";

export default defineConfig({
  base: "/Yggdrasil/",
  title: "Yggdrasil",
  description: "Give your AI agent structural understanding of your system",
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "CLI Reference", link: "/cli-reference" },
      { text: "Idea", link: "/idea/foundation" },
      { text: "GitHub", link: "https://github.com/krzysztofdudek/Yggdrasil" },
    ],
    sidebar: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/getting-started" },
      { text: "Supported Platforms", link: "/platforms" },
      { text: "CLI Reference", link: "/cli-reference" },
      { text: "Configuration", link: "/configuration" },
      {
        text: "Idea",
        collapsed: true,
        items: [
          { text: "Foundation", link: "/idea/foundation" },
          { text: "Graph", link: "/idea/graph" },
          { text: "Engine", link: "/idea/engine" },
          { text: "Materialization", link: "/idea/materialization" },
          { text: "Integration", link: "/idea/integration" },
          { text: "Tools", link: "/idea/tools" },
        ],
      },
    ],
  },
});
