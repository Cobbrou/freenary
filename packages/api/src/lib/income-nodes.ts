const TOP_INCOME_SOURCES = 10;

export interface IncomeNode {
  name: string | null;
  value: number;
}

export const incomeSourceOf = ({
  counterpartyName,
}: {
  counterpartyName: string | null;
}): string | null => counterpartyName;

export const incomeNodesOf = (
  incomeSources: Map<string | null, number>
): IncomeNode[] => {
  const incomeByDescendingValue = [...incomeSources.entries()].toSorted(
    (a, b) => b[1] - a[1]
  );

  const incomeNodes = incomeByDescendingValue
    .slice(0, TOP_INCOME_SOURCES)
    .map(([name, value]) => ({ name, value }));

  const incomeBeyondTopSources = incomeByDescendingValue
    .slice(TOP_INCOME_SOURCES)
    .reduce((sum, [, value]) => sum + value, 0);

  if (incomeBeyondTopSources > 0) {
    const existing = incomeNodes.find((n) => n.name === null);

    if (existing) {
      existing.value += incomeBeyondTopSources;
    } else {
      incomeNodes.push({
        name: null,
        value: incomeBeyondTopSources,
      });
    }
  }

  return incomeNodes;
};
