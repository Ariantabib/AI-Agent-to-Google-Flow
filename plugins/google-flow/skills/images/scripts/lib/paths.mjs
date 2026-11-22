// Where flow-agent keeps its own state. Everything is overridable with environment variables.
import { homedir } from "node:os";
import { join } from "node:path";

export const HOME = process.env.FLOW_AGENT_HOME ?? join(homedir(), ".flow-agent");
export const RUNTIME_DIR = join(HOME, "runtime");
export const DEFAULT_PROFILE = process.env.FLOW_AGENT_PROFILE ?? join(HOME, "chrome-profile");
export const DEFAULT_PORT = Number(process.env.FLOW_AGENT_CDP_PORT ?? 9333);
export const FLOW_URL = "https://flow.google.com/";
export const CONFIG_NAME = "flow-images.config.json";
export const PLAYWRIGHT_VERSION = "^1.63.0";
