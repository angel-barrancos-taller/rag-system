/**
 * Bundled sample codebase for the evaluation suite. Kept as string constants
 * so the evaluate route can index them without file-system access.
 */

export interface SampleFile {
  path: string;
  content: string;
}

const cart = `export interface CartItem {
  sku: string;
  price: number;
  quantity: number;
}

export class Cart {
  private items: CartItem[] = [];

  addItem(item: CartItem): void {
    const existing = this.items.find((i) => i.sku === item.sku);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this.items.push({ ...item });
    }
  }

  removeItem(sku: string): void {
    this.items = this.items.filter((i) => i.sku !== sku);
  }

  getTotal(): number {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  applyDiscount(percentage: number): number {
    const total = this.getTotal();
    return total - (total * percentage) / 100;
  }
}
`;

const discount = `export function calculatePercentageDiscount(total: number, percentage: number): number {
  if (percentage < 0 || percentage > 100) {
    throw new RangeError("percentage must be between 0 and 100");
  }
  return (total * percentage) / 100;
}

export function calculateBulkDiscount(quantity: number, unitPrice: number): number {
  if (quantity >= 100) return quantity * unitPrice * 0.2;
  if (quantity >= 50) return quantity * unitPrice * 0.1;
  if (quantity >= 10) return quantity * unitPrice * 0.05;
  return 0;
}
`;

const inventory = `export class InventoryService {
  private stock = new Map<string, number>();

  setStock(sku: string, count: number): void {
    this.stock.set(sku, count);
  }

  checkStock(sku: string): number {
    return this.stock.get(sku) ?? 0;
  }

  reserveItems(sku: string, quantity: number): boolean {
    const available = this.checkStock(sku);
    if (available < quantity) {
      return false;
    }
    this.stock.set(sku, available - quantity);
    return true;
  }
}
`;

const validation = `import type { CartItem } from "./cart";

export function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity)) {
    throw new TypeError("quantity must be an integer");
  }
  if (quantity <= 0) {
    throw new RangeError("quantity must be greater than zero");
  }
}

export function validateCartItem(item: CartItem): void {
  if (!item.sku) {
    throw new Error("cart item requires a sku");
  }
  if (item.price < 0) {
    throw new RangeError("price cannot be negative");
  }
  validateQuantity(item.quantity);
}
`;

// Deliberately declaration-free: exercises the whole-file fallback chunk.
const format = `import { Cart } from "./cart";

const CURRENCY_SYMBOL = "$";
const DECIMAL_PLACES = 2;

export const formatPriceTag = CURRENCY_SYMBOL;
console.log("formatting module loaded with", DECIMAL_PLACES, "decimal places");
`;

export const SAMPLE_FILES: SampleFile[] = [
  { path: "sample/cart.ts", content: cart },
  { path: "sample/discount.ts", content: discount },
  { path: "sample/inventory.ts", content: inventory },
  { path: "sample/validation.ts", content: validation },
  { path: "sample/format.ts", content: format },
];
