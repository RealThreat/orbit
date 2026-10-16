// Optional PostgreSQL/WASM validation; never connects to a real user database.
// npm install --prefix .cache/orbit-db-check --no-package-lock --ignore-scripts @electric-sql/pglite
// node scripts/check-orbit-rls.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(
  pathToFileURL(
    path.resolve(
      process.env.ORBIT_PGLITE_MODULE ??
        ".cache/orbit-db-check/node_modules/@electric-sql/pglite/dist/index.js"
    )
  ).href
);
const db = await PGlite.create();
try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  `);
  await db.exec(
    await fs.readFile(
      "supabase/migrations/202610160001_orbit_accounts.sql",
      "utf8"
    )
  );
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  await db.query(
    "insert into auth.users(id,raw_user_meta_data) values ($1,$2),($3,$4)",
    [a, { display_name: "Alex" }, b, { display_name: "Sam" }]
  );
  const actAs = async (id) => {
    await db.exec("reset role; set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  await actAs(a);
  assert.deepEqual(
    (await db.query("select id,display_name from public.orbit_profiles")).rows,
    [{ id: a, display_name: "Alex" }]
  );
  const payload = [
    {
      shop: "steam",
      objectId: "10",
      title: "Demo",
      owner_id: b,
      id: b,
      playTimeInMilliseconds: 1000,
    },
  ];
  const created = (
    await db.query("select * from public.orbit_merge_games($1::jsonb)", [
      JSON.stringify(payload),
    ])
  ).rows[0];
  assert.equal(created.owner_id, a);
  assert.notEqual(created.id, b);
  await db.query("select * from public.orbit_merge_games($1::jsonb)", [
    JSON.stringify([{ shop: "steam", objectId: "10", isFavorite: true }]),
  ]);
  const timed = (
    await db.query(
      "select * from public.orbit_add_playtime('steam','10',12,now())"
    )
  ).rows[0];
  assert.equal(timed.payload.playTimeInMilliseconds, 13000);
  assert.equal(timed.payload.isFavorite, true);
  assert.equal(timed.payload.title, "Demo");
  await assert.rejects(
    db.query(
      "insert into public.orbit_games(owner_id,shop,object_id) values ($1,'steam','victim')",
      [b]
    )
  );
  await assert.rejects(
    db.query("update public.orbit_profiles set created_at=now() where id=$1", [
      a,
    ])
  );
  await actAs(b);
  assert.equal(
    (await db.query("select * from public.orbit_games")).rows.length,
    0
  );
  assert.equal(
    (
      await db.query(
        "update public.orbit_games set payload='{}' where id=$1 returning *",
        [created.id]
      )
    ).rows.length,
    0
  );
  assert.equal(
    (
      await db.query("delete from public.orbit_games where id=$1 returning *", [
        created.id,
      ])
    ).rows.length,
    0
  );
  assert.equal(
    (
      await db.query(
        "select * from public.orbit_add_playtime('steam','10',12,now())"
      )
    ).rows.length,
    0
  );
  await db.exec("reset role; set role anon;");
  await assert.rejects(db.query("select * from public.orbit_profiles"));
  await assert.rejects(db.query("select * from public.orbit_games"));
  await assert.rejects(
    db.query("select * from public.orbit_merge_games('[]')")
  );
  await actAs(a);
  assert.equal(
    (await db.query("select payload from public.orbit_games")).rows[0].payload
      .playTimeInMilliseconds,
    13000
  );
  console.log(
    "Orbit migration, profile trigger, atomic library merge/playtime, anonymous denial and two-user RLS isolation passed (local PostgreSQL/WASM)."
  );
} finally {
  await db.close();
}
