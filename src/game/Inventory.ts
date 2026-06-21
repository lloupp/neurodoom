import { WEAPONS, type WeaponId } from './Player';

export const HOT_SLOTS = 12;
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'shotgun', 'pulse_rifle'];

/** Renders the 12 hot-item slots + weapon slots (SPEC 4.5) into the inventory panel's slot grid. */
export function renderInventory(container: HTMLElement, snapshot: { inventory: string[]; weapon: WeaponId }): void {
  container.innerHTML = '';
  for (let i = 0; i < HOT_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const item = snapshot.inventory[i];
    slot.textContent = item ? item.slice(0, 3).toUpperCase() : '';
    container.appendChild(slot);
  }
  for (const id of WEAPON_ORDER) {
    const slot = document.createElement('div');
    slot.className = 'slot weapon-slot';
    slot.dataset.weapon = id;
    slot.textContent = WEAPONS[id].name.split(' ')[0]!.slice(0, 6).toUpperCase();
    slot.classList.toggle('active', snapshot.weapon === id);
    container.appendChild(slot);
  }
}
