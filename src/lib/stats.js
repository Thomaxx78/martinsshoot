export function contributionStats(shoots) {
  const amounts = shoots
    .map((shoot) => Number(shoot.amount))
    .filter((amount) => amount > 0)
    .sort((a, b) => a - b);
  if (!amounts.length) return null;
  const percentile = (fraction) =>
    amounts[
      Math.min(
        amounts.length - 1,
        Math.floor(fraction * (amounts.length - 1) + 0.5),
      )
    ];
  return {
    amounts,
    average: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
    median: percentile(0.5),
    low: percentile(0.2),
    high: percentile(0.8),
  };
}

export function revenue(shoots, predicate = () => true) {
  return Number(
    shoots
      .filter(predicate)
      .reduce((sum, shoot) => sum + (Number(shoot.amount) || 0), 0)
      .toFixed(2),
  );
}

export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
