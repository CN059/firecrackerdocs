# 为 Firecracker 搭建开发环境

Firecracker 采用 KVM 实现实际资源虚拟化，因此搭建开发环境需满足以下条件之一：裸机设备（需支持硬件虚拟化）或支持嵌套虚拟化的虚拟机。环境配置完成后，即可继续执行 Firecracker 的具体安装步骤（例如参见[入门指南](getting-started.md)中的说明）。

## 本地

### 本地裸机

`[TODO]`

### 本地虚拟机

#### 搭载 VMware Fusion 的 macOS

请注意，在 macOS 上开发 Firecracker 并不强制依赖 VMware Fusion 或 Ubuntu。
所需的仅是一个支持嵌套虚拟化的 Linux 虚拟机。以下仅为该配置的一个示例：

1. 下载并进行安装
   [VMware Fusion](https://www.vmware.com/products/fusion/fusion-evaluation.html)。
2. 安装 [Ubuntu 18.04.2 LTS](https://www.ubuntu.com/download/desktop) ISO 镜像。
3. 打开 VMware Fusion，点击**File**菜单，选择**New...**以调出
   **Select the Installation Method**窗口。
4. 找到在步骤 2 中下载的 ISO 映像文件，将其拖放到步骤 3 中打开的 VMware 窗口上。
5. 您现在应处于**Create a New Virtual Machine**窗口。请确保
   Ubuntu 18.04.2 镜像处于高亮状态，然后点击**Continue**。
6. 在 **Linux Easy Install** 窗口中，保持 **Use Easy Install** 选项被选中，输入密码，然后点击 **Continue**。
7. On the **Finish** window, click **Finish**, and save the `.vmwarevm` file if
   prompted.
8. After the VM starts up, open the **Virtual Machine** menu, and select **Shut
   Down**.
9. After the VM shuts down, open the **Virtual Machine** menu, and select
   **Settings...**.
10. From the settings window, select **Processors & Memory**, and then unfurl the
    **Advanced options** section.
11. Check the **Enable hypervisor applications in this virtual machine** option,
    close the settings window, open the **Virtual Machine** menu, and select
    **Start Up**.
12. Network adapter setting for the VM must use auto-detect bridged networking.
    Go to Virtual Machine, Settings, Network Adapter, select Autodetect under
    Bridged Networking.
13. If you receive a **Cannot connect the virtual device sata0:1 because no
    corresponding device is available on the host.** error, you can respond
    **No** to the prompt.
14. Once the VM starts up, log in as the user you created in step 6.
15. After logging in, open the **Terminal** app, and run
    `sudo apt install curl -y` to install cURL.
16. Now you can continue with the Firecracker
    [Getting Started](getting-started.md) instructions to install and configure
    Firecracker in the new VM.

## Cloud

### AWS

Firecracker development environment on AWS can be setup using bare metal
instances. Follow these steps to create a bare metal instance.

1. If you don't already have an AWS account, create one using the
   [AWS Portal](https://portal.aws.amazon.com/billing/signup).

1. Login to [AWS console](https://console.aws.amazon.com/console/home). You must
   select a region that offers bare metal EC2 instances. To check which regions
   support bare-metal, visit
   [Amazon EC2 On-Demand Pricing](https://aws.amazon.com/ec2/pricing/on-demand/)
   and look for `*.metal` instance types.

1. Click on `Launch a virtual machine` in `Build Solution` section.

1. Firecracker requires a relatively new kernel, so you should use a recent
   Linux distribution - such as
   `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type`.

1. In `Step 2`, scroll to the bottom and select `c5.metal` instance type. Click
   on `Next: Configure Instance Details`.

1. In `Step 3`, click on `Next: Add Storage`.

1. In `Step 4`, click on `Next: Add Tags`.

1. In `Step 5`, click on `Next: Configure Security Group`.

1. In `Step 6`, take the default security group. This opens up port 22 and is
   needed so that you can ssh into the machine later. Click on
   `Review and Launch`.

1. Verify the details and click on `Launch`. If you do not have an existing key
   pair, then you can select `Create a new key pair` to create a key pair. This
   is needed so that you can use it later to ssh into the machine.

1. Click on the instance id in the green box. Copy `Public DNS` from the
   `Description` tab of the selected instance.

1. Login to the newly created instance:

   ```console
   ssh -i <ssh-key> ubuntu@<public-ip>
   ```

Now you can continue with the Firecracker [Getting Started](getting-started.md)
instructions to use Firecracker to create a microVM.

### GCP

One of the options to set up Firecracker for development purposes is to use a VM
on Google Compute Engine (GCE), which supports nested virtualization and allows
to run KVM. If you don't have a Google Cloud Platform (GCP) account, you can
find brief instructions in the Addendum [below](#addendum).

Here is a brief summary of steps to create such a setup (full instructions to
set up a Ubuntu-based VM on GCE with nested KVM enablement can be found in GCE
[documentation](https://cloud.google.com/compute/docs/instances/enable-nested-virtualization-vm-instances)).

1. Select a GCP project and zone

   ```console
   $ FC_PROJECT=your_name-firecracker
   $ FC_REGION=us-east1
   $ FC_ZONE=us-east1-b
   ```

   <details><summary>Click here for instructions to create a new project</summary>
    <p>
    It might be convenient to keep your Firecracker-related GCP resources in
    a separate project, so that you can keep track of resources more easily
    and remove everything easily once your are done.

   For convenience, give the project a unique name (e.g.,
   your_name-firecracker), so that GCP does not need to create a project id
   different than project name (by appending randomized numbers to the name you
   provide).

   ```console
   $ gcloud projects create ${FC_PROJECT} --enable-cloud-apis --set-as-default
   ```

   </p>
    </details>

   ```console
   $ gcloud config set project ${FC_PROJECT}
   $ gcloud config set compute/region ${FC_REGION}
   $ gcloud config set compute/zone ${FC_ZONE}
   ```

1. The next step is to create a VM image able to run nested KVM (as outlined
   [here](https://cloud.google.com/compute/docs/instances/nested-virtualization/enabling)).

1. Now we create the VM:

   Keep in mind that you will need an instance type that supports nested
   virtualization. `E2` and `N2D` instances will not work. If you want to use a
   `N1` instance (default in some regions), make sure it uses at least a
   processor of the `Haswell` architecture by specifying
   `--min-cpu-platform="Intel Haswell"` when you create the instance.
   Alternatively, use `N2` instances (such as with
   `--machine-type="n2-standard-2"`).

   ```console
   $ FC_VM=firecracker-vm
   $ gcloud compute instances create ${FC_VM} --enable-nested-virtualization \
   --zone=${FC_ZONE} --min-cpu-platform="Intel Haswell" \
   --machine-type=n1-standard-2
   ```

1. Connect to the VM via SSH.

   ```console
   $ gcloud compute ssh ${FC_VM}
   ```

   When doing it for the first time, a key-pair will be created for you (you
   will be propmpted for a passphrase - can just keep it empty) and uploaded to
   GCE. Done! You should see the prompt of the new VM:

   ```console
   [YOUR_USER_NAME]@firecracker-vm:~$
   ```

1. Verify that VMX is enabled, enable KVM

   ```console
   $ grep -cw vmx /proc/cpuinfo
   1
   $ apt-get update
   $ apt-get install acl
   $ sudo setfacl -m u:${USER}:rw /dev/kvm
   $ [ -r /dev/kvm ] && [ -w /dev/kvm ] && echo "OK" || echo "FAIL"
   OK
   ```

Depending on your machine you will get a different number, but anything except 0
means `KVM` is enabled.

Now you can continue with the Firecracker [Getting Started](getting-started.md)
instructions to install and configure Firecracker in the new VM.

#### Addendum

##### Setting up a Google Cloud Platform account

In a nutshell, setting up a GCP account involves the following steps:

1. Log in to GCP [console](https://console.cloud.google.com/) with your Google
   credentials. If you don't have account, you will be prompted to join the
   trial.

1. Install GCP CLI & SDK (full instructions can be found
   [here](https://cloud.google.com/sdk/docs/quickstart-debian-ubuntu)).

   ```console
   $ export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)"
   $ echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" \
   | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
   $ curl https://packages.cloud.google.com/apt/doc/apt-key.gpg \
   | sudo apt-key add -
   $ sudo apt-get update && sudo apt-get install -y google-cloud-sdk
   ```

1. Configure the `gcloud` CLI by running:

   ```console
   $ gcloud init --console-only
   ```

   Follow the prompts to authenticate (open the provided link, authenticate,
   copy the token back to console) and select the default project.

### Microsoft Azure

`[TODO]`
