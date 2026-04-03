// Utility to move orders to trash instead of deleting them
export function moveToTrash(orderIds: string[]) {
  const existing: string[] = JSON.parse(localStorage.getItem('trash_order_ids') || '[]');
  const updated = [...new Set([...existing, ...orderIds])];
  localStorage.setItem('trash_order_ids', JSON.stringify(updated));
}

export function removeFromTrash(orderIds: string[]) {
  const existing: string[] = JSON.parse(localStorage.getItem('trash_order_ids') || '[]');
  const updated = existing.filter(id => !orderIds.includes(id));
  localStorage.setItem('trash_order_ids', JSON.stringify(updated));
}
