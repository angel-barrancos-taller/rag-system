export interface GoldenItem {
  id: string;
  question: string;
  /** Exact chunk ids ("path#name") or bare file paths ("path"). */
  relevantChunkIds: string[];
  referenceAnswer: string;
}

export const GOLDEN_DATASET: GoldenItem[] = [
  {
    id: "cart-total",
    question: "How is the cart total calculated?",
    relevantChunkIds: ["sample/cart.ts#Cart.getTotal"],
    referenceAnswer:
      "Cart.getTotal sums price multiplied by quantity over every item in the cart using reduce.",
  },
  {
    id: "add-item-merge",
    question:
      "What happens when an item with an existing sku is added to the cart?",
    relevantChunkIds: ["sample/cart.ts#Cart.addItem"],
    referenceAnswer:
      "Cart.addItem looks for an existing item with the same sku and increases its quantity instead of adding a duplicate entry.",
  },
  {
    id: "zero-quantity",
    question: "What happens if a quantity of zero is validated?",
    relevantChunkIds: ["sample/validation.ts#validateQuantity"],
    referenceAnswer:
      "validateQuantity throws a RangeError because quantities must be greater than zero.",
  },
  {
    id: "bulk-discount",
    question: "How do bulk discounts work and what are the thresholds?",
    relevantChunkIds: ["sample/discount.ts#calculateBulkDiscount"],
    referenceAnswer:
      "calculateBulkDiscount gives 20% off for 100+ units, 10% for 50+, 5% for 10+, and nothing below 10 units.",
  },
  {
    id: "reserve-stock",
    question: "How are items reserved against available stock?",
    relevantChunkIds: [
      "sample/inventory.ts#InventoryService.reserveItems",
      "sample/inventory.ts#InventoryService.checkStock",
    ],
    referenceAnswer:
      "InventoryService.reserveItems checks availability via checkStock and, if enough stock exists, decrements it and returns true; otherwise it returns false.",
  },
  {
    id: "cart-item-validation",
    question: "Which rules does a cart item have to satisfy to be valid?",
    relevantChunkIds: [
      "sample/validation.ts#validateCartItem",
      "sample/validation.ts#validateQuantity",
    ],
    referenceAnswer:
      "validateCartItem requires a sku, a non-negative price, and an integer quantity greater than zero (checked by validateQuantity).",
  },
  {
    id: "currency-formatting",
    question: "Which currency symbol is used for formatting prices?",
    // Bare file path: exercises the relaxed matching rule against the file's fallback chunk.
    relevantChunkIds: ["sample/format.ts"],
    referenceAnswer:
      "The formatting module uses the dollar sign ($) as its currency symbol.",
  },
  {
    id: "hard-refunds",
    // Deliberately unanswerable from the sample code: keeps metrics honest.
    question: "How are refunds processed after a payment failure?",
    relevantChunkIds: ["sample/cart.ts#Cart.removeItem"],
    referenceAnswer:
      "The indexed code does not implement refunds; the closest behavior is removing items from the cart.",
  },
];
