/**
 * Dev-only runtime state (NOT persisted). Toggled from the ERD dev panel on the
 * title screen. Read by gameplay scenes/entities to apply developer conveniences
 * like god mode. Never gates real gameplay.
 */
export const devState = {
  /** invulnerability — applied to the player on spawn */
  god: false,
  /** free-fly / noclip — float through a level ignoring gravity + collision */
  fly: false,
};
