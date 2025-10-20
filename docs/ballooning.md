# 为 Firecrackerh 使用 ballon 设备

## 什么是 ballon 设备

内存气球设备是一种 virtio 设备，可通过主机发出的 API 命令回收并释放客户机内存。其工作原理是在客户机中分配内存，随后将该内存地址发送至主机；主机可据此随意移除该内存。该设备通过若干配置选项及一个整数参数进行设置，该整数以 MiB 为单位表示气球内存的目标容量。运行期间无法修改配置选项，但可调整目标容量。

气球的行为如下：当气球的实际大小（即其分配的内存）小于目标大小时，它会持续尝试分配新内存——若失败则打印错误信息 （`Out of puff! Can't get %d pages`），休眠 0.2 秒后重新尝试。当气球实际大小超过目标大小时，它将释放内存直至达到目标大小。

该设备可配置以下选项：

- `deflate_on_oom`：若此项设置为`true`，当客户进程试图分配内存导致客户系统进入内存不足状态时，内核将从气球内存中提取部分页面分配给该进程，而不是让 OOM killer 进程杀死其他进程来释放内存。
  Note that this applies to physical page allocations in the kernel which belong
  to guest processes. This does not apply to instances when the kernel needs
  memory for its activities (i.e. constructing caches), when the user requests
  more memory than the currently available to the balloon for releasing, or when
  guest processes try to allocate large amounts of memory that are refused by
  the guest memory manager, which is possible when the guest runs with
  `vm.overcommit_memory=0` and the allocation does not pass the MM basic checks.
  Setting `vm.memory_overcommit` to 1 would make the MM approve all allocations,
  no matter how large, and using the memory mapped for those allocations will
  always deflate the balloon instead of making the guest enter an OOM state.
  Note: we do not recommend running with `vm.overcommit_memory=1` because it
  requires complete control over what allocations are done in the guest and can
  easily result in unexpected OOM scenarios.
- `stats_polling_interval_s`: unsigned integer value which if set to 0 disables
  the virtio balloon statistics and otherwise represents the interval of time in
  seconds at which the balloon statistics are updated.

## Security disclaimer

**The balloon device is a paravirtualized virtio device that requires
cooperation from a driver in the guest.**

In normal conditions, the balloon device will:

- not change the target size, which is set directly by the host
- consume exactly as many pages as required to achieve the target size
- correctly update the value of the actual size of the balloon seen by the host
- not use pages that were previously inflated if they were not returned to the
  guest via a deflate operation (unless the `deflate_on_oom` flag was set and
  the guest is in an out of memory state)
- provide correct statistics when available

However, Firecracker does not and cannot introspect into the guest to check the
integrity of the balloon driver. As the guest is not trusted, if the driver in
the guest becomes compromised, the above statements are **no longer
guaranteed**.

This means that even though users use the balloon to impose restrictions on
memory usage, they can be broken by a compromised driver in the guest. The
balloon device operates on a best effort model and users should always ensure
the host is prepared to handle a situation in which the Firecracker process uses
all of the memory it was given at boot even if the balloon was used to restrict
the amount of memory available to the guest. It is also the users'
responsibility to monitor the memory consumption of the VM and, in case
unexpected increases in memory usage are observed, we recommend the following
options:

- migrate the VM to a machine with higher memory availability through
  snapshotting at the cost of disrupting the workload;
- kill the Firecracker process that exceeds memory restrictions;
- enable swap with a sufficient amount of memory to handle the demand at the
  cost of memory access speed;

Users should also never rely solely on the statistics provided by the balloon
when controlling the Firecracker process as they are provided directly by the
guest driver and should always be viewed as an indication rather than a
guarantee of what the memory state looks like in the guest.

Please note that even in the case where the driver is not working properly, the
balloon will never leak memory from one Firecracker process to another, nor can
a guest within Firecracker access information in memory outside its own guest
memory. In other words, memory cannot leak in or out of Firecracker if the
driver becomes corrupted. This is guaranteed by the fact that the page frame
numbers coming from the driver are checked to be inside the guest memory, then
`madvise`d with the `MADV_DONTNEED` flag, which breaks the mappings between host
physical memory (where the information is ultimately stored) and Firecracker
virtual memory, which is what Firecracker uses to build the guest memory. On
subsequent accesses on previously `madvise`d memory addresses, the memory is
zeroed. Furthermore, the guest memory is `mmap`ped with the `MAP_PRIVATE` and
`MAP_ANONYMOUS` flags, which ensure that even if a Firecracker yields some
information through an inflate and that same physical page containing the
information is mapped onto another Firecracker process, reads on that address
space will see zeroes.

## Prerequisites

To support memory ballooning, you must use a kernel that has the memory
ballooning driver installed (on Linux 4.14.193, the relevant settings are
`CONFIG_MEMORY_BALLOON=y`, `CONFIG_VIRTIO_BALLOON=y`). Other than that, only the
requirements mentioned in the `getting-started` document are needed.

## Installing the balloon device

In order to use a balloon device, you must install it during virtual machine
setup (i.e. before starting the virtual machine). This can be done either
through a PUT request on "/balloon" or by inserting the balloon into the JSON
configuration file given as a command line argument to the Firecracker process.

Here is an example command on how to install the balloon through the API:

```console
socket_location=...
amount_mib=...
deflate_on_oom=...
polling_interval=...

curl --unix-socket $socket_location -i \
    -X PUT 'http://localhost/balloon' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -d "{
        \"amount_mib\": $amount_mib, \
        \"deflate_on_oom\": $deflate_on_oom, \
        \"stats_polling_interval_s\": $polling_interval \
    }"
```

To use this, set `socket_location` to the location of the firecracker socket (by
default, at `/run/firecracker.socket`. Then, set `amount_mib`, `deflate_on_oom`
and `stats_polling_interval_s` as desired: `amount_mib` represents the target
size of the balloon, and `deflate_on_oom` and `stats_polling_interval_s`
represent the options mentioned before.

To install the balloon via the JSON config file, insert the following JSON
object into your configuration file:

```console
"balloon": {
    "amount_mib": 0,
    "deflate_on_oom": false,
    "stats_polling_interval_s": 1
},
```

After installing the balloon device, users can poll the configuration of the
device at any time by sending a GET request on "/balloon". Here is an example of
such a request:

```console
socket_location=...

curl --unix-socket $socket_location -i \
    -X GET 'http://localhost/balloon' \
    -H 'Accept: application/json'
```

On success, this request returns a JSON object of the same structure as the one
used to configure the device (via a PUT request on "/balloon").

## Operating the balloon device

After it has been installed, the balloon device can only be operated via the API
through the following command:

```console
socket_location=...
amount_mib=...
polling_interval=...

curl --unix-socket $socket_location -i \
    -X PATCH 'http://localhost/balloon' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -d "{
        \"amount_mib\": $amount_mib, \
        \"stats_polling_interval_s\": $polling_interval \
    }"
```

This will update the target size of the balloon to `amount_mib` and the
statistics polling interval to `polling_interval`.

## Virtio balloon statistics

The statistics are enabled by setting the `stats_polling_interval_s` field in
the balloon configuration to a non-zero value. If enabled, users can receive the
latest balloon statistics by issuing a GET request on "/balloon". Here is an
example of such a request:

```console
socket_location=...

curl --unix-socket $socket_location -i \
    -X GET 'http://localhost/balloon/statistics' \
    -H 'Accept: application/json'
```

The request, if successful, will return a JSON object containing the latest
statistics. The JSON object contains information about the target and actual
sizes of the balloon as well as virtio traditional memory balloon statistics.

The target and actual sizes of the balloon are expressed as follows:

- `target_pages`: The target size of the balloon, in 4K pages.
- `actual_pages`: The number of 4K pages the device is currently holding.
- `target_mib`: The target size of the balloon, in MiB.
- `actual_mib`: The number of MiB the device is currently holding.

These values are taken directly from the config space of the device and are
always up to date, in the sense that they are exactly what the Firecracker
process reads when polling the config space. The `actual` fields being accurate
are subject to the guest driver working correctly.

As defined in the virtio 1.1 specification, the traditional virtio balloon
device has support for the following statistics:

- `VIRTIO_BALLOON_S_SWAP_IN`: The amount of memory that has been swapped in (in
  bytes).
- `VIRTIO_BALLOON_S_SWAP_OUT`: The amount of memory that has been swapped out to
  disk (in bytes).
- `VIRTIO_BALLOON_S_MAJFLT`: The number of major page faults that have occurred.
- `VIRTIO_BALLOON_S_MINFLT`: The number of minor page faults that have occurred.
- `VIRTIO_BALLOON_S_MEMFREE`: The amount of memory not being used for any
  purpose (in bytes).
- `VIRTIO_BALLOON_S_MEMTOT`: The total amount of memory available (in bytes).
- `VIRTIO_BALLOON_S_AVAIL`: An estimate of how much memory is available (in
  bytes) for starting new applications, without pushing the system to swap.
- `VIRTIO_BALLOON_S_CACHES`: The amount of memory, in bytes, that can be quickly
  reclaimed without additional I/O. Typically these pages are used for caching
  files from disk.
- `VIRTIO_BALLOON_S_HTLB_PGALLOC`: The number of successful hugetlb page
  allocations in the guest.
- `VIRTIO_BALLOON_S_HTLB_PGFAIL`: The number of failed hugetlb page allocations
  in the guest.

The driver is querried for updated statistics every time the amount of time
specified in that field passes. The driver may not provide all the statistics
when querried, in which case the old values of the missing statistics are
preserved.

To change the statistics polling interval, users can sent a PATCH request on
"/balloon/statistics". Here is an example of such a request:

```console
socket_location=...
polling_interval=...

curl --unix-socket $socket_location -i \
    -X PATCH 'http://localhost/balloon' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -d "{ \"stats_polling_interval_s\": $polling_interval }"
```

This will change the statistics polling interval to `polling_interval`. Note
that if the balloon was configured without statistics pre-boot, the statistics
cannot be enabled later by providing a `polling_interval` non-zero value.
Furthermore, if the balloon was configured with statistics pre-boot through a
non-zero `stats_polling_interval_s` value, the statistics cannot be disabled
through a `polling_interval` value of zero post-boot.

## Balloon Caveats

- Firecracker has no control over the speed of inflation or deflation; this is
  dictated by the guest kernel driver.

- The balloon will continually attempt to reach its target size, which can be a
  CPU-intensive process. It is therefore recommended to set realistic targets
  or, after a period of stagnation in the inflation, update the target size to
  be close to the inflated size.

- The `deflate_on_oom` flag is a mechanism to prevent the guest from crashing or
  terminating processes; it is not meant to be used continually to free memory.
  Doing this will be a CPU-intensive process, as the balloon driver is designed
  to deflate and release memory slowly. This is also compounded if the balloon
  has yet to reach its target size, as it will attempt to inflate while also
  deflating.
