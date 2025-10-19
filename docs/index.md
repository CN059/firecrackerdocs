---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Firecracker中文文档"
  text: "快速启动，极致安全"
  tagline:
  actions:
    - theme: brand
      text: 开始
      link: /README.md

features:
  - title: 轻量级
    details: 每个虚拟机实例仅需约5MB内存和100MB磁盘空间，启动时间小于125毫秒。
  - title: 高性能
    details: 基于KVM（Kernel-based Virtual Machine），利用硬件辅助虚拟化技术，提供接近裸金属的性能表现。
  - title: 安全性
    details: 严格遵循最小权限原则，确保不同虚拟机之间的完全隔离，防止潜在的安全威胁。
  - title: 多租户支持
    details: 适用于大规模多租户环境，能够有效管理成千上万个虚拟机实例。
  - title: API驱动
    details: 提供了RESTful API接口，方便与其他系统集成或实现自动化操作。
---
