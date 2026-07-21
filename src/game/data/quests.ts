/**
 * Quest data for the connected top-down route.
 * QuestSystem walks these steps in order and feeds objective text to the HUD.
 */

export interface QuestStep {
  id: string;
  objective: string;
  hint?: string;
}

export interface QuestDef {
  id: string;
  name: string;
  zone: string;
  steps: QuestStep[];
}

export const THE_FIRST_CONTACT: QuestDef = {
  id: 'the-first-contact',
  name: 'The First Contact',
  zone: 'miller-field',
  steps: [
    { id: 'wake', objective: 'Reach the Miller Surface signal node.', hint: 'Move, aim, fire, dash, and scan from the same top-down controller.' },
    { id: 'scanTutorial', objective: 'Scan the marked ground for buried Scout signal.', hint: 'Scan reveals caches, route hints, and hidden signal traces.' },
    { id: 'destroyDrones', objective: 'Clear the drones around the field node.', hint: 'Kills near the node charge it faster.' },
    { id: 'reachDoor', objective: 'Enter the open breach toward Motel Circuit.', hint: 'Your health, weapons, inventory, flags, and save progress carry forward.' },
    { id: 'complete', objective: 'Miller Surface quieted. Continue east.', hint: 'Open the Command Center to review the route.' },
  ],
};

export const THE_LONG_NIGHT: QuestDef = {
  id: 'the-long-night',
  name: 'The Long Night',
  zone: 'motel-nowhere',
  steps: [
    { id: 'arrive', objective: 'Cross Motel Circuit and find the central node.', hint: 'Use parked cars, walls, and lit signs as cover.' },
    { id: 'powerDiner', objective: 'Charge the motel node by clearing the circuit lot.', hint: 'Chip’s SPARK frequency makes rapid-fire windows stronger.' },
    { id: 'bossFight', objective: 'Break the Vacancy Sign’s signal lock.', hint: 'Scan interrupts its read and creates a damage window.' },
    { id: 'complete', objective: 'Motel Circuit quieted. Follow the town road.', hint: 'The next route leads into Chagrin Falls.' },
  ],
};

export const FRIDAY_NIGHT_LIGHTS: QuestDef = {
  id: 'friday-night-lights',
  name: 'Friday Night Lights',
  zone: 'tiger-stadium',
  steps: [
    { id: 'enterStadium', objective: 'Move through Chagrin Falls town toward the field lights.', hint: 'Buildings are cover, route boundaries, and landmarks.' },
    { id: 'reachDugout', objective: 'Use ANCHOR safe zones to hold the node area.', hint: 'Green Scout markers reduce pressure and restore control.' },
    { id: 'bossFight', objective: 'Drop the Weather Balloon classifier.', hint: 'Dodge the telegraphed beam, then punish the exposed core.' },
    { id: 'complete', objective: 'Town route quieted. Take the orchard road.', hint: 'Henry’s file is no longer unknown.' },
  ],
};

export const THE_ENDLESS_HARVEST: QuestDef = {
  id: 'the-endless-harvest',
  name: 'The Endless Harvest',
  zone: 'pattersons-orchard',
  steps: [
    { id: 'enterOrchard', objective: "Enter Patterson's Orchard and locate the maze node.", hint: 'Rows, barns, fences, and crop marks shape the route.' },
    { id: 'maze', objective: 'Read the shifting maze and scan for Cameron’s markers.', hint: 'Purple ECHO traces point to caches and route memory.' },
    { id: 'bossFight', objective: 'Break the Harvest Pattern around the maze heart.', hint: 'Keep moving; the pattern punishes standing still.' },
    { id: 'complete', objective: 'Orchard route quieted. Follow the signal storm.', hint: 'Cameron’s file is no longer unknown.' },
  ],
};

export const THE_SKY_LISTENS: QuestDef = {
  id: 'the-sky-listens',
  name: 'The Sky Listens',
  zone: 'skyline-array',
  steps: [
    { id: 'enterSkyline', objective: 'Enter the Signal Storm and hold the final node.', hint: 'Every Scout frequency can matter here.' },
    { id: 'frequencies', objective: 'Survive the storm while the node charges.', hint: 'Use pickups, boons, scan, and overdrive aggressively.' },
    { id: 'bossFight', objective: 'Face the Listening Station and refuse the label.', hint: 'Change frequency when it mirrors you.' },
    { id: 'complete', objective: 'The broadcast ends. What does the radar read?', hint: 'Every Scout is home.' },
  ],
};

export const QUESTS: QuestDef[] = [THE_FIRST_CONTACT, THE_LONG_NIGHT, FRIDAY_NIGHT_LIGHTS, THE_ENDLESS_HARVEST, THE_SKY_LISTENS];

export function findQuest(id: string): QuestDef {
  return QUESTS.find((q) => q.id === id) ?? THE_FIRST_CONTACT;
}
