# Firecracker 中的 Seccomp

默认情况下，Seccomp 过滤器用于限制 Firecracker 可以使用的主机系统调用。
默认过滤器仅允许 Firecracker 正常运行所需的最少系统调用和
参数。

过滤器在 Firecracker 进程中按线程加载，如下所示：

- VMM（main）- 在 VCPU 线程上执行客户机代码之前；
- API - 在启动 HTTP 服务器之前；
- VCPUs - 在执行客户机代码之前。

> [!WARNING]
>
> 在调试二进制文件和实验性 GNU 目标上，没有安装默认的 seccomp 过滤器，因为它们不适用于生产用途。

Firecracker 使用 JSON 文件来表达过滤规则，并依赖[seccompiler](seccompiler.md) 工具实现所有 seccomp 功能。

## 默认过滤器（推荐）

在构建时，使用 seccompiler-bin 将默认的目标特定 JSON 文件编译为序列化二进制文件，并嵌入到 Firecracker 二进制文件中。

此过程在构建可执行文件时自动执行。

为了最大限度地减少连续构建的开销，已编译的过滤器文件会缓存在构建文件夹中，只有在修改时才会重新编译。

您可以在“resources/seccomp”下找到默认的 seccomp 过滤器。

对于特定版本，用于构建 Firecracker 的默认 JSON 过滤器也包含在相应的版本存档中，可在[发行版页面](https://github.com/firecracker-microvm/firecracker/releases) 查看。

## 自定义过滤器（仅限高级用户）

> [!NOTE]
>
> 此功能会覆盖默认过滤器，因此可能存在危险。过滤器配置错误可能会导致进程突然终止或 seccomp 安全边界完全禁用。我们建议使用默认过滤器。

---

> [!NOTE]
>
> 用户需全权负责管理过滤器文件。我们建议在传输/下载文件时（例如校验和）以及处理 Firecracker 二进制文件或其他构件时，始终使用完整性检查机制，以减轻潜在的中间人攻击风险。

Firecracker 为高级用户提供了一种方法，可以在启动时使用相同的 JSON/seccompiler 工具，用完全可自定义的替代方案覆盖默认过滤器。

通过 Firecracker 的可选参数 `--seccomp-filter`，用户可提供由 seccompiler-bin 编译的自定义过滤器文件路径。

潜在用例：

- 使用实验性支持目标（如 GNU libc 构建）的用户可能能够
  利用此功能实现 seccomp 过滤器，而无需自行构建定制版的 Firecracker。
- 需要使用 seccomp 过滤器的调试二进制文件用户，无论出于何种原因，
  均可利用此功能实现 seccomp 过滤器，而自行构建定制版的 Firecracker。注意：`debug`与`release`构建版本的系统调用可能存在差异，部分示例如下：
  - `fcntl(F_GETFD)`被调试断言用来验证一个已被丢弃的文件描述符`fd`是否有效。
- 如果由于 seccomp 策略不允许 Firecracker 进程发出的系统调用而导致 _理论上_ 的生产问题，可以使用自定义过滤器来快速缓解问题。这可以加快解决问题的速度，因为无需构建和部署新的 Firecracker 二进制文件。

## 禁用 seccomp（不推荐）

Firecracker 还支持 `--no-seccomp` 参数，该参数可禁用所有 seccomp 过滤功能。当需要快速原型化 Firecracker 中使用新系统调用的变更时，此功能会很有帮助。

请**不要**在生产环境中使用。
