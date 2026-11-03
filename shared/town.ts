// Town and status window messages (Step 3). The backend owns these types; the client imports them.
// Numbers only for money and counts; body and load as tier words.

// Server -> client 'service' when the player stops on a door (and again after each action there).
export type ServiceView = {
  service: string; // inn | shop | cook | woodworker | tanner | temple | guild | trainer
  name: string;
  text: string | null; // what the player hears at the door (closed doors, refusals, results)
  inn: { price: number } | null; // copper
  shop: {
    offers: { ref: string; name: string; qty: number; price: number }[]; // what the shop pays for one, in copper
    wares: { key: string; name: string; qty: number; price: number }[]; // the shelf: count and price for one
    haggle: boolean; // the keeper is open to a haggle (one try per visit)
  } | null;
  craft: {
    recipes: { name: string; outputs: { name: string; qty: number }[]; inputs: { name: string; qty: number; have: number }[]; fee: number }[];
  } | null; // what this craftsman makes here; fee in copper
  purse: number; // copper carried
};

// Client -> server 'service': act at the door the player stands on.
export type ServiceRequest =
  | { action: 'rest' }
  | { action: 'sell'; ref: string; generous?: boolean } // generous: take less than the price
  | { action: 'buy'; key: string; generous?: boolean } // generous: pay more than the price
  | { action: 'haggle' }
  | { action: 'craft'; name: string };

export type Word = { tier: number; text: string | null };

// room.request('status') answers with this; the same shape comes back after 'loadout' and 'gear'.
export type StatusPanel = {
  body: { resource: string; tier: number; text: string | null }[];
  slots: { slot: number; move: string | null }[];
  moves: { move: string; name: string; mastery: number; slot: number | null; isNew: boolean }[];
  bag: {
    load: Word;
    slots: { slot: string; label: string | null; accepts: string; item: string | null }[]; // label: the slot's name; accepts: what fits it
    items: { ref: string; item: string; name: string; qty: number; slot: string | null; wearable: boolean; fits: string | null; edible: boolean; droppable: boolean; condition: number | null; freshness: Word | null }[];
  } | null;
  who: string | null; // a companion's name when this is their window (read only), else null
  formation: { slot: number; front: number; back: number }; // own battle slot: 1..front is the front row, then the back row
  canSwap: boolean; // inside a town's safe square (or the testing flag)
  line: string | null; // a refusal or a remark after the last change
};

// Client -> server requests (answered with StatusPanel). move null empties the slot.
export type LoadoutRequest = { slot: number; move: string | null };
export type GearRequest = { wear: string; slot?: string } | { remove: string }; // wear: a bag ref; remove: a gear slot
export type FormationRequest = { slot: number }; // a battle slot; town only, like loadout changes
export type EatRequest = { ref: string }; // a bag ref; answered with StatusPanel (its line says how it went)
export type DropRequest = { ref: string; qty: number }; // throw away qty of a bag ref (not worn, never a key); answered with StatusPanel

// room.request('party'): the companions with you. open: your bond is deep enough to look at their window.
export type PartyView = { members: { id: string; name: string; bond: string | null; open: boolean }[] };
export type CompanionRequest = { id: string }; // answered with their StatusPanel (read only), or null when the bond is too thin
