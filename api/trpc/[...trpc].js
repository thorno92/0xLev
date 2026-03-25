import { createRequire } from "module";
const require = createRequire(import.meta.url);
const app = require("../../dist/fn/handler.cjs");
export default app.default || app;
