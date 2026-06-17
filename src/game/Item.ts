export type ItemKind = 'key' | 'medkit' | 'ammo' | 'data' | 'keycard_red' | 'keycard_blue';

export interface ItemSnapshot {
  id: string;
  kind: ItemKind;
  position: { x: number; y: number };
  label: string;
  /** Item is consumed on pick up unless stackable. */
  stackable?: boolean;
}

export interface InventorySlot {
  item: ItemSnapshot | null;
}
