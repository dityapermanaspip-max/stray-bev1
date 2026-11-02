import type pg from 'pg';

// Live battle snapshots (battle.battles, battle.battle_entities). The fight runs in memory; the snapshot is
// written at the start and every few seconds, and removed in the end-of-battle transaction.

export type FighterSnapshot = { entityId: string; atb: number; hp: number; stamina: number; mana: number; slot: number; downed: boolean };

export async function createBattleRow(pool: pg.Pool, roundId: string, state: object): Promise<string> {
  const res = await pool.query<{ id: string }>('INSERT INTO battle.battles (round_id, state) VALUES ($1, $2) RETURNING id', [roundId, state]);
  return res.rows[0].id;
}

export async function snapshotBattle(pool: pg.Pool, battleId: string, state: object, fighters: FighterSnapshot[]): Promise<void> {
  await pool.query('UPDATE battle.battles SET state = $2, updated_at = now() WHERE id = $1', [battleId, state]);
  for (const f of fighters) {
    await pool.query(
      `INSERT INTO battle.battle_entities (battle_id, entity_id, atb, hp, stamina, mana, slot, downed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (battle_id, entity_id) DO UPDATE SET atb = EXCLUDED.atb, hp = EXCLUDED.hp,
         stamina = EXCLUDED.stamina, mana = EXCLUDED.mana, slot = EXCLUDED.slot, downed = EXCLUDED.downed`,
      [battleId, f.entityId, f.atb, Math.max(0, f.hp), Math.max(0, f.stamina), Math.max(0, f.mana), f.slot, f.downed],
    );
  }
}

export async function deleteBattle(client: pg.Pool | pg.PoolClient, battleId: string): Promise<void> {
  await client.query('DELETE FROM battle.battles WHERE id = $1', [battleId]);
}

// Battles are not resumed after a restart yet: stale snapshots are cleared when the game server starts.
export async function clearBattles(pool: pg.Pool): Promise<number> {
  const res = await pool.query('DELETE FROM battle.battles');
  return res.rowCount ?? 0;
}
