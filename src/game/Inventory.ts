import { WEAPONS, type WeaponId } from './Player';

export const HOT_SLOTS = 12;
export const WEAPON_SLOTS = 4; // SPEC 4.5: "12 hot + 4 weapon"
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'shotgun', 'pulse_rifle', 'rocket_launcher'];

/** Renders the 12 hot-item slots + 4 weapon slots (SPEC 4.5) into the inventory
 *  panel's slot grid. Filled hot slots are draggable to support drag-drop
 *  reorder; the grid's drag/drop listeners (HUD) read `data-slot-index`. */
export function renderInventory(container: HTMLElement, snapshot: { inventory: string[]; weapon: WeaponId }): void {
  container.innerHTML = '';
  for (let i = 0; i < HOT_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slotIndex = String(i);
    const item = snapshot.inventory[i];
    if (item) {
      slot.textContent = item.slice(0, 3).toUpperCase();
      slot.draggable = true;
      slot.classList.add('filled');
    }
    container.appendChild(slot);
  }
  for (let i = 0; i < WEAPON_SLOTS; i++) {
    const id = WEAPON_ORDER[i];
    const slot = document.createElement('div');
    slot.className = 'slot weapon-slot';
    if (id) {
      slot.dataset.weapon = id;
      slot.textContent = WEAPONS[id].name.split(' ')[0]!.slice(0, 6).toUpperCase();
      slot.classList.toggle('active', snapshot.weapon === id);
    } else {
      slot.classList.add('reserved');
      slot.textContent = '—';
    }
    container.appendChild(slot);
  }
}
