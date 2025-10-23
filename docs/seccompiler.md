# Seccompiler - 概述与用户指南

## 概述

Seccompiler-bin 是一款工具，用于将用 JSON 文件描述的 seccomp 过滤器编译为序列化的二进制 BPF 代码，该代码可在构建或启动时直接被 Firecracker 调用。

Seccompiler-bin 使用自定义的 [JSON 文件结构](#JSON-文件格式)，过滤器必须遵循该结构（详见下文）。

除 seccompiler-bin 可执行文件外，seccompiler 还提供库接口，包含用于反序列化和安装二进制过滤器的辅助函数。

## 使用

### Seccompiler-bin

要查看 seccompiler-bin 的命令行参数，请向可执行文件传递 `--help` 参数。

使用示例：

```bash
./seccompiler-bin
    --target-arch "x86_64"                             # BPF程序运行的CPU架构。
                                                                        # 支持架构：x86_64, aarch64。
    --input-file "x86_64_musl.json"             # JSON输入文件的路径。
    --output-file "bpf_x86_64_musl"           # 可选的输出文件路径。
                                                                       # [默认值：“seccomp_binary_filter.out”]
    --basic                                                       # 可选，创建基本过滤器，忽略任何参数检查。
                                                                      # (已弃用)。
```

### Seccompiler 库

要查看库文档，请导航至 seccompiler 源代码目录 `firecracker/src/seccompiler/src`，并运行 `cargo doc --lib --open`。

## seccompiler 在哪里实现？

Seccompiler 作为另一个包在 Firecracker cargo 工作区中实现。其代码位于 `firecracker/src/seccompiler/src`。

## 支持的平台

Seccompiler-bin 在
[与 Firecracker 相同的平台上得到支持](README.md#测试平台)。

## 发布政策

Seccompiler-bin 遵循 Firecracker 的 [发布政策](RELEASE_POLICY.md) 及版本规则（与 Firecracker 同步发布，采用相同版本号，并遵循相同的支持周期）。

## JSON 文件格式

一个 JSON 文件定义了整个 Firecracker 进程的 seccomp 策略。该文件包含多个过滤器，每个线程类别对应一个过滤器，且仅适用于特定目标平台。

这意味着 Firecracker 为每个支持的目标（当前由 arch-libc 组合决定）都提供了一个 JSON 文件。您可以在`resources/seccomp`目录中查看这些文件。

在顶级文件中，需要一个将线程类别（vmm、api 和 vcpu）映射到 seccomp 过滤器的对象：

```json
{
    "vmm": {
       "default_action": {
            "errno" : -1
       },
       "filter_action": "allow",
       "filter": [...]
    },
    "api": {...},
    "vcpu": {...},
}
```

关联过滤器是一个包含`default_action`、`filter_action`和`filter`的 JSON 对象。

`default_action` 表示当 `filter` 中没有任何规则匹配时需要执行的操作，而 `filter_action` 则是在过滤器中的某条规则匹配时执行的操作（例如：在实现允许列表时为 `"Allow"`）。

一个**action**是以下枚举的 JSON 表示形式：

```rust
pub enum SeccompAction {
    Allow,          // 允许系统调用。
    Errno(u32), // 返回指定错误编号的系统调用结果。
    Kill,               // 终止调用进程。
    Log,            // 与allow相同，但会记录调用。
    Trace(u32), // 通知调用方对应编号的跟踪进程。
    Trap,           // 向调用进程发送 `SIGSYS` 信号。
}
```

`filter` 属性指定了会触发匹配的一组规则。 它是一个数组，包含多个 **or-bound SyscallRule** **objects**（只要其中任意一个匹配，就会触发相应的动作）。

The **SyscallRule** object is used for adding a rule to a syscall. It has an
optional `args` property that is used to specify a vector of and-bound
conditions that the syscall arguments must satisfy in order for the rule to
match.

若缺少 `args` 属性，则任何匹配该名称的调用都会触发对应操作，无论参数值如何。

以下是该对象的结构：

```json
{
    "syscall": "accept4", // 必填项，系统调用名称
    "comment": "Used by vsock & api thread", // 可选，用于添加有意义的注释
    "args": [...] // 可选，参数的and-bound条件向量
}
```

Note that the file format expects syscall names, not arch-specific numbers, for
increased usability. This is not true, however for the syscall arguments, which
are expected as base-10 integers.

In order to allow a syscall with multiple alternatives for the same parameters,
you can write multiple syscall rule objects at the filter-level, each with its
own rules.

Note that, when passing the deprecated `--basic` flag to seccompiler-bin, all
`args` fields of the `SeccompRule`s are ignored.

A **condition object** is made up of the following mandatory properties:

- `index` (0-based index of the syscall argument we want to check)
- `type` (`dword` or `qword`, which specifies the argument size - 4 or 8 bytes
  respectively)
- `op`, which is one of `eq, ge, gt, ge, lt, masked_eq, ne` (the operator used
  for comparing the parameter to `val`)
- `val` is the integer value being checked against

As mentioned eariler, we don’t support any named parameters, but only numeric
constants in the JSON file. You may however add an optional `comment` property
to each condition object. This way, you can provide meaning to each numeric
value, much like when using named parameters, like so:

```json
{
  "syscall": "accept4",
  "args": [
    {
      "index": 3,
      "type": "dword",
      "op": "eq",
      "val": 1,
      "comment": "libc::AF_UNIX"
    }
  ]
}
```

To see example filters, look over Firecracker's JSON filters in
`resources/seccomp`.
