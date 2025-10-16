# 块设备缓存策略

Firecracker 提供了选择块设备缓存策略的功能。缓存策略会影响从 microVM 内部写入主机持久存储的数据的路径。

## 工作原理

通过 PUT /drives API 调用安装块设备时，用户可以通过在 JSON 请求体中插入 `cache_type` 字段来选择缓存策略。可用的缓存类型包括：

- `Unsafe`
- `Writeback`

### Unsafe 模式 (默认)

当将块缓存策略配置为 `Unsafe` 时，设备将不会向客户机驱动程序
提供 VirtIO 的 `flush` 功能。

### Writeback 模式

当将块缓存策略配置为 `Writeback` 时，设备将向客户机驱动程序通告VirtIO的 `flush` 功能。如果在设备激活过程中该功能被协商启用，客户机驱动程序便可向设备发送 flush 请求。当设备执行刷新请求时，它将对备份块文件执行 `fsync` 系统调用，
将主机页面缓存中的所有数据提交到磁盘。

## Supported use cases

The caching strategy should be used in order to make a trade-off:

- `Unsafe`
  - enhances performance as fewer syscalls and IO operations are performed when
    running workloads
  - sacrifices data integrity in situations where the host simply loses the
    contents of the page cache without committing them to the backing storage
    (such as a power outage)
  - recommended for use cases with ephemeral storage, such as serverless
    environments
- `Writeback`
  - ensures that once a flush request was acknowledged by the host, the data is
    committed to the backing storage
  - sacrifices performance, from boot time increases to greater
    emulation-related latencies when running workloads
  - recommended for use cases with low power environments, such as embedded
    environments

## How to configure it

Example sequence that configures a block device with a caching strategy:

```bash
curl --unix-socket ${socket} -i \
     -X PUT "http://localhost/drives/dummy" \
     -H "accept: application/json" \
     -H "Content-Type: application/json" \
     -d "{
             \"drive_id\": \"dummy\",
             \"path_on_host\": \"${drive_path}\",
             \"is_root_device\": false,
             \"is_read_only\": false,
             \"cache_type\": \"Writeback\"
         }"
```
