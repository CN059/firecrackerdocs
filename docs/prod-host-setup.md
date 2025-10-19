# 生产环境主机配置建议

Firecracker 依赖 KVM 及处理器虚拟化功能实现工作负载隔离。主机与客户机内核及主机微代码必须根据发行版的安保公告（如 Amazon Linux 的[ALAS](https://alas.aws.amazon.com/alas2023.html)）定期打补丁。

只有在生产环境中实施以下建议清单，才能维持安全保障和深度防御机制。

## Firecracker 配置

### Seccomp

Firecracker 使用[seccomp](https://www.kernel.org/doc/Documentation/prctl/seccomp_filter.txt)过滤器将主机操作系统允许的系统调用限制在最低必要范围内。

默认情况下，Firecracker 采用最严格的过滤器，这是生产环境中推荐的选项。

不建议在生产环境中使用 `--seccomp-filter` 或 `--no-seccomp` 参数。

### 8250 串行设备

Firecracker 实现了 8250 串行设备，该设备在客户机侧可见，并绑定到 Firecracker / 非守护进程化（non-daemonized）的 jailer 进程的标准输出。
若未进行适当处理，由于客户机可以访问该串行设备，可能导致主机侧出现无限制的内存或存储使用。Firecracker 既不提供限制串行数据传输的选项，也不对标准输出处理施加任何约束。用户需自行管理 Firecracker 进程标准输出的内存与存储使用。建议采用具有上限的存储形式（如固定大小或环形缓冲区）、使用 `journald` 或 `logrotate` 等程序，或重定向至 `/dev/null` 及命名管道。此外，我们不建议用户在生产环境中启用该串行设备。若需在客户机内核中禁用该设备，请在配置 boot source 时使用 `8250.nr_uarts=0` 启动参数。请注意：即使在启动时禁用，该设备仍可在客户机内部重新激活。

如果 Firecracker 的`stdout`缓冲区采用非阻塞模式且已满（假设其大小有限），后续写入操作将失败并导致数据丢失，直至该缓冲区被释放。

### 日志文件

Firecracker 将日志数据输出至命名管道、套接字或文件，具体路径由日志记录器配置中的`log_path`字段指定。由于 Firecracker 会因客户机操作生成日志数据，客户机可影响日志写入量。用户需负责安全处理并存储此类数据。建议采用具有上限的存储形式，例如固定大小或环形缓冲区，使用`journald`或`logrotate`等程序，或重定向至命名管道。

### 日志记录与性能

我们建议在主机内核命令行中添加 `quiet loglevel=1` 以限制写入串行控制台的消息数量。这是因为某些主机配置可能影响 Firecracker 的性能——该进程在正常运行期间会生成主机内核日志。

最近的实例是我们在某测试环境中添加了 `console=ttyAMA0` 主机内核命令行参数。此操作启用了控制台日志记录，导致 `aarch64` 架构上的快照恢复时间从 3 毫秒延长至 8.5 毫秒。在此情况下，为快照恢复所创建中的 tap 设备会生成主机内核日志，而这些日志的写入速度极慢。

### 日志记录与信号处理程序

Firecracker 为某些 POSIX 信号（如 SIGSEGV、SIGSYS 等）安装了自定义信号处理程序。

由于 Firecracker 使用的自定义信号处理程序会写入日志并刷新指标（这些操作使用锁进行同步），因此它们并非异步信号安全的。虽然可能性极低，但处理程序仍可能在某个线程已持有日志或指标缓冲区锁的情况下拦截信号。这可能导致死锁，使特定的 Firecracker 线程无法响应。

虽然死锁不会造成安全影响，但我们建议客户在主机上部署监视进程，定期检测无响应的 Firecracker 进程，并通过 SIGKILL 信号终止它们。

## Jailer 配置

为确保生产环境部署中的安全隔离，应使用 Firecracker 每个版本中包含的`jailer`二进制文件启动 Firecracker，或在比 jailer 更严格或等同于 jailer 的进程约束下执行。有关 Firecracker 沙箱的更多信息，请参阅[Firecracker 架构设计](design.md)。

Jailer 进程应用[cgroup](https://www.kernel.org/doc/Documentation/cgroup-v1/cgroups.txt)，实现命名空间隔离并降低 Firecracker 进程的特权。

要正确设置 jailer，您需要：

- 为运行 Firecracker 创建专用的非特权 POSIX 用户和组。
  在 Jailer 的 `--uid <UID>` 和 `--gid <GID>` 标志中分别使用创建的 POSIX 用户 ID 和组 ID。
  这将使 Firecracker 以创建的非特权用户和组身份运行。所有用于 Firecracker 的文件系统资源
  应归属于该用户及组。对该用户组拥有的资源文件实施最小权限原则，
  防止其他账户未经授权访问文件。运行多个 Firecracker 实例时，建议每个实例使用独立的`uid`和`gid`，
  为各自拥有的资源提供额外安全层。此举可在极端情况下（如某 jails 环境被突破）
  保障资源安全。

强烈建议 Firecracker 的客户使用 jailer 内封装的
`resource-limits` 和 `cgroup` 功能，
以针对其特定工作负载最合理的方式控制 Firecracker 的资源消耗。
虽然我们致力于提供尽可能多的控制选项，
但无法强制实施内存或 CPU 等资源的严格默认限制，
因为这些限制高度依赖于工作负载类型和具体使用场景。

以下是一些限制进程资源的建议：

### 磁盘

- `cgroup` 提供了一个
  [块 I/O 控制器](https://www.kernel.org/doc/Documentation/cgroup-v1/blkio-controller.txt)
  允许用户通过以下文件控制 I/O 操作：

  - `blkio.throttle.io_serviced` - 限制发送到磁盘的 I/O 操作次数
  - `blkio.throttle.io_service_bytes` - 设定磁盘传输字节数的上限

- Jailer 的 `resource-limit` 通过以下方式控制磁盘使用：

  - `fsize` - 限制进程创建文件的字节大小
  - `no-file` - 指定大于进程可打开最大文件描述符数的值。若未指定，默认值为
    4096\.

### 内存

- `cgroup` 提供了一个
  [内存资源控制器](https://www.kernel.org/doc/Documentation/cgroup-v1/memory.txt)
  用于设置内存使用上限：
  - `memory.limit_in_bytes` - 限制内存使用量
  - `memory.memsw.limit_in_bytes` - 限制内存+交换空间使用量
  - `memory.soft_limit_in_bytes` - 启用内存灵活共享机制。在正常情况下，控制组可根据需求使用任意数量的内存，仅受`memory.limit_in_bytes`参数设置的硬性限制约束。但当系统检测到内存争用或内存不足时，控制组将被迫将其消耗限制在软性限制范围内。

### vCPU

- `cgroup` 的
  [CPU 控制器](https://www.kernel.org/doc/Documentation/cgroup-v1/cpuacct.txt)
  可在系统繁忙时保证最低 CPU 份额，并通过以下方式提供 CPU 带宽控制：
  - `cpu.shares` - 限制每个组预期获得的 CPU 份额。分配的 CPU 百分比等于该组份额除以
    同层级所有`cgroups`份额总和
  - `cpu.cfs_period_us` - 限定每个调度周期（以微秒计）的持续时间，用于带宽决策。默认值为 100 毫秒
  - `cpu.cfs_quota_us` - 设定当前组在每次`cfs_period_us`周期内
    允许运行的最大时间（单位：微秒）
  - `cpuacct.usage_percpu` - 按 CPU 核心划分，限制组内进程消耗的 CPU 时间
    （单位：纳秒）

更多 Jailer 功能详情请参阅
[Jailer 文档](jailer.md)。

## 主机安全配置

### 限制由 kvm-pit 内核线程引起的 CPU 开销

The current implementation results in host CPU usage increase on x86 CPUs when a
guest injects timer interrupts with the help of kvm-pit kernel thread. kvm-pit
kthread is by default part of the root cgroup.

To mitigate the CPU overhead we recommend two system level configurations.

1. Use an external agent to move the `kvm-pit/<pid of firecracker>` kernel
   thread in the microVM’s cgroup (e.g., created by the Jailer). This cannot be
   done by Firecracker since the thread is created by the Linux kernel after
   guest start, at which point Firecracker is de-privileged.
1. Configure the kvm limit to a lower value. This is a system-wide configuration
   available to users without Firecracker or Jailer changes. However, the same
   limit applies to APIC timer events, and users will need to test their
   workloads in order to apply this mitigation.

To modify the kvm limit for interrupts that can be injected in a second.

1. `sudo modprobe -r (kvm_intel|kvm_amd) kvm`
1. `sudo modprobe kvm min_timer_period_us={new_value}`
1. `sudo modprobe (kvm_intel|kvm_amd)`

To have this change persistent across boots we can append the option to
`/etc/modprobe.d/kvm.conf`:

`echo "options kvm min_timer_period_us=" >> /etc/modprobe.d/kvm.conf`

### 减轻网络泛洪问题

Network can be flooded by creating connections and sending/receiving a
significant amount of requests. This issue can be mitigated either by
configuring rate limiters for the network interface as explained within
[Network Interface documentation](api_requests/patch-network-interface.md), or
by using one of the tools presented below:

- `tc qdisc` - manipulate traffic control settings by configuring filters.

When traffic enters a classful qdisc, the filters are consulted and the packet
is enqueued into one of the classes within. Besides containing other qdiscs,
most classful qdiscs perform rate control.

- `netnamespace` and `iptables`
  - `--pid-owner` - can be used to match packets based on the PID that was
    responsible for them
  - `connlimit` - restricts the number of connections for a destination IP
    address/from a source IP address, as well as limit the bandwidth

### 缓解 噪声邻居（Noisy-Neighbour） 存储设备争用问题

Data written to storage devices is managed in Linux with a page cache. Updates
to these pages are written through to their mapped storage devices
asynchronously at the host operating system's discretion. As a result, high
storage output can result in this cache being filled quickly resulting in a
backlog which can slow down I/O of other guests on the host.

To protect the resource access of the guests, make sure to tune each Firecracker
process via the following tools:

- [Jailer](jailer.md): A wrapper environment designed to contain Firecracker and
  strictly control what the process and its guest has access to. Take note of
  the [jailer operations guide](jailer.md#jailer-operation), paying particular
  note to the `--resource-limit` parameter.
- Rate limiting: Rate limiting functionality is supported for both networking
  and storage devices and is configured by the operator of the environment that
  launches the Firecracker process and its associated guest. See the
  [block device documentation](api_requests/patch-block.md) for examples of
  calling the API to configure rate limiting.

### 禁用磁盘交换或启用安全交换

Memory pressure on a host can cause memory to be written to drive storage when
swapping is enabled. Disabling swap mitigates data remanence issues related to
having guest memory contents on microVM storage devices.

Verify that swap is disabled by running:

```bash
grep -q "/dev" /proc/swaps && \
echo "swap partitions present (Recommendation: no swap)" \
|| echo "no swap partitions (OK)"
```

### 缓解硬件漏洞影响

> [!CAUTION]
>
> Firecracker is not able to mitigate host's hardware vulnerabilities. Adequate
> mitigations need to be put in place when configuring the host.

> [!CAUTION]
>
> Firecracker is designed to provide isolation boundaries between microVMs
> running in different Firecracker processes. It is strongly recommended that
> each Firecracker process corresponds to a workload of a single tenant.

> [!CAUTION]
>
> For security and stability reasons it is highly recommended to load updated
> microcode as soon as possible. Aside from keeping the system firmware
> up-to-date, when the kernel is used to load updated microcode of the CPU this
> should be done as early as possible in the boot process.

#### 侧信道攻击

For the purposes of this document we assume a workload that involves arbitrary
code execution in a multi-tenant context where each Firecracker process
corresponds to a single tenant.

Specific mitigations for side channel issues are constantly evolving as
researchers find additional issues on a regular basis. Firecracker itself has no
control over many lower-level software and hardware behaviors and capabilities
and is not able to mitigate all these issues. Thus, it is strongly recommended
that users follow the very latest
[Linux kernel documentation on hardware vulnerabilities](https://docs.kernel.org/admin-guide/hw-vuln/index.html)
as well as hardware/processor-specific recommendations and firmware updates (see
[vendor-specific recommendations](#vendor-specific-recommendations) below) when
configuring mitigations against side channel attacks including "Spectre" and
"Meltdown" attacks.

However, some generic recommendations are also provided in what follows.

##### 禁用 SMT

Simultaneous Multi-Threading (SMT) is frequently a precondition for speculation
issues utilized in side channel attacks such as Spectre variants, MDS, and
others, where one tenant could leak information to another tenant or the host.
As such, our recommendation is to disable SMT in production scenarios that
require tenant separation.

##### 禁用内核同页合并

Users should disable
[Kernel Samepage Merging](https://www.kernel.org/doc/html/latest/admin-guide/mm/ksm.html)
to mitigate [side channel issues](https://eprint.iacr.org/2013/448.pdf) that
rely on page deduplication for revealing what memory pages are accessed by
another process.

##### 使用支持 Rowhammer 缓解机制的内存

Rowhammer is a memory side-channel issue that can lead to unauthorized cross-
process memory changes.

Using DDR4 memory that supports Target Row Refresh (TRR) with error-correcting
code (ECC) is recommended. Use of pseudo target row refresh (pTRR) for systems
with pTRR-compliant DDR3 memory can help mitigate the issue, but it also incurs
a performance penalty.

##### 供应商专属建议

For vendor-specific recommendations, please consult the resources below:

- Intel:
  [Software Security Guidance](https://www.intel.com/content/www/us/en/developer/topic-technology/software-security-guidance/overview.html)
- AMD:
  [AMD Product Security](https://www.amd.com/en/resources/product-security.html)
- ARM:
  [Speculative Processor Vulnerability](https://developer.arm.com/support/arm-security-updates/speculative-processor-vulnerability)

##### [仅限 ARM] 虚拟机物理计数器行为

On ARM, Firecracker tries to reset the `CNTPCT` physical counter on VM boot.
This is done in order to prevent VM from reading host physical counter value.
Firecracker will only try to reset the counter if the host KVM contains
`KVM_CAP_COUNTER_OFFSET` capability. This capability is only present in kernels
containing
[this](https://lore.kernel.org/all/20230330174800.2677007-1-maz@kernel.org/)
patch series (starting from 6.4 and newer). For older kernels the counter value
will be passed through from the host.

##### 验证

[spectre-meltdown-checker script](https://github.com/speed47/spectre-meltdown-checker)
can be used to assess host's resilience against several transient execution CVEs
and receive guidance on how to mitigate them.

The script is used in integration tests by the Firecracker team. It can be
downloaded and executed like:

```bash
# Read https://meltdown.ovh before running it.
wget -O - https://meltdown.ovh | bash
```

### Linux 6.1 启动时间退化问题

Linux 6.1 introduced some regressions in the time it takes to boot a VM, for the
x86_64 architecture. They can be mitigated depending on the CPU and the version
of cgroups in use.

#### 说明

The regression happens in the `KVM_CREATE_VM` ioctl and there are two factors
that cause the issue:

1. In the implementation of the mitigation for the iTLB multihit vulnerability,
   KVM creates a worker thread called `kvm-nx-lpage-recovery`. This thread is
   responsible for recovering huge pages split when the mitigation kicks-in. In
   the process of creating this thread, KVM calls `cgroup_attach_task_all()` to
   move it to the same cgroup used by the hypervisor thread
1. In kernel v4.4, upstream converted a cgroup per process read-write semaphore
   into a per-cpu read-write semaphore to allow to perform operations across
   multiple processes
   ([commit](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?&id=1ed1328792ff46e4bb86a3d7f7be2971f4549f6c)).
   It was found that this conversion introduced high latency for write paths,
   which mainly includes moving tasks between cgroups. This was fixed in kernel
   v4.9 by
   [commit](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?&id=3942a9bd7b5842a924e99ee6ec1350b8006c94ec)
   which chose to favor writers over readers since moving tasks between cgroups
   is a common operation for Android. However, In kernel 6.0, upstream decided
   to revert back again and favor readers over writers re-introducing the
   original behavior of the rw semaphore
   ([commit](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?&id=6a010a49b63ac8465851a79185d8deff966f8e1a)).
   At the same time, this commit provided an option called favordynmods to favor
   writers over readers.
1. Since the `kvm-nx-lpage-recovery` thread creation and its cgroup change is
   done in the `KVM_CREATE_VM` call, the high latency we observe in 6.1 is due
   to the upstream decision to favor readers over writers for this per-cpu rw
   semaphore. While the 4.14 and 5.10 kernels favor writers over readers.

The first step is to check if the host is vulnerable to iTLB multihit. Look at
the value of `cat /sys/devices/system/cpu/vulnerabilities/itlb_multihit`. If it
does says `Not affected`, the host is not vulnerable and you can apply
mitigation 2, and optionally 1 for best results. Otherwise it is vulnerable and
you can only apply mitigation 1.

#### 缓解措施 1：`favordynmods`

The mitigation in this case is to enable `favordynmods` in cgroupsv1 or
cgroupsv2. This changes the behavior of all cgroups in the host, and makes it
closer to the performance of Linux 5.10 and 4.14.

For cgroupsv2, run this command:

```sh
sudo mount -o remount,favordynmods /sys/fs/cgroup
```

For cgroupsv1, remounting with `favordynmods` is not supported, so it has to be
done at boot time, through a kernel command line option. Add
`cgroup_favordynmods=true` to your kernel command line in GRUB. Refer to your
distribution's documentation for where to make this change[^1]

#### 缓解措施 2：`kvm.nx_huge_pages=never`

This mitigation is preferred to the previous one as it is less invasive (it
doesn't affect other cgroups), but it can also be combined with the cgroups
mitigation.

```sh
KVM_VENDOR_MOD=$(lsmod |grep -P "^kvm_(amd|intel)" | awk '{print $1}')
sudo modprobe -r $KVM_VENDOR_MOD kvm
sudo modprobe kvm nx_huge_pages=never
sudo modprobe $KVM_VENDOR_MOD
```

To validate that the change took effect, the file
`/sys/module/kvm/parameters/nx_huge_pages` should say `never`.

[^1]:
    Look for `GRUB_CMDLINE_LINUX` in file `/etc/default/grub` in RPM-based
    systems, and
    [this doc for Ubuntu](https://wiki.ubuntu.com/Kernel/KernelBootParameters).
