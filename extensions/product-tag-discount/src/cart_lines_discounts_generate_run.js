import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from '../generated/api';

/** Tag prefix for dynamic order discount (e.g. discount:10 → 10%, discount:20 → 20%). */
const DISCOUNT_TAG_PREFIX = 'discount:';

/**
 * Parse order discount % from product's hasTags response.
 * Tags must start with "discount:" followed by a number (e.g. discount:20, discount:10).
 * @param {Array<{ tag: string, hasTag: boolean }>} [hasTags]
 * @returns {number | null} Percentage 0–100 or null if none found
 */
function getDiscountPercentFromTags(hasTags) {
  if (!Array.isArray(hasTags)) return null;
  let maxPercent = null;
  for (const { tag, hasTag } of hasTags) {
    if (!hasTag || !tag.startsWith(DISCOUNT_TAG_PREFIX)) continue;
    const value = tag.slice(DISCOUNT_TAG_PREFIX.length).trim();
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0 && num <= 100) {
      if (maxPercent === null || num > maxPercent) maxPercent = num;
    }
  }
  return maxPercent;
}

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );
  if (!hasOrderDiscountClass) {
    return { operations: [] };
  }

  let orderDiscountPercent = null;
  for (const line of input.cart.lines) {
    const product = line.merchandise?.product;
    if (!product?.hasTags) continue;
    const percent = getDiscountPercentFromTags(product.hasTags);
    if (percent !== null) {
      if (orderDiscountPercent === null || percent > orderDiscountPercent) {
        orderDiscountPercent = percent;
      }
    }
  }

  if (orderDiscountPercent === null || orderDiscountPercent === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        orderDiscountsAdd: {
          selectionStrategy: OrderDiscountSelectionStrategy.First,
          candidates: [
            {
              message: `${orderDiscountPercent}% off order`,
              targets: [
                {
                  orderSubtotal: {
                    excludedCartLineIds: [],
                  },
                },
              ],
              value: {
                percentage: {
                  value: orderDiscountPercent,
                },
              },
            },
          ],
        },
      },
    ],
  };
}