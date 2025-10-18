# Firecracker API 变更操作手册

本运行手册将涵盖 API 变更的分类处理及实施方法，
并指导如何恰当地实施这些变更。

## 定义

- _Deprecated_ - 我们将把已弃用的 API 元素（端点 和 /或端点的部分）视为仍然允许用户访问其支持的功能的元素，但在即将发布的版本中，该元素及其功能将很快被完全移除。
- _Mandatory endpoint_ - 如果 Firecracker 在不向其发出请求的情况下无法正常运行，我们将视该端点为必需。
- _Optional endpoint_ - 如果 Firecracker 在不对该端点发出请求的情况下仍能正常运行，并且其背后的功能不是必需的，我们将认为该端点是可选的。
- _Mandatory header/field_ - 如果在 HTTP 消息中未指定某个头部/字段请求就会失败，我们将视该头部/字段为必需。
- _Optional header/field_ - 如果请求在未指定该头部/字段的情况下仍能成功，我们将认为 HTTP 消息中的该头部/字段是可选的。

## 对 API 变更进行分类处理

本页面主要将 API 分为两类：
即 _breaking（破坏性）_ 与 _non-breaking（非破坏性）_ 。

### 什么是破坏性变更？

API 中的破坏性变更会导致该 API 与旧版本不兼容（向后不兼容）。为避免破坏性变更，我们可能采取弃用机制并递增次要版本号以保持向后兼容性，但破坏性变更最终必然导致主要版本号的递增。以下为此类变更的非详尽列表：

1. Adding a new mandatory endpoint/HTTP method.
1. Removing an endpoint/method.
1. Adding a mandatory request header/field.
1. Removing a request header/field.
1. Adding a mandatory response field.
1. Removing a response header/field.

### 什么不算破坏性变更？

A change in the API is not a breaking change if the version resulting from it is
compatible with the previous one (backwards compatible). The outcome of a
non-breaking change should always include incrementing the minor version but
must not lead to incrementing the major version by itself. Here is a
non-exhaustive list of such changes:

1. Deprecating an endpoint/method/field.
1. Adding a new optional endpoint/method.
1. Adding an optional request header/field.
1. Adding a response header.
1. Adding additional valid inputs for fields in API requests.
1. Making mandatory headers/fields optional.
1. Making mandatory endpoints optional.
1. Changing the URI of an endpoint.
1. Changing the metrics output format.

## API 变更的实现

API changes result in version increases. As Firecracker’s support policy is
based on [semantic versioning 2.0.0][1], we will look at API changes from this
point of view.

> Given a version number MAJOR.MINOR.PATCH, increment the: MAJOR version when
> you make incompatible API changes; MINOR version when you add functionality in
> a backwards compatible manner; PATCH version when you make backwards
> compatible bug fixes.

![Flowchart for changing the Firecracker API](images/api_change_flowchart.png?raw=true "Flowchart for changing the Firecracker API")

_All deprecated endpoints are supported until at least the next major version
release, where they may be *removed*._

### 如何使用流程图（附示例）

We will go through multiple types of API changes and provide ways to ensure we
don’t break our backwards compatibility promise to our customers. The list is
split into categories of components changed.

- _Entire endpoints_
  - Adding an optional endpoint with new functionality - Increment minor
    version.
  - Adding a command line parameter - Increment minor version.
  - Removing an endpoint - Deprecate endpoint and increment minor version →
    Remove endpoint when incrementing major version.
  - Adding a mandatory endpoint - Increment major version.
- _Request_
  - Adding an optional header/field - Increment minor version.
  - Renaming a header/field - Accept both names and deprecate the old one →
    Remove old name when incrementing major version.
  - Removing a header/field - Make said header/field optional → Remove
    header/field when incrementing major version.
  - Changing the URI of an endpoint - Redirect the old endpoint to the new one
    and deprecate the old one → Remove old endpoint when incrementing major
    version.
  - Adding a mandatory header/field - Increment major version.
- _Response_
  - Adding a header/field - Create a new, separate endpoint with the changes and
    deprecate the old one → Remove old endpoint when incrementing major version.
  - Removing a header/field - Create a new, separate endpoint with the changes
    and deprecate the old one → Remove old endpoint when incrementing major
    version.
- _Command line parameter_
  - Renaming a command line parameter - Accept both names and deprecate the old
    one → Remove old name when incrementing major version.
  - Changing expected value taken by a command line parameter - Accept both
    names and deprecate the old one → Remove old name when incrementing major
    version.

In case the outlined solution for your case is not feasible (e.g. because of
security concerns), break the glass and increment the major version.

## How to deprecate

As outlined in the diagram above, sometimes we have to deprecate endpoints
partially or entirely. In this section we will go through different situations
where we have to deprecate something and ways of avoiding common pitfalls when
doing so.

### Deprecating endpoints

Some paths in the flowchart above lead to deprecation. Based on the initial
conditions, there are 2 major cases where we need to deprecate an endpoint:

- _Changing an existing endpoint_
  - Often happens because directly changing the endpoint would be a breaking
    change.
  - We usually create a clone of the old endpoint we want to deprecate and make
    the necessary changes to it.
  - We usually expose both endpoints in the next minor version while marking the
    old one as deprecated.
  - The old endpoint retains its previous name. When naming the new endpoint:
    - for HTTP endpoints we follow a “per-endpoint versioning” scheme; in cases
      where we can’t find a fitting name for the new endpoint, the simplest way
      forward is to take the old URI and append `/v2` to it.
    - for command line endpoints, we can usually find a different name for the
      new endpoint.
- _Deprecating an endpoint without adding a replacement to it_
  - Often happens when we want to phase out a certain feature or functionality,
    but doing so immediately would be a breaking change.
  - We just mark the endpoint as deprecated.

### Keeping Swagger updated

Make sure that any changes you make in the code are also reflected in the
swagger specification.

Some tips:

- There is nothing in the swagger file that shows whether an endpoint is
  mandatory or optional, it’s all code logic.
- Mandatory fields in a request or response body are marked with
  `required: true` in the swagger definition. All other fields are optional.
- If you need to redirect an endpoint, you have to clone the old one under the
  new URI in the swagger specification.

### Marking endpoints as deprecated

When marking:

- an HTTP endpoint as deprecated:
  - Add a comment for the parsing function of the endpoint stating that it is
    deprecated.
  - Log a `warn!` message stating that the user accessed a deprecated endpoint.
  - Increment the `deprecatedHttpApi` metric.
  - Include the `Deprecated` header in the response.
- a header field in an HTTP endpoint as deprecated:
  - Add a comment in the parsing function where we check the presence of the
    header stating that it is deprecated.
  - If the header is present, log a `warn!` message stating that the user used a
    deprecated field.
  - Increment the `deprecatedHttpApi` metric.
  - Include the Deprecated header in the response.
- a command line parameter as deprecated:
  - Mention it is deprecated in the help message of the parameter in the
    argument parser.
  - Add it in the `warn_deprecated_parameters` function where we log it and
    increment the `deprecatedCmdLineApi` metric.

### Removing deprecated endpoints on a major release

When doing a major release, the API can have breaking changes. This is the _only
time_ where we can safely remove deprecated elements of the API. To remove a
deprecated element of the API:

- Remove the associated functionality from the codebase (usually in `vmm` or
  `mmds`);
- Remove the parsing logic in `api_server`;
- Remove any unit and integration tests associated with this element.

## Practical example of an API change

In this guide we set out to remove the `vsock_id` field in `PUT`s on `/vsock`.
This was implemented in [PR #2763][2] and we will go step by step through the
changes in order to understand the process of changing something in the
Firecracker API.

- We go through the flowchart; we want to remove a field in the body of a HTTP
  request. So we follow the flowchart like this:
  - → Change an existing endpoint
  - → Request
  - → Remove header or field
  - → Make it optional
  - → Deprecate
  - → Increment minor version.
- Now that we know we need to make the field optional and deprecate it, it’s
  time for the code changes (reference implementation in [this commit][3]). We
  go to the function in `api_server/src/requests` which is responsible for
  parsing this request, which is `parse_put_vsock` in this case, and do the
  following.
  - We find the associated `vmm_config` struct which `serde_json` uses for
    deserialization, in this case `VsockDeviceConfig`.
  - In the struct referenced above, we make the parameter optional by
    encapsulating it in an `Option` with `#[serde(default)]` and
    `#[serde(skip_serializing_if = "Option::is_none")]` so that we don’t break
    existing implementations, but we follow the new, desired usage of the
    endpoint.
  - After deserializing the body of the request into the struct, we check for
    the existence of the field we want to deprecate, in this case by calling
    `vsock_cfg.vsock_id.is_some()`.
  - If the field is there, we must mark this request as being deprecated, so we
    craft a deprecation message (`"PUT /vsock: vsock_id field is deprecated."`)
    and increment the deprecated HTTP API metric
    (`METRICS.deprecated_api.deprecated_http_api_calls.inc()`).
  - We create a new `ParsedRequest` where, if we marked the request as
    deprecated, we append the deprecation message into its `parsing_info`
    structure, in this case by calling
    `parsed_req.parsing_info().append_deprecation_message(msg)`.
  - Don’t forget to comment your code! Comments should reflect what is
    deprecated and clearly describe the code paths where you handle the
    deprecation case.
  - Add a unit test where you test your new code paths.
  - Fix all other failing unit tests.
  - Update the swagger file to reflect the change, in this case by removing the
    `vsock_id` field from the required parameter list in the `Vsock` definition
    and adding a description to it stating that it is deprecated since the
    current version.
  - Update any relevant documentation.
- We update the python integration tests to reflect the change (reference
  implementation in [this commit][4]).
  - We refactor the relevant `tests/integration_tests/functional/test_api.py`
    test to use the artifact model instead of the fixture one. If the test
    already uses the artifact model, you can skip this step.
  - We make sure to run the test with the current build, as well as with future
    Firecracker versions by specifying the unreleased version in the
    `min_version` parameter of `artifacts.firecrackers()`. We do this in order
    to ensure that, when we create patch releases on older branches, we test the
    API with future binaries to enforce backwards compatibility. _Disclaimer_:
    This test will fail when running with the binary artifact fetched from S3
    until you update the binary there with your current build. You should only
    do this once your PR has all necessary approves and this test is the last
    thing keeping it from getting merged.
  - We check that, when the deprecated field is present in the request, the
    `Deprecation` header is also present in the response by asserting
    `response.headers['deprecation']`. We do not also check that the header is
    not present when the field is not present because, in a future version, some
    other field may be deprecated in the same request and would return the
    header anyway, resulting in a fail in our test when it shouldn’t.
  - Fix all other failing integration tests.

[1]: https://semver.org/spec/v2.0.0.html
[2]: https://github.com/firecracker-microvm/firecracker/pull/2763
[3]: https://github.com/firecracker-microvm/firecracker/commit/83aa098245a42ad93a6b70ccd70ad593cf453a3c
[4]: https://github.com/firecracker-microvm/firecracker/commit/472a81dbccd89562578919b76d87c30ee7db17aa
