// Tiny logging helpers. Progress goes to stdout as "[hh:mm:ss] ..."; the final machine-readable
// summary is a single line starting with "RESULT " so an agent can parse it.
export const log = (...parts) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...parts);
export const result = (obj) => console.log(`RESULT ${JSON.stringify(obj)}`);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = (min, max) => Math.round(min + Math.random() * (max - min));
