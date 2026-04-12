/**
 * Saves storageState from Chrome you started with npm run swimcloud:chrome-debug
 * (sets SWIMCLOUD_CDP_URL if unset).
 */
const port = process.env.SWIMCLOUD_CDP_PORT?.trim() || "9222";
process.env.SWIMCLOUD_CDP_URL =
  process.env.SWIMCLOUD_CDP_URL?.trim() || `http://127.0.0.1:${port}`;

void import("./auth").catch((e) => {
  console.error(e);
  process.exit(1);
});
