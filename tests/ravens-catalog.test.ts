import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ravensCatalog,
  ravensProfile,
  ravensMatchesGroup,
  RAVENS_PROFILE_REVISION,
} from "../src/ravens-catalog.ts";

test("35 kaynak oyunun numarası ve kimliği sabittir; tür isimden değil takım açıklamasından gelir", () => {
  assert.equal(ravensCatalog.length, 35);
  assert.equal(new Set(ravensCatalog.map((p) => p.id)).size, 35);
  assert.deepEqual(
    ravensCatalog.map((p) => p.number),
    Array.from({ length: 35 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    ravensCatalog.filter((p) => p.kind === "pass").map((p) => p.number),
    [1, 2, 3, 4, 5, 7, 15, 16, 17, 18, 22, 23, 25, 33],
  );
  assert.deepEqual(
    ravensCatalog.filter((p) => p.kind === "zone").map((p) => p.number),
    [6, 8, 20, 24, 27],
  );
  assert.match(ravensProfile(17).name, /OPTION/);
  assert.equal(ravensProfile(17).kind, "pass");
  assert.match(ravensProfile(19).name, /JET/);
  assert.equal(ravensProfile(19).kind, "trap3");
  assert.match(ravensProfile(15).name, /PERDE/);
  assert.equal(ravensProfile(15).kind, "pass");
});
test("özel çağrılar, field/boundary ayrımı ve Dart’ın mutlak sağ pull tercihi korunur", () => {
  for (const [n, kind] of [
    [10, "rollout"],
    [11, "speed-option"],
    [12, "gt-counter"],
    [13, "gt-counter"],
    [14, "dart"],
    [19, "trap3"],
    [21, "screen"],
    [26, "trap3"],
    [28, "ct-counter"],
    [29, "source-special"],
    [30, "gt-counter"],
    [31, "zone-lead"],
    [32, "pass-wrap"],
    [34, "trap5"],
    [35, "tushpush"],
  ] as const) {
    assert.equal(ravensProfile(n).kind, kind);
    assert.equal(ravensProfile(n).defaultBlocking, "team");
  }
  for (const n of [6, 8, 10, 11, 20, 21, 24, 27, 31, 34])
    assert.equal(ravensProfile(n).direction, "field");
  for (const n of [14, 28, 30, 32])
    assert.equal(ravensProfile(n).direction, "boundary");
  assert.equal(ravensProfile(14).absolutePull, "right");
  assert.equal(ravensProfile(6).defaultBlocking, "outside");
});
test("9 numara kullanıcının seçimiyle çizim olarak korunur; diğer kaynak özel oyunu29 takım uyarlamasıdır", () => {
  assert.equal(ravensProfile(9).defaultBlocking, "diagram");
  assert.equal(ravensProfile(9).confirmed, true);
  assert.match(ravensProfile(9).note, /kullanıcının seçimiyle/);
  assert.equal(ravensProfile(29).defaultBlocking, "team");
  assert.equal(ravensProfile(29).confirmed, true);
  assert.equal(RAVENS_PROFILE_REVISION, 2);
  assert.throws(() => ravensProfile(36));
  assert.throws(() => ravensProfile("missing"));
});
test("tür filtresi yanıltıcı kaynak adına göre değişmez; option yalnız11, counter12/13/28/30", () => {
  assert.deepEqual(
    ravensCatalog
      .filter((p) => ravensMatchesGroup(p, "option"))
      .map((p) => p.number),
    [11],
  );
  assert.deepEqual(
    ravensCatalog
      .filter((p) => ravensMatchesGroup(p, "counter"))
      .map((p) => p.number),
    [12, 13, 28, 30],
  );
  assert.deepEqual(
    ravensCatalog
      .filter((p) => ravensMatchesGroup(p, "trap"))
      .map((p) => p.number),
    [19, 26, 34],
  );
  assert.deepEqual(
    ravensCatalog
      .filter((p) => ravensMatchesGroup(p, "zone"))
      .map((p) => p.number),
    [6, 8, 20, 24, 27, 31],
  );
  assert.equal(
    ravensCatalog.filter((p) => ravensMatchesGroup(p, "pistol")).length,
    6,
  );
});
