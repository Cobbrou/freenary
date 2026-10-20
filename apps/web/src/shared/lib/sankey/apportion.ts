import type { SankeyLink } from "./layout";

export interface FlowEnd {
  id: string;
  value: number;
}

const UNMEASURABLE_TARGET_VALUE = 0;

const canContribute = (
  source: FlowEnd | undefined,
  remaining: number
): source is FlowEnd => source !== undefined && remaining > 0;

export const apportion = (
  sources: FlowEnd[],
  targets: FlowEnd[]
): SankeyLink[] => {
  const links: SankeyLink[] = [];
  let sourceIndex = 0;
  let remainingInSource = sources[0]?.value ?? 0;

  for (const target of targets) {
    let unfilled = Number.isFinite(target.value)
      ? target.value
      : UNMEASURABLE_TARGET_VALUE;

    while (unfilled > 0 && sourceIndex < sources.length) {
      const source = sources[sourceIndex];

      if (!canContribute(source, remainingInSource)) {
        sourceIndex += 1;
        remainingInSource = sources[sourceIndex]?.value ?? 0;

        continue;
      }

      const taken = Math.min(unfilled, remainingInSource);
      links.push({ source: source.id, target: target.id, value: taken });
      unfilled -= taken;
      remainingInSource -= taken;
    }
  }

  return links;
};
