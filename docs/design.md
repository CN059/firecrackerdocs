# Firecracker 架构设计

## 适用范围

### 什么是 Firecracker

Firecracker 是一项新型虚拟化技术，支持用户部署轻量级 _微_ 虚拟机（microVM）。该技术融合了传统虚拟机的安全隔离特性与容器技术带来的高速运行、灵活部署及资源高效利用优势，为多租户服务提供安全可靠的环境，同时保持极低的系统开销。

本文档旨在描述 Firecracker 虚拟机管理器（VMM）的功能与架构。

### 功能

1. Firecracker 可在同一台机器上安全运行来自不同客户的工作负载。
1. 客户可根据应用需求，自由组合 vCPU（最多 32 个）和内存创建微虚拟机。
1. Firecracker 微虚拟机支持超额分配主机 CPU 和内存资源。超额分配程度由客户自主控制，可结合工作负载相关性与负载进行调整，确保主机系统平稳运行。
1. 配置最小化 Linux 内核、单核 CPU 及 128 MiB 内存的微虚拟机时，Firecracker 支持 1 秒内单个主机核心稳定创建 5 个微虚拟机（例如：36 物理核心的主机可每秒创建 180 个微虚拟机）。
1. 主机上同时运行的 Firecracker 微虚拟机数量仅受硬件资源可用性限制。
1. 每个微虚拟机通过进程内 HTTP 服务器暴露面向主机的 API。
1. 每个微虚拟机通过`/mmds` API 提供面向客户机的访问通道，用于获取主机配置的元数据。

### 规格说明

Firecracker 的技术规格详见[规格说明文档](SPECIFICATION.md)。

## 主机集成

下图展示了一个运行 Firecracker 微虚拟机的主机示例。

![Firecracker主机集成](images/firecracker_host_integration.png?raw=true "Firecracker Host Integration")

Firecracker 运行于 Linux 主机，并支持 Linux 客户操作系统，guest OSs（下文统称客户系统）。当前支持的完整内核版本列表请参阅[内核支持政策](kernel-policy.md)。

在生产环境中，Firecracker 仅应通过 `jailer` 二进制程序启动。详情请参阅[沙箱化](#沙箱隔离)。

启动进程后，用户需通过 Firecracker API 配置微虚拟机，随后执行 `InstanceStart` 命令。

### 主机网络集成

Firecracker 模拟的网络设备由主机上的 TAP 设备提供支持。为充分利用 Firecracker 功能，我们建议用户采用基于主机的网络解决方案。

### 存储

Firecracker 模拟的块设备由主机上的文件支持。为能在客户机中挂载块设备，这些支持文件需预先格式化为客户机内核支持的文件系统。

## 内部架构

每个 Firecracker 进程封装且仅封装一个微虚拟机。该进程运行以下线程：API、VMM 和 vCPU(s)。API 线程负责 Firecracker 的 API 服务器及相关控制平面，其运行路径永远不在虚拟机的快速路径中。VMM 线程提供 machine model、精简的 legacy device model、微虚拟机元数据服务（MMDS）以及 VirtIO 设备仿真网络、块存储和 Vsock 设备，并支持完整的 I/O 速率限制。此外还存在一个或多个 vCPU 线程（每个客户机 CPU 核心对应一个）。这些线程通过 KVM 创建，运行`KVM_RUN`主循环，并在 devices models 上执行同步 I/O 和内存映射 I/O 操作。

### 威胁隔离

从安全角度出发，所有 vCPU 线程在启动瞬间即被视为运行恶意代码；这些恶意线程必须受到隔离。隔离机制通过嵌套多个信任区域实现，这些区域按信任度递增排列——从最低信任度（客户机 vCPU 线程）到最高信任度（主机）。各受信区域间设置了隔离屏障，用于强制执行 Firecracker 的安全策略。例如，所有外发网络流量数据
均由 Firecracker I/O 线程从模拟网络接口
复制至后端主机 TAP 设备，此时会实施 I/O 速率限制。
下图标注了这些隔离屏障的位置。

![Firecracker威胁隔离机制](images/firecracker_threat_containment.png?raw=true "Firecracker 威胁隔离机制")

## 组件与特性

### Machine Model

#### 布局

Firecracker 通过模拟的 VirtIO 网络设备和 VirtIO 块设备为客户机提供存储和网络访问。它还暴露了串行控制台和部分键盘控制器，后者用于客户机重置虚拟机（软重置或硬重置）。在 Firecracker 中，I8042 设备的作用是向微虚拟机发出信号，表明客户机已请求重启。

除 Firecracker 提供的设备模型外，客户机还能识别 KVM 支持的可编程中断控制器（PIC）、I/O 高级可编程中断控制器（IOAPIC）以及可编程间隔计时器（PIT）。

#### 向客户机暴露 CPU 信息

Firecracker 允许通过[CPU 模板](cpu_templates/cpu-templates.md)控制向客户机暴露的处理器信息。CPU 模板可通过 Firecracker API 设置，用户既可选择现有静态 CPU 模板，也可创建自定义 CPU 模板。

#### 提供给客户机的时钟源

Firecracker 仅向客户机暴露 kvm-clock 时钟源。

### I/O：存储、网络与速率限制

Firecracker 提供 VirtIO/block 和 VirtIO/net 模拟设备，并为每个卷和网络接口应用速率限制器，确保多台微虚拟机公平使用主机硬件资源。这些限制器基于双桶的令牌桶算法实现： 其中一个桶关联每秒操作次数，另一个则关联带宽。为入站（ingress）和出站（egress）指定令牌桶配置，客户可以通过 API 创建和配置速率限制器。每个令牌桶通过桶容量、I/O 成本、补充速率、最大突发量及初始值进行定义。这使客户能够灵活配置支持突发模式或特定 带宽/操作 限制的速率限制器。对于 vhost-user 设备，客户需在其提供的 vhost-user 后端侧实现速率限制功能。

### 微虚拟机元数据服务

Firecracker 微虚拟机通过 API 端点向客户机提供对精简版微虚拟机元数据服务（MMDS）的访问权限。该服务存储的元数据完全由用户配置。

### 沙箱隔离

#### **Firecracker 进程机制**

Firecracker 采用多层隔离机制确保安全防护。
第一层隔离由 Linux KVM 与 Firecracker 虚拟化边界共同实现。
为达成深度防御目标，Firecracker 仅应在进程层级运行受限程序。具体实现方式为：通过 seccomp 过滤器禁止非必要系统调用，利用 cgroups 和命名空间实现资源隔离，并通过进程监狱(jailing)机制削减特权。seccomp 过滤器由 Firecracker 自动安装，而对于后两项隔离机制，我们建议使用随每个 Firecracker 版本发布的 `jailer` 二进制文件启动 Firecracker。

##### Seccomp

Seccomp 过滤器默认用于限制 Firecracker 可调用的主机系统调用。默认的过滤器仅允许 Firecracker 正常运行所必需的最少系统调用及其参数。

这些过滤器会在执行任何客户机代码前，以线程为单位加载到 Firecracker 进程中。

更多信息请参阅[seccomp 文档](seccomp.md)。

#### **监狱管理进程**

Firecracker 进程可由另一个`监狱管理`进程启动。监狱管理进程会配置需要提升权限的系统资源（如 cgroup、chroot），降级自身权限，然后通过 exec()调用进入 Firecracker 二进制文件，使其作为无特权进程运行。在此之后，Firecracker 只能访问由具有特权的第三方授予访问权限的资源（例如，通过将文件复制到 chroot 环境中，或传递文件描述符）。

##### 控制组（Cgroups）与 配额（Quotas）

Each Firecracker microVM can be further encapsulated into a cgroup. By setting
the affinity of the Firecracker microVM to a node via the cpuset subsystem, one
can prevent the migration of said microVM from one node to another, something
that would impair performance and cause unnecessary contention on shared
resources. In addition to setting the affinity, each Firecracker microVM can
have its own dedicated quota of the CPU time via the cpu subsystem, thus
guaranteeing that resources are fairly shared across Firecracker microVMs.

### 监控

Firecracker 会输出日志和指标计数器，各自通过一个经由 API 传入的命名管道进行传输。日志按行逐行刷新，而指标在实例启动时输出，运行期间每 60 秒输出一次，并在发生恐慌时输出。
Firecracker 客户需自行负责收集 Firecracker 日志文件中的数据。在生产环境中，Firecracker 不会暴露串行控制台端口，因其可能包含主机不应访问的客户机数据。
