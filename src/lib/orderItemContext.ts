export interface OrderItemNameSnapshot {
  product_name?: string | null;
}

export const getOrderItemNames = (items: OrderItemNameSnapshot[] | null | undefined) =>
  (items || [])
    .map((item) => item.product_name?.trim())
    .filter((name): name is string => Boolean(name));

export const formatOrderPlacedMessage = (
  orderReference: string,
  items: OrderItemNameSnapshot[] | null | undefined,
) => {
  const names = getOrderItemNames(items);
  const baseMessage = `Order ${orderReference} has been placed successfully`;

  if (names.length === 0) return `${baseMessage}!`;
  if (names.length === 1) return `${baseMessage} for ${names[0]}.`;
  if (names.length === 2) return `${baseMessage} for ${names[0]} and ${names[1]}.`;
  return `${baseMessage} for ${names[0]} and ${names.length - 1} other items.`;
};
