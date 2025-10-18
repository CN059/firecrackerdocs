<picture>
   <source media="(prefers-color-scheme: dark)" srcset="images/fc_logo_full_transparent-bg_white-fg.png">
   <source media="(prefers-color-scheme: light)" srcset="images/fc_logo_full_transparent-bg.png">
   <img alt="Firecracker Logo Title" width="750" src="images/fc_logo_full_transparent-bg.png">
</picture>

我们的使命是实现安全、多租户、低开销的容器和函数工作负载执行。

[阅读关于 Firecracker 章程的更多内容](CHARTER.md).

## 什么是 Firecracker？

Firecracker 是一款开源虚拟化技术，专为创建和管理安全的多租户容器及基于函数的服务而设计，这些服务提供无服务器运维模式。Firecracker 在轻量级虚拟机（称为微虚拟机，microVMs）中运行工作负载，该技术融合了硬件虚拟化技术提供的安全隔离特性与容器的运行速度及灵活性。

## 概述

Firecracker 的核心组件是虚拟机监控器（VMM），它利用 Linux 内核虚拟机（KVM）创建并运行微虚拟机。该方案采用极简设计理念，剔除冗余设备及面向客户机的功能，从而降低每个微虚拟机的内存占用和攻击面。此设计提升了安全性，缩短了启动时间，并提高了硬件利用率。Firecracker 还已集成于容器运行时环境，例如
[Kata Containers](https://github.com/kata-containers/kata-containers) 和
[Flintlock](https://github.com/liquidmetal-dev/flintlock).

Firecracker 由亚马逊网络服务公司开发，旨在提升[AWS Lambda](https://aws.amazon.com/lambda/)和[AWS Fargate](https://aws.amazon.com/fargate/)等服务的速度与效率。该项目已根据[Apache 2.0 许可证](https://www.apache.org/licenses/LICENSE-2.0)开源发布。

要了解更多关于 Firecracker 的信息，请访问
[firecracker-microvm.io](https://firecracker-microvm.github.io)。

## 入门指南

要开始使用 Firecracker，请下载最新
[release](https://github.com/firecracker-microvm/firecracker/releases) 二进制文件
或从源代码编译。

你可以按照如下方式，在任何已安装 Docker（我们使用开发容器）和 `bash` 的 Unix/Linux 系统上构建 Firecracker：

```bash
git clone https://github.com/firecracker-microvm/firecracker
cd firecracker
tools/devtool build
toolchain="$(uname -m)-unknown-linux-musl"
```

Firecracker 二进制文件将位于
`build/cargo_target/${toolchain}/debug/firecracker`。有关构建、测试和运行 Firecracker 的更多信息，请参阅
[快速入门指南](getting-started.md)。

Firecracker 微虚拟机（microVMs）的整体安全性，包括满足安全多租户计算标准的能力，取决于 Linux 主机操作系统的合理配置。我们认为符合此标准的配置方案详见[生产环境主机配置文档](prod-host-setup.md)。

## 贡献

Firecracker 已在 AWS 内部承载生产工作负载，但在遵循我们 [使命](https://github.com/firecracker-microvm/firecracker/blob/main/CHARTER.md) 的征程上，今天仍是第一天。前方仍有大量工作有待完成，我们欢迎所有贡献。

要为 Firecracker 贡献代码，请查阅[入门指南](getting-started.md) 中的开发环境配置部分，然后参阅 Firecracker 的[贡献指南](https://github.com/firecracker-microvm/firecracker/blob/main/CONTRIBUTING.md)。

## 版本发布

新版 Firecracker 通过 GitHub 仓库的
[releases](https://github.com/firecracker-microvm/firecracker/releases)发布，
通常每两到三个月更新一次。变更记录详见我们的
[changelog](https://github.com/firecracker-microvm/firecracker/blob/main/CHANGELOG.md)。

Firecracker 发布政策的详细内容详见[此处](RELEASE_POLICY.md)。

## 设计

Firecracker 的整体架构在[设计文档](design.md)中有所描述。

## 功能与特性

Firecracker 由单个微型虚拟机管理器进程构成，启动后会向主机暴露一个 API 端点。该 API [采用 OpenAPI 格式定义](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。更多详情请参阅 [API 文档](docs/api_requests)。

该**API 接口**可用于：

- 配置微虚拟机：
  - 设置 vCPU 数量（默认值为 1）。
  - 设置内存大小（默认值为 128 MiB）。
  - 配置[CPU 模板](cpu_templates/cpu-templates.md)。
- 为微虚拟机添加一个或多个网络接口。
- 为微虚拟机添加一个或多个读写或只读磁盘，每个磁盘由文件支持的块设备表示。
- 在客户机运行期间触发块设备重新扫描。这使得客户机操作系统能够识别块设备后端文件的大小变更。
- 在客户机系统启动前后更改块设备的后端文件。
- 为 virtio 设备配置速率限制器，可限制带宽、每秒操作次数或两者兼有。
- 配置日志记录和指标系统。
- `[BETA]` 配置面向宾客系统的元数据服务数据树。仅当配置此资源时，该服务才对客户机系统可用。
- 为微虚拟机添加[vsock 套接字](vsock.md)。
- 为微虚拟机添加[熵设备](entropy.md)。
- 使用指定内核映像、根文件系统和启动参数启动微虚拟机。
- [仅限 x86_64] 停止微虚拟机。

**内置功能**：

- 默认启用需求故障分页和 CPU 超额分配。
- 采用高级线程专用 seccomp 过滤器以增强安全性。
- [Jailer](jailer.md)进程用于在生产环境中启动 Firecracker；
  该进程先应用 cgroup/namespace 隔离屏障，随后降级权限。

## 测试平台

我们测试了所有组合：

| 实例                                   | 主机操作系统与内核 | 客户机根文件系统 | 客户机内核 |
| :------------------------------------- | :----------------- | :--------------- | :--------- |
| m5n.metal (Intel Cascade Lake)         | al2 linux_5.10     | ubuntu 24.04     | linux_5.10 |
| m6i.metal (Intel Ice Lake)             | al2023 linux_6.1   |                  | linux_6.1  |
| m7i.metal-24xl (Intel Sapphire Rapids) |                    |                  |            |
| m7i.metal-48xl (Intel Sapphire Rapids) |                    |                  |            |
| m6a.metal (AMD Milan)                  |                    |                  |            |
| m7a.metal-48xl (AMD Genoa)             |                    |                  |            |
| m6g.metal (Graviton 2)                 |                    |                  |            |
| m7g.metal (Graviton 3)                 |                    |                  |            |
| m8g.metal-24xl (Graviton 4)            |                    |                  |            |
| m8g.metal-48xl (Graviton 4)            |                    |                  |            |

## 已知问题与限制

- aarch64 架构上的 `pl031` RTC 设备不支持中断功能，因此使用 RTC 闹钟的客户程序（如 `hwclock`）将无法正常工作。

## 性能

Firecracker's 的性能特征已收录于[规格文档](https://github.com/firecracker-microvm/firecracker/blob/main/SPECIFICATION.md)中。所有规格均体现了我们对支持无服务器运维模式下容器与函数工作负载的承诺，因此通过持续集成测试进行强制执行。

## 安全披露政策

Firecracker 的安全性是我们的首要任务。若您怀疑发现安全漏洞，请按照我们的[安全政策文件](https://github.com/firecracker-microvm/firecracker/blob/main/SECURITY.md)所述方式私下联系我们；我们将立即优先处理您的披露。

## 常见问题与联系方式

常见问题汇总于我们的[FAQ 文档](https://github.com/firecracker-microvm/firecracker/blob/main/FAQ.md)。

您可通过以下方式联系 Firecracker 社区：

- 安全相关问题，请参阅我们的[安全政策文档](https://github.com/firecracker-microvm/firecracker/blob/main/SECURITY.md)。
- 加入我们的
  [Slack 工作区](https://join.slack.com/t/firecracker-microvm/shared_invite/zt-2tc0mfxpc-tU~HYAYSzLDl5XGGJU3YIg)
  _注：多数维护者处于欧洲时区._
- 在本仓库创建 GitHub issue。
- 通过
  [firecracker-maintainers@amazon.com](mailto:firecracker-maintainers@amazon.com)
  联系维护者。

在 Firecracker 社区交流时，请遵守我们的
[行为准则](https://github.com/firecracker-microvm/firecracker/blob/main/CODE_OF_CONDUCT.md)。
