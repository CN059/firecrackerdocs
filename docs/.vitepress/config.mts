import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lastUpdated: true,
  ignoreDeadLinks: true,
  lang: "zh-CN",
  title: "Firecracker中文文档",
  base: "/firecrackerdocs",
  description:
    "Firecracker 是一款开源虚拟化技术，通过轻量级 microVM 提供容器般的速度与虚拟机级别的安全隔离，专为无服务器和多租户环境设计。",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [{ text: "Home", link: "/index" }],

    sidebar: [
      {
        text: "Firecracker初步",
        collapsed: true,
        items: [
          { text: "概述", link: "/README.md" },
          { text: "开发环境搭建", link: "/dev-machine-setup" },
          { text: "开始使用Firecracker", link: "/getting-started" },
          { text: "配置initrd", link: "/initrd" },
          { text: "API 变更操作手册", link: "/api-change-runbook" },
          { text: "ballooning", link: "/ballooning" },
          { text: "设计", link: "/design" },
          { text: "设备 API", link: "/device-api" },
          { text: "熵设备（Entropy Device）", link: "/entropy" },
          { text: "形式验证", link: "/formal-verification" },
          { text: "gdb调试", link: "/gdb-debugging" },
          { text: "大内存页", link: "/hugepages" },
          { text: "沙箱（jailer）", link: "/jailer" },
          { text: "内核策略", link: "/kernel-policy" },
          { text: "looger", link: "/logger" },
          { text: "metrics", link: "/metrics" },
          { text: "网络性能", link: "/network-performance" },
          { text: "网络设置", link: "/network-setup" },
          { text: "持久内存", link: "/pmem" },
          { text: "生产环境主机部署", link: "/prod-host-setup" },
          { text: "PVH启动", link: "/pvh" },
          { text: "rootfs和内核设置", link: "/rootfs-and-kernel-setup" },
          { text: "seccomp", link: "/seccomp" },
          { text: "seccompiler", link: "/seccompiler" },
          { text: "tracing", link: "/tracing" },
          { text: "vsock", link: "/vsock" },
        ],
      },
      {
        text: "API请求",
        collapsed: true,
        items: [
          { text: "actions", link: "/api_requests/actions" },
          { text: "块缓存", link: "/api_requests/block-caching" },
          { text: "块设备 I/O 引擎", link: "/api_requests/block-io-engine" },
          { text: "Vhost-user 块设备", link: "/api_requests/block-vhost-user" },
          { text: "patch-block", link: "/api_requests/patch-block" },
          {
            text: "patch-network-interface",
            link: "/api_requests/patch-network-interface",
          },
        ],
      },
      {
        text: "CPU模板",
        collapsed: true,
        items: [
          { text: "启动协议", link: "/cpu_templates/boot-protocol" },
          {
            text: "CPU模板helper",
            link: "/cpu_templates/cpu-template-helper",
          },
          { text: "CPU模板", link: "/cpu_templates/cpu-templates" },
          { text: "CPUID 规范化", link: "/cpu_templates/cpuid-normalization" },
        ],
      },
      {
        text: "mmds",
        collapsed: true,
        items: [
          { text: "mmds设计", link: "/mmds/mmds-design" },
          { text: "mmds用户指南", link: "/mmds/mmds-user-guide" },
        ],
      },
      {
        text: "快照",
        collapsed: true,
        items: [
          {
            text: "快照恢复时处理页面错误",
            link: "/snapshotting/handling-page-faults-on-snapshot-resume",
          },
          { text: "克隆网络", link: "/snapshotting/network-for-clones" },
          { text: "随机克隆", link: "/snapshotting/random-for-clones" },
          { text: "快照编辑器", link: "/snapshotting/snapshot-editor" },
          { text: "快照支持", link: "/snapshotting/snapshot-support" },
          { text: "版本控制", link: "/snapshotting/versioning" },
        ],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/firecracker-microvm/firecracker",
      },
    ],
  },
});
