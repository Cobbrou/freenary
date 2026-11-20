import type { AppConfig } from "@mlc-ai/web-llm";

export interface BrowserModel {
  id: string;
  label: string;
  vramMb: number;
}

interface CatalogEntry {
  unquantisedId: string;
  label: string;
}

const CATALOG: readonly CatalogEntry[] = [
  { label: "Qwen3 1.7B", unquantisedId: "Qwen3-1.7B" },
  { label: "Qwen3 4B", unquantisedId: "Qwen3-4B" },
  { label: "Qwen3 8B", unquantisedId: "Qwen3-8B" },
  { label: "Qwen3.5 2B", unquantisedId: "Qwen3.5-2B" },
  { label: "Qwen3.5 4B", unquantisedId: "Qwen3.5-4B" },
  { label: "Qwen3.5 9B", unquantisedId: "Qwen3.5-9B" },
  { label: "Qwen2.5 3B", unquantisedId: "Qwen2.5-3B-Instruct" },
  { label: "Qwen2.5 7B", unquantisedId: "Qwen2.5-7B-Instruct" },
  { label: "Hermes 3 (Llama 3.2 3B)", unquantisedId: "Hermes-3-Llama-3.2-3B" },
  { label: "Hermes 3 (Llama 3.1 8B)", unquantisedId: "Hermes-3-Llama-3.1-8B" },
  { label: "Llama 3.2 3B", unquantisedId: "Llama-3.2-3B-Instruct" },
  { label: "Llama 3.1 8B", unquantisedId: "Llama-3.1-8B-Instruct" },
];

const WEBLLM_VRAM_MEASURED_AT_TOKENS = 4096;

const KV_KEYS_AND_VALUES = 2;
const LARGEST_CATALOG_LAYERS = 36;
const LARGEST_CATALOG_KV_HEADS = 8;
const LARGEST_CATALOG_HEAD_DIMENSIONS = 128;

const KV_VALUES_PER_TOKEN =
  KV_KEYS_AND_VALUES *
  LARGEST_CATALOG_LAYERS *
  LARGEST_CATALOG_KV_HEADS *
  LARGEST_CATALOG_HEAD_DIMENSIONS;

const MB = 1024 * 1024;

const F16_SUFFIX = "-q4f16_1-MLC";
const F32_SUFFIX = "-q4f32_1-MLC";
const F16_BYTES_PER_VALUE = 2;
const F32_BYTES_PER_VALUE = 4;

export const browserModelLabel = (id: string): string =>
  CATALOG.find((entry) => id.startsWith(`${entry.unquantisedId}-`))?.label ??
  id;

export const browserModels = (
  appConfig: AppConfig,
  f16: boolean,
  contextWindowSize: number
): BrowserModel[] => {
  const suffix = f16 ? F16_SUFFIX : F32_SUFFIX;
  const bytesPerValue = f16 ? F16_BYTES_PER_VALUE : F32_BYTES_PER_VALUE;
  const extraWindowMb =
    (Math.max(0, contextWindowSize - WEBLLM_VRAM_MEASURED_AT_TOKENS) *
      KV_VALUES_PER_TOKEN *
      bytesPerValue) /
    MB;

  const models: BrowserModel[] = [];

  for (const entry of CATALOG) {
    const id = `${entry.unquantisedId}${suffix}`;
    const record = appConfig.model_list.find(
      (candidate) => candidate.model_id === id
    );

    if (record) {
      models.push({
        id,
        label: entry.label,
        vramMb: Math.round((record.vram_required_MB ?? 0) + extraWindowMb),
      });
    }
  }

  return models.toSorted((a, b) => a.vramMb - b.vramMb);
};
