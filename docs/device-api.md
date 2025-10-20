# Device

Device-API 功能矩阵显示了 API 调用所需的设备类型。

**O** - 可选：该设备（列）**并非必需**，Firecracker 微虚拟机 API 调用仍可成功。若在 uVM 定义中省略该设备（列），调用 [API 端点](#api-端点) 仍将成功。

**R** - 必填项：该设备（列）**是必需的**，以确保 Firecracker 微虚拟机 API 调用成功。若在 uVM 定义中遗漏该设备（列），调用任一[API 端点](#api-端点)将返回 400 - HTTP 错误响应。

## API 端点

| Endpoint                  | keyboard | serial console | virtio-block | vhost-user-block | virtio-net | virtio-vsock | virtio-rng | virtio-pmem |
| ------------------------- | :------: | :------------: | :----------: | :--------------: | :--------: | :----------: | :--------: | :---------: |
| `boot-source`             |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `cpu-config`              |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `drives/{id}`             |    O     |       O        |    **R**     |      **R**       |     O      |      O       |     O      |      O      |
| `logger`                  |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `machine-config`          |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `metrics`                 |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `mmds`                    |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
| `mmds/config`             |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
| `network-interfaces/{id}` |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
| `snapshot/create`         |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `snapshot/load`           |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `vm`                      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `vsock`                   |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `entropy`                 |    O     |       O        |      O       |        O         |     O      |      O       |   **R**    |      O      |
| `pmem/{id}`               |    O     |       O        |      O       |        O         |     O      |      O       |     O      |    **R**    |

## 输入模式

所有输入模式字段均可在[Swagger](https://swagger.io)规范中查阅：[firecracker.yaml](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。

| Schema                    | Property           | keyboard | serial console | virtio-block | vhost-user-block | virtio-net | virtio-vsock | virtio-rng | virtio-pmem |
| ------------------------- | ------------------ | :------: | :------------: | :----------: | :--------------: | :--------: | :----------: | :--------: | :---------: |
| `BootSource`              | boot_args          |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | initrd_path        |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | kernel_image_path  |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `CpuConfig`               | cpuid_modifiers    |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | msr_modifiers      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | reg_modifiers      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `CpuTemplate`             | enum               |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `CreateSnapshotParams`    | mem_file_path      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | snapshot_path      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | snapshot_type      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | version            |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `Drive`                   | drive_id \*        |    O     |       O        |    **R**     |      **R**       |     O      |      O       |     O      |      O      |
|                           | is_read_only       |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
|                           | is_root_device \*  |    O     |       O        |    **R**     |      **R**       |     O      |      O       |     O      |      O      |
|                           | partuuid \*        |    O     |       O        |    **R**     |      **R**       |     O      |      O       |     O      |      O      |
|                           | path_on_host       |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
|                           | rate_limiter       |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
|                           | socket             |    O     |       O        |      O       |      **R**       |     O      |      O       |     O      |      O      |
| `InstanceActionInfo`      | action_type        |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `LoadSnapshotParams`      | track_dirty_pages  |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | mem_file_path      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | mem_backend        |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | snapshot_path      |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | resume_vm          |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `Logger`                  | level              |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | log_path           |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | show_level         |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | show_log_origin    |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `MachineConfiguration`    | cpu_template       |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | smt                |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | mem_size_mib       |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | track_dirty_pages  |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
|                           | vcpu_count         |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `Metrics`                 | metrics_path       |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `MmdsConfig`              | network_interfaces |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | version            |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | ipv4_address       |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | imds_compat        |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `NetworkInterface`        | guest_mac          |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | host_dev_name      |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | iface_id           |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | rx_rate_limiter    |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | tx_rate_limiter    |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
| `PartialDrive`            | drive_id           |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
|                           | path_on_host       |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
| `PartialNetworkInterface` | iface_id           |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | rx_rate_limiter    |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | tx_rate_limiter    |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
| `RateLimiter`             | bandwidth          |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | ops                |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
| `TokenBucket` \*\*        | one_time_burst     |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
|                           | refill_time        |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
|                           | size               |    O     |       O        |    **R**     |        O         |     O      |      O       |     O      |      O      |
| `TokenBucket` \*\*        | one_time_burst     |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | refill_time        |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
|                           | size               |    O     |       O        |      O       |        O         |   **R**    |      O       |     O      |      O      |
| `Vm`                      | state              |    O     |       O        |      O       |        O         |     O      |      O       |     O      |      O      |
| `Vsock`                   | guest_cid          |    O     |       O        |      O       |        O         |     O      |    **R**     |     O      |      O      |
|                           | uds_path           |    O     |       O        |      O       |        O         |     O      |    **R**     |     O      |      O      |
|                           | vsock_id           |    O     |       O        |      O       |        O         |     O      |    **R**     |     O      |      O      |
| `EntropyDevice`           | rate_limiter       |    O     |       O        |      O       |        O         |     O      |      O       |   **R**    |      O      |
| `Pmem`                    | id                 |    O     |       O        |      O       |        O         |     O      |      O       |     O      |    **R**    |
|                           | path_on_host       |    O     |       O        |      O       |        O         |     O      |      O       |     O      |    **R**    |
|                           | root_device        |    O     |       O        |      O       |        O         |     O      |      O       |     O      |    **R**    |
|                           | read_only          |    O     |       O        |      O       |        O         |     O      |      O       |     O      |    **R**    |

\* `Drive` 的 `drive_id`、`is_root_device` 和 `partuuid` 可通过 virtio-block 或 vhost-user-block 设备进行配置。

\*\* `TokenBucket` 可配置为任意组合的 virtio-net、virtio-block 和 virtio-rng 设备。

## 输出模式

所有输出模式字段均可在[Swagger](https://swagger.io)规范中查阅：[firecracker.yaml](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。

| Schema                 | Property          | keyboard | serial console | virtio-block | vhost-user-block | virtio-net | virtio-vsock |
| ---------------------- | ----------------- | :------: | :------------: | :----------: | :--------------: | :--------: | :----------: |
| `Error`                | fault_message     |    O     |       O        |      O       |        O         |     O      |      O       |
| `InstanceInfo`         | app_name          |    O     |       O        |      O       |        O         |     O      |      O       |
|                        | id                |    O     |       O        |      O       |        O         |     O      |      O       |
|                        | state             |    O     |       O        |      O       |        O         |     O      |      O       |
|                        | vmm_version       |    O     |       O        |      O       |        O         |     O      |      O       |
| `MachineConfiguration` | cpu_template      |    O     |       O        |      O       |        O         |     O      |      O       |
|                        | smt               |    O     |       O        |      O       |        O         |     O      |      O       |
|                        | mem_size_mib      |    O     |       O        |      O       |        O         |     O      |      O       |
|                        | track_dirty_pages |    O     |       O        |      O       |        O         |     O      |      O       |
|                        | vcpu_count        |    O     |       O        |      O       |        O         |     O      |      O       |

## 实例操作

所有实例操作均可在[Swagger](https://swagger.io)规范中查阅：[firecracker.yaml](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。

| Action           | keyboard | serial console | virtio-block | vhost-user-block | virtio-net | virtio-vsock |
| ---------------- | :------: | :------------: | :----------: | :--------------: | :--------: | :----------: |
| `FlushMetrics`   |    O     |       O        |      O       |        O         |     O      |      O       |
| `InstanceStart`  |    O     |       O        |      O       |        O         |     O      |      O       |
| `SendCtrlAltDel` |  **R**   |       O        |      O       |        O         |     O      |      O       |
