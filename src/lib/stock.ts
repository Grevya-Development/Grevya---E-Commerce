import { supabase } from '@/lib/supabaseClient';

export interface SellableVariant {
  id: string;
  sku?: string;
  attributes?: Record<string, unknown>;
  stock: number;
}

export interface ProductStockDetails {
  productStock: number;
  variants: SellableVariant[];
}

const asStock = (value: unknown) => Math.max(0, Number(value) || 0);

/**
 * Resolves stock from the current catalog record. Variant inventory always
 * takes precedence over the product-level legacy stock field.
 */
export async function getProductStockDetails(productId: number): Promise<ProductStockDetails> {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('stock')
    .eq('id', productId)
    .single();
  if (productError) throw productError;

  const { data: rawVariants, error: variantsError } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true);
  if (variantsError) throw variantsError;

  const variants = (rawVariants || []) as Array<Record<string, unknown>>;
  const variantIds = variants.map((variant) => String(variant.id));
  const inventoryByVariant = new Map<string, number>();

  if (variantIds.length > 0) {
    const { data: inventory } = await supabase
      .from('inventory')
      .select('variant_id, quantity_on_hand, quantity_reserved')
      .in('variant_id', variantIds);

    (inventory || []).forEach((row: any) => {
      const available = asStock(row.quantity_on_hand) - asStock(row.quantity_reserved);
      inventoryByVariant.set(
        String(row.variant_id),
        (inventoryByVariant.get(String(row.variant_id)) || 0) + Math.max(0, available),
      );
    });
  }

  return {
    productStock: asStock(product?.stock),
    variants: variants.map((variant) => {
      const id = String(variant.id);
      const inventoryStock = inventoryByVariant.get(id);
      // Some legacy deployments store stock directly on product_variants.
      // Never fall back to parent stock when there are multiple variants.
      const directStock = variant.stock ?? variant.inventory ?? variant.quantity;
      const stock = inventoryStock ?? (directStock !== undefined
        ? asStock(directStock)
        : variants.length === 1 ? asStock(product?.stock) : 0);
      return {
        id,
        sku: typeof variant.sku === 'string' ? variant.sku : undefined,
        attributes: (variant.attributes || {}) as Record<string, unknown>,
        stock,
      };
    }),
  };
}

export async function getAvailableStock(productId: number, variantId?: string): Promise<number> {
  const details = await getProductStockDetails(productId);
  if (details.variants.length > 0) {
    const variant = variantId
      ? details.variants.find((item) => item.id === variantId)
      : details.variants.length === 1 ? details.variants[0] : undefined;
    return variant?.stock ?? 0;
  }
  return details.productStock;
}
