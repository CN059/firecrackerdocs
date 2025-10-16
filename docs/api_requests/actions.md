# 操作 API 请求

本文概要
>Firecracker microVM 支持通过向 `/actions` 端点发送 `PUT` 请求来触发特定操作，包括启动虚拟机（`InstanceStart`）、刷新指标（`FlushMetrics`）以及在 Intel/AMD 平台上发送 `Ctrl+Alt+Del` 组合键（`SendCtrlAltDel`）以实现有序关机。每种操作均有其使用限制和前提条件，例如 `InstanceStart`仅可调用一次，而 `SendCtrlAltDel` 要求客户机内核启用特定键盘驱动。

Firecracker microVM 可以执行通过 `/actions` 资源上的 `PUT` 请求触发的操作。

有关必填字段的详细信息，请参阅[swagger 定义](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。

## 实例启动（InstanceStart）

`InstanceStart` 操作用于启动微虚拟机并启动客户操作系统。该操作不包含有效负载，且仅能成功调用一次。

### 实例启动示例

```bash
curl --unix-socket ${socket} -i \
     -X PUT "http://localhost/actions" \
     -d '{ "action_type": "InstanceStart" }'
```

## FlushMetrics

`FlushMetrics` 操作会根据用户需求刷新指标。

### FlushMetrics 示例

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT "http://localhost/actions" \
    -d '{ "action_type": "FlushMetrics" }'
```

## [仅限 Intel 和 AMD] SendCtrlAltDel

此操作会将 CTRL+ALT+DEL 按键序列发送到 microVM。按照惯例，此组合键通常用于触发软重启，因此大多数 Linux 发行版在接收到该键盘输入时会执行有序的关机并重置系统。由于 Firecracker 在 CPU 重置时会退出，因此可以使用 `SendCtrlAltDel` 来触发 microVM 的干净关机。

为了执行此操作，Firecracker 会模拟一个通过i8042 控制器连接的标准 AT 键盘。客户机操作系统（guest OS）中必须包含对这两种设备的驱动支持。对于 Linux 而言，这意味着客户机内核需要启用 `CONFIG_SERIO_I8042`和 `CONFIG_KEYBOARD_ATKBD` 配置项。

> [!NOTE]
>
> 在启动时，i8042 的 Linux 驱动程序会花费几十毫秒的时间
> 探测设备。您可以使用以下内核命令行参数禁用此功能：
>
> ```console
> i8042.noaux i8042.nomux i8042.nopnp i8042.dumbkbd
> ```

### SendCtrlAltDel 示例

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT "http://localhost/actions" \
    -d '{ "action_type": "SendCtrlAltDel" }'
```
