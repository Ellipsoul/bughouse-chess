import { configure } from "mobx";

// Configure MobX
configure({
  isolateGlobalState: true,
  // Optional but recommended for better debugging
  enforceActions: "never",
});
