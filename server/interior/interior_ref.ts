// A small room inside a field: a town building (parent = the town, kind = its service) or a camp or cave in the
// wild (parent = the field, kind = camp | cave, node = the id of the field's node it hangs off). The ref is what the
// player's position stores: `<parent>~<kind>` or `<parent>~<kind>.<node>`.

export type InteriorRef = { parent: string; kind: string; node: number | null };

const SEP = '~';

export const interiorRef = (parent: string, kind: string, node: number | null = null) =>
  `${parent}${SEP}${kind}${node === null ? '' : `.${node}`}`;

export function parseInterior(ref: string): InteriorRef | null {
  const at = ref.indexOf(SEP);
  if (at <= 0) return null;
  const [kind, node] = ref.slice(at + 1).split('.');
  if (!kind) return null;
  const id = node === undefined ? null : Number(node);
  return id !== null && !Number.isInteger(id) ? null : { parent: ref.slice(0, at), kind, node: id };
}

// The field an interior hangs off (a plain field is its own).
export const baseRef = (ref: string) => parseInterior(ref)?.parent ?? ref;
