import { calculateMatchStatistics } from "./calculateMatchStatistics";
import type { MatchGame } from "@/app/types/match";

self.onmessage = async (event: MessageEvent<{ games: MatchGame[]; key: string }>) => {
  try {
    self.postMessage(await calculateMatchStatistics(event.data.games, event.data.key));
  } catch {
    self.postMessage({ error: "Statistics calculation failed" });
  }
};
