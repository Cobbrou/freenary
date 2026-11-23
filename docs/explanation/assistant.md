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
- The assistant still works in a browser that has WebGPU, the browser interface for the graphics card. A member who has not picked a model gets Qwen3 4B on this device, or the smallest model in the list when Qwen3 4B is missing from it. **Ask** names that model above the question box, and the model menu lists the other models under **On this device**.
- Nothing downloads until the member asks a first question, in **Ask**, from **Home**, from the command menu or from the bar that changes a dashboard. The model then downloads once from Hugging Face, the model menu shows the progress, and the question is sent when the model is loaded. From then on the browser remembers the model like a model picked in the menu: it loads when the member opens **Ask** or a dashboard, and it stays the member's choice after the operator sets a server model.
- In a browser without WebGPU, the bar that changes a dashboard reads **Use a browser with WebGPU, or set up an assistant model, to change dashboards**, and **Ask** shows **This browser has no WebGPU, which the assistant needs to run a model on this device. Use a current Chrome, Edge or Safari, or ask the operator to turn the assistant on in Settings › Services.**

## Related

- [Enable the assistant](../how-to/enable-the-assistant.md)
- [Configuration](../reference/configuration.md#assistant)
