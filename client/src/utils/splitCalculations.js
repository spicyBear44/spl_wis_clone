function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function distributeEvenly(totalCents, memberIds) {
  const baseCents = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - baseCents * memberIds.length;

  return memberIds.map((memberId, index) => ({
    user: memberId,
    cents: baseCents + (index < remainder ? 1 : 0)
  }));
}

function distributeByWeight(totalCents, weightedItems) {
  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  if (!totalCents || !totalWeight) {
    return weightedItems.map((item) => ({ user: item.user, cents: 0 }));
  }

  const shares = weightedItems.map((item, index) => {
    const weightedCents = totalCents * item.weight;
    return {
      user: item.user,
      index,
      cents: Math.floor(weightedCents / totalWeight),
      remainder: weightedCents % totalWeight
    };
  });
  const allocatedCents = shares.reduce((sum, share) => sum + share.cents, 0);
  let remainingCents = totalCents - allocatedCents;

  [...shares]
    .sort((first, second) => second.remainder - first.remainder || first.index - second.index)
    .forEach((share) => {
      if (remainingCents <= 0) return;
      share.cents += 1;
      remainingCents -= 1;
    });

  return shares.sort((first, second) => first.index - second.index).map(({ user, cents }) => ({ user, cents }));
}

export function splitEqually(totalAmount, memberIds) {
  return distributeEvenly(toCents(totalAmount), memberIds).map((split) => ({
    user: split.user,
    amount: fromCents(split.cents)
  }));
}

export function calculateProportionalTaxShares(taxAmount, itemSubtotals) {
  const taxCents = toCents(taxAmount);
  const weightedItems = itemSubtotals.map((item) => ({
    user: item.user,
    weight: toCents(item.amount)
  }));

  return distributeByWeight(taxCents, weightedItems);
}

export function buildExactSplitsWithProportionalTax({ subtotalAmount, taxAmount, tipAmount, memberIds, exactShares }) {
  const subtotalCents = toCents(subtotalAmount);
  const itemSubtotals = memberIds.map((memberId) => ({
    user: memberId,
    amount: Number(exactShares[memberId] || 0),
    cents: toCents(exactShares[memberId] || 0)
  }));
  const exactSubtotalCents = itemSubtotals.reduce((sum, item) => sum + item.cents, 0);

  if (itemSubtotals.some((item) => item.amount < 0)) {
    throw new Error("Exact item amounts cannot be negative.");
  }
  if (exactSubtotalCents !== subtotalCents) {
    throw new Error("Exact item amounts must add up to the subtotal before tax and tip.");
  }

  // Exact split item amounts are pre-tax subtotals. Tax follows the food subtotal proportion,
  // while tip defaults to an even split; cent remainders are assigned so totals match the bill.
  const taxShares = calculateProportionalTaxShares(taxAmount, itemSubtotals);
  const tipShares = distributeEvenly(toCents(tipAmount), memberIds);

  return itemSubtotals.map((item, index) => ({
    user: item.user,
    itemAmount: fromCents(item.cents),
    amount: fromCents(item.cents + taxShares[index].cents + tipShares[index].cents)
  }));
}
