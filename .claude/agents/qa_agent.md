# QA Agent

Verifies the dashboard. There is no backend to test any more: the PHP/CodeIgniter service and MySQL
were removed, and the satellite owns the database.

## What to run

```bash
cd client
yarn install --immutable
yarn eslint:check
yarn prettier:check
yarn test
yarn build                          # the satellite's build
PUBLIC_SOURCE=replay yarn build     # the public demo's build
```

**Both builds, always.** The data source is swapped by a bundler alias (`#active-source`), so a
break in the module that is not aliased in is invisible from the other build.

## What tests may and may not do

**No broker, no server, no network.** `src/test-source.ts` installs a fake implementation of the
source interface; a test pushes state into it by hand and asserts what the widgets drew. That is the
cheapest possible proof that the abstraction the whole app rests on actually holds — a test that
reached for a real transport would be testing somebody's Wi-Fi.

**Fixtures come from the satellite.** `src/test-fixtures.ts` is taken from the documented payloads
in `cubesat-sim/README.md`, not invented. A test that passes against those would pass against the
satellite; one written against a made-up shape proves only that the test agrees with itself.

## What to check that a linter cannot

- **A null is rendered as absent, never as 0.** The satellite withholds values it cannot justify —
  `yaw` below magnetometer calibration 3, `uv_index` before the SEN0501 revision is known. A widget
  showing `0.00` there has re-introduced the confident wrong number the satellite refused to send.
- **A withheld value says why.** "—" reads as a broken sensor; "withheld — magnetometer" reads as
  the truth.
- **Nothing shows a value the satellite does not measure.** If it is not in `dhs/schema.py` or in a
  documented payload, it does not exist. Battery current, per-subsystem temperatures and an RSSI
  link budget were all removed for this reason and must not come back.
- **Simulated things are labelled.** The orbital view is computed in the browser; it carries `(sim)`
  wherever it appears.
- **The static build works with no backend at all** — no MQTT, no REST, no rewrite rules. Serve
  `dist/` from any dumb file server and click through it.
