---
title: How the assistant finds a model
description: Where the assistant's answers come from, with and without a model on the server.
---

The assistant behind **Ask** needs a language model. It can use a model the server calls, which the operator sets with `AI_BASE_URL` and `AI_MODEL`, or a model that runs in the member's browser. This page describes what each member gets in each case, as `packages/api/src/assistant` and `apps/web/src/features/assistant-chat` do it. To connect a server model, see [Enable the assistant](../how-to/enable-the-assistant.md).

## With a server model

- The model menu in **Ask** lists the server model under **On your instance**. Questions go to the server's `/ai/chat` route, which calls the endpoint in `AI_BASE_URL` with the model in `AI_MODEL`.
- A member who has never picked a model gets the server model. A member who picked a model under **On this device** keeps that choice: the browser remembers it in local storage.

## Without a server model

- The server's chat route `/ai/chat` answers `503` with the body `unconfigured`, and the model menu in **Ask** has no **On your instance** entry.
- Each member can still run a model in the browser. In **Ask**, the model menu lists models under **On this device** when the browser has WebGPU, the browser interface for the graphics card. The model downloads once from Hugging Face and runs on that device.
- In a browser without WebGPU, **Ask** shows **This browser has no WebGPU, which the assistant needs to run a model on this device. Use a current Chrome, Edge or Safari, or ask the operator to turn the assistant on in Settings › Connections.**

## Related

- [Enable the assistant](../how-to/enable-the-assistant.md)
- [Configuration](../reference/configuration.md#assistant)
