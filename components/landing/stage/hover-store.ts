// Tiny mutable bridge between the DOM panels and the 3D stage: a panel sets
// the id of the set piece under the pointer, the scene reads it every frame
// and lifts that piece. No React state — this changes at pointer speed.
export const panelHover: { id: string | null } = { id: null }
