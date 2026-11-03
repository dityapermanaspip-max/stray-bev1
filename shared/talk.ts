// Talking to an NPC in a room (the backend owns these types; the client imports them). Words, not numbers: the bond
// is the tier's word, a price is money. The server sends only what the player may do now.

export type TalkAct = 'talk' | 'trade' | 'rest' | 'gift' | 'hire' | 'recruit' | 'pay' | 'dismiss';

// Server -> client 'talk' when the player stands beside an NPC, and the answer to each 'talk_act' request.
// text: what is said now (null: keep what was said). price: copper, for hire, pay and rest.
export type TalkView = {
  name: string;
  bond: string | null; // the word for how close they are (the first tier's word up to the last)
  text: string | null;
  options: { act: TalkAct; label: string; price: number | null }[];
  gifts: { item: string; name: string; qty: number }[]; // what the bag could give, once gifts are open
};

// Client -> server 'talk_act'. item: the bag item for a gift.
export type TalkRequest = { act: TalkAct; item?: string };
