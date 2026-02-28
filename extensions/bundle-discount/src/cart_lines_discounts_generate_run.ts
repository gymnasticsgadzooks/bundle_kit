import {
  DiscountClass,
  OrderDiscountCandidate,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
  ProductDiscountCandidate
} from '../generated/api';

interface ActiveBundleConfig {
  id: string;
  title: string;
  type: 'FBT' | 'VOLUME' | 'MIX_MATCH' | 'CLASSIC';
  priority?: number;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';
  discountValue: number;
  targetQuantity?: number;
  targetQuantityMax?: number;
  stacksWithOthers?: boolean;
  items: Array<{
    variantId?: string;
    productId: string;
    requiredQuantity: number;
    options?: any[];
  }>;
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );
  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasOrderDiscountClass && !hasProductDiscountClass) {
    return { operations: [] };
  }

  const activeBundlesJson = input.discount.metafield?.value;
  if (!activeBundlesJson) {
    return { operations: [] };
  }

  let activeBundles: ActiveBundleConfig[] = [];
  try {
    const parsed = JSON.parse(activeBundlesJson);
    // Per-node config is a single object; wrap in array for compatibility
    activeBundles = Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return { operations: [] };
  }

  // Create a pool of cart item quantities that we can reserve per phase.
  const cartPool = input.cart.lines.map(line => {
    let variantId = '';
    let productId = '';
    let handle = '';
    if (line.merchandise.__typename === 'ProductVariant') {
      variantId = line.merchandise.id;
      productId = line.merchandise.product.id;
      handle = line.merchandise.product.handle;
    }
    return {
      lineId: line.id,
      variantId,
      productId,
      handle,
      quantityRemaining: line.quantity,
      pricePerItem: parseFloat(line.cost.subtotalAmount.amount) / line.quantity
    };
  });

  const estimateBundleSavings = (
    bundle: ActiveBundleConfig,
    poolSnapshot: typeof cartPool,
  ): number => {
    if (bundle.discountType === 'FIXED_AMOUNT') {
      return bundle.discountValue;
    }

    let sumOfOriginalPrices = 0;
    // For MIX_MATCH / VOLUME, the actual match uses `targetQuantity` and takes
    // quantities from the cart pool in line order. Mirror that here so the
    // ranking/tiebreak is based on the real claimable amount.
    if (bundle.type === 'MIX_MATCH' || bundle.type === 'VOLUME') {
      const targetQty = bundle.targetQuantity || 0;
      if (targetQty <= 0) return 0;
      const eligibleProductIds = new Set(bundle.items.map(i => i.productId));
      let quantityNeeded = targetQty;
      if (bundle.type === 'VOLUME') {
        let totalAvailable = 0;
        for (const poolItem of poolSnapshot) {
          if (poolItem.quantityRemaining > 0 && eligibleProductIds.has(poolItem.productId)) {
            totalAvailable += poolItem.quantityRemaining;
          }
        }
        // VOLUME with targetQuantityMax: tier only applies when qty is in range
        if (bundle.targetQuantityMax != null) {
          if (totalAvailable < targetQty || totalAvailable > bundle.targetQuantityMax) return 0;
          quantityNeeded = Math.min(totalAvailable, bundle.targetQuantityMax);
        } else {
          quantityNeeded = totalAvailable;
        }
        if (quantityNeeded < targetQty) return 0;
      }
      let qtyRemaining = quantityNeeded;
      for (const poolItem of poolSnapshot) {
        if (qtyRemaining === 0) break;
        if (poolItem.quantityRemaining > 0 && eligibleProductIds.has(poolItem.productId)) {
          const qtyToTake = Math.min(qtyRemaining, poolItem.quantityRemaining);
          qtyRemaining -= qtyToTake;
          sumOfOriginalPrices += poolItem.pricePerItem * qtyToTake;
        }
      }
      if (qtyRemaining > 0) return 0;
    } else {
      for (const reqItem of bundle.items) {
        const poolItem = poolSnapshot.find(p => p.productId === reqItem.productId);
        if (poolItem) {
          sumOfOriginalPrices += poolItem.pricePerItem * reqItem.requiredQuantity;
        }
      }
    }

    if (bundle.discountType === 'PERCENTAGE') {
      return sumOfOriginalPrices * (bundle.discountValue / 100);
    } else if (bundle.discountType === 'FIXED_PRICE') {
      const savings = sumOfOriginalPrices - bundle.discountValue;
      return savings > 0 ? savings : 0;
    }

    return 0;
  };

  const sortBundles = (bundles: ActiveBundleConfig[]): ActiveBundleConfig[] => {
    return bundles
      .map(bundle => ({
        ...bundle,
        effectiveSavings: estimateBundleSavings(bundle, cartPool),
      }))
      .sort((a, b) => {
        const aPriority = a.priority || 0;
        const bPriority = b.priority || 0;
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        return b.effectiveSavings - a.effectiveSavings;
      });
  };

  const roundMoney = (value: number): number => Number(value.toFixed(2));

  const mergeMatches = (
    matches: Array<{ lineId: string; quantity: number; pricePerItem: number }>,
  ): Array<{ lineId: string; quantity: number; pricePerItem: number }> => {
    const byLine = new Map<string, { lineId: string; quantity: number; pricePerItem: number }>();
    for (const match of matches) {
      const existing = byLine.get(match.lineId);
      if (existing) {
        existing.quantity += match.quantity;
      } else {
        byLine.set(match.lineId, { ...match });
      }
    }
    return Array.from(byLine.values());
  };

  const computeReservedForLowerPriority = (
    currentBundle: ActiveBundleConfig,
    allBundles: ActiveBundleConfig[],
  ): Map<string, number> => {
    const currentPriority = currentBundle.priority ?? 0;
    const reserved = new Map<string, number>();
    for (const b of allBundles) {
      if ((b.priority ?? 0) >= currentPriority) continue;
      if (b.type !== 'FBT' && b.type !== 'CLASSIC') continue;
      for (const item of b.items) {
        reserved.set(
          item.productId,
          (reserved.get(item.productId) ?? 0) + item.requiredQuantity,
        );
      }
    }
    return reserved;
  };

  const canMatchWithReservation = (
    bundle: ActiveBundleConfig,
    reservedForProduct: Map<string, number>,
  ): boolean => {
    if (bundle.type !== 'MIX_MATCH' && bundle.type !== 'VOLUME') return true;
    const targetQty = bundle.targetQuantity || 0;
    if (targetQty === 0) return false;
    const eligibleProductIds = new Set(bundle.items.map(i => i.productId));
    let totalAvailable = 0;
    for (const p of cartPool) {
      if (eligibleProductIds.has(p.productId) && p.quantityRemaining > 0) {
        const reserved = reservedForProduct.get(p.productId) ?? 0;
        totalAvailable += Math.max(0, p.quantityRemaining - reserved);
      }
    }
    return totalAvailable >= targetQty;
  };

  const tryMatchBundle = (
    bundle: ActiveBundleConfig,
    reservedForProduct?: Map<string, number>,
  ): Array<{ lineId: string; quantity: number; pricePerItem: number }> | null => {
    const rawMatches: Array<{ lineId: string; quantity: number; pricePerItem: number }> = [];

    if (bundle.type === 'MIX_MATCH' || bundle.type === 'VOLUME') {
      const targetQty = bundle.targetQuantity || 0;
      if (targetQty === 0) {
        return null;
      }

      const eligibleProductIds = new Set(bundle.items.map(i => i.productId));
      const totalByProduct = new Map<string, number>();
      for (const p of cartPool) {
        if (eligibleProductIds.has(p.productId) && p.quantityRemaining > 0) {
          totalByProduct.set(p.productId, (totalByProduct.get(p.productId) ?? 0) + p.quantityRemaining);
        }
      }
      const maxTakeableByProduct = new Map<string, number>();
      let totalAvailable = 0;
      for (const [pid, total] of totalByProduct) {
        const reserved = reservedForProduct?.get(pid) ?? 0;
        const takeable = Math.max(0, total - reserved);
        maxTakeableByProduct.set(pid, takeable);
        totalAvailable += takeable;
      }

      // VOLUME with targetQuantityMax: tier only applies when qty is in range
      let quantityNeeded = targetQty;
      if (bundle.type === 'VOLUME') {
        if (bundle.targetQuantityMax != null) {
          if (totalAvailable < targetQty || totalAvailable > bundle.targetQuantityMax) return null;
          quantityNeeded = Math.min(totalAvailable, bundle.targetQuantityMax);
        } else {
          quantityNeeded = totalAvailable;
        }
        if (quantityNeeded < targetQty) return null;
      }

      const takenByProduct = new Map<string, number>();

      for (const poolItem of cartPool) {
        if (quantityNeeded === 0) break;
        if (poolItem.quantityRemaining > 0 && eligibleProductIds.has(poolItem.productId)) {
          const maxForProduct = maxTakeableByProduct.get(poolItem.productId) ?? 0;
          const takenSoFar = takenByProduct.get(poolItem.productId) ?? 0;
          const limitByReservation = Math.max(0, maxForProduct - takenSoFar);
          const qtyToTake = Math.min(
            quantityNeeded,
            poolItem.quantityRemaining,
            limitByReservation,
          );
          if (qtyToTake <= 0) continue;
          quantityNeeded -= qtyToTake;
          takenByProduct.set(poolItem.productId, takenSoFar + qtyToTake);
          rawMatches.push({
            lineId: poolItem.lineId,
            quantity: qtyToTake,
            pricePerItem: poolItem.pricePerItem,
          });
        }
      }

      return quantityNeeded === 0 ? mergeMatches(rawMatches) : null;
    }

    for (const reqItem of bundle.items) {
      let quantityNeeded = reqItem.requiredQuantity;
      for (const poolItem of cartPool) {
        if (quantityNeeded === 0) break;
        if (poolItem.quantityRemaining > 0 && poolItem.productId === reqItem.productId) {
          const qtyToTake = Math.min(quantityNeeded, poolItem.quantityRemaining);
          quantityNeeded -= qtyToTake;
          rawMatches.push({
            lineId: poolItem.lineId,
            quantity: qtyToTake,
            pricePerItem: poolItem.pricePerItem,
          });
        }
      }

      if (quantityNeeded > 0) {
        return null;
      }
    }

    return mergeMatches(rawMatches);
  };

  const reserveMatches = (matches: Array<{ lineId: string; quantity: number }>): void => {
    for (const match of matches) {
      const poolItem = cartPool.find(p => p.lineId === match.lineId);
      if (!poolItem) continue;
      poolItem.quantityRemaining -= match.quantity;
    }
  };

  const getDiscountAmount = (
    bundle: ActiveBundleConfig,
    originalPriceSum: number,
  ): number => {
    if (bundle.discountType === 'PERCENTAGE') {
      return originalPriceSum * (bundle.discountValue / 100);
    }
    if (bundle.discountType === 'FIXED_AMOUNT') {
      return bundle.discountValue;
    }
    if (bundle.discountType === 'FIXED_PRICE') {
      return Math.max(0, originalPriceSum - bundle.discountValue);
    }
    return 0;
  };

  const orderCandidates: OrderDiscountCandidate[] = [];
  const productCandidates: ProductDiscountCandidate[] = [];

  const nonVolumeBundles = sortBundles(activeBundles.filter(bundle => bundle.type !== 'VOLUME'));
  // Prefer emitting product discounts when available. In some checkout surfaces,
  // line-level discounts are consistently displayed/applied, while order-subtotal
  // discounts may not surface as expected.
  if (hasProductDiscountClass) {
    for (const bundle of nonVolumeBundles) {
      const reservedForProduct = computeReservedForLowerPriority(bundle, nonVolumeBundles);
      const useReservation =
        reservedForProduct.size > 0 &&
        canMatchWithReservation(bundle, reservedForProduct);
      while (true) {
        const matches = tryMatchBundle(bundle, useReservation ? reservedForProduct : undefined);
        if (!matches) break;

        reserveMatches(matches);
        const originalPriceSum = matches.reduce(
          (sum, match) => sum + (match.pricePerItem * match.quantity),
          0,
        );

        const targets = matches.map(match => ({
          cartLine: {
            id: match.lineId,
            quantity: match.quantity,
          },
        }));

        if (bundle.discountType === 'PERCENTAGE') {
          if (bundle.discountValue <= 0) continue;
          productCandidates.push({
            message: bundle.title,
            targets,
            value: {
              percentage: { value: bundle.discountValue },
            },
          });
          continue;
        }

        const discountAmount = roundMoney(getDiscountAmount(bundle, originalPriceSum));
        if (discountAmount <= 0) continue;

        productCandidates.push({
          message: bundle.title,
          targets,
          value: {
            fixedAmount: {
              amount: discountAmount,
              appliesToEachItem: false,
            },
          },
        });
      }
    }
  } else if (hasOrderDiscountClass) {
    for (const bundle of nonVolumeBundles) {
      while (true) {
        const matches = tryMatchBundle(bundle);
        if (!matches) break;

        reserveMatches(matches);
        const originalPriceSum = matches.reduce(
          (sum, match) => sum + (match.pricePerItem * match.quantity),
          0,
        );
        const discountAmount = roundMoney(getDiscountAmount(bundle, originalPriceSum));
        if (discountAmount <= 0) {
          continue;
        }

        orderCandidates.push({
          message: bundle.title,
          targets: [
            {
              orderSubtotal: {
                excludedCartLineIds: [],
              },
            },
          ],
          value: {
            fixedAmount: {
              amount: discountAmount,
              appliesToEachItem: false,
            },
          },
        });
      }
    }
  }

  const volumeBundles = sortBundles(activeBundles.filter(bundle => bundle.type === 'VOLUME'));
  if (hasProductDiscountClass) {
    for (const bundle of volumeBundles) {
      const reservedForProduct = new Map<string, number>();
      while (true) {
        const matches = tryMatchBundle(bundle, reservedForProduct);
        if (!matches) break;

        reserveMatches(matches);
        const targets = matches.map(match => ({
          cartLine: {
            id: match.lineId,
            quantity: match.quantity,
          },
        }));

        if (bundle.discountType === 'PERCENTAGE') {
          productCandidates.push({
            message: bundle.title,
            targets,
            value: {
              percentage: { value: bundle.discountValue },
            },
          });
        } else if (bundle.discountType === 'FIXED_AMOUNT') {
          productCandidates.push({
            message: bundle.title,
            targets,
            value: {
              fixedAmount: {
                amount: bundle.discountValue,
                appliesToEachItem: false,
              },
            },
          });
        } else if (bundle.discountType === 'FIXED_PRICE') {
          const originalPriceSum = matches.reduce(
            (sum, match) => sum + (match.pricePerItem * match.quantity),
            0,
          );
          const discountAmount = roundMoney(getDiscountAmount(bundle, originalPriceSum));
          if (discountAmount <= 0) {
            continue;
          }
          productCandidates.push({
            message: bundle.title,
            targets,
            value: {
              fixedAmount: {
                amount: discountAmount,
                appliesToEachItem: false,
              },
            },
          });
        }
      }
    }
  }

  if (orderCandidates.length === 0 && productCandidates.length === 0) {
    return { operations: [] };
  }

  const operations: CartLinesDiscountsGenerateRunResult['operations'] = [];

  // Order discount candidates don't support ALL strategy, so each candidate is
  // emitted as its own operation to preserve cumulative bundle behavior.
  for (const candidate of orderCandidates) {
    operations.push({
      orderDiscountsAdd: {
        candidates: [candidate],
        selectionStrategy: OrderDiscountSelectionStrategy.First,
      },
    });
  }

  if (productCandidates.length > 0) {
    operations.push({
      productDiscountsAdd: {
        candidates: productCandidates,
        selectionStrategy: ProductDiscountSelectionStrategy.All,
      },
    });
  }

  return { operations };
}