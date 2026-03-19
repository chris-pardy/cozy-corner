import { defineEventHandler, getQuery } from "h3";
import { getOnlineDids } from "../../utils/state";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const raw = query.dids;

  // dids can be a single string or array
  const dids: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === "string"
      ? [raw]
      : [];

  const online = getOnlineDids();
  const friends = dids
    .filter((did) => online.has(did))
    .map((did) => {
      const info = online.get(did)!;
      return {
        did,
        house: {
          uri: `at://${info.houseDid}/at.cozy-corner.house/self`,
          cid: "",
        },
      };
    });

  return { friends };
});
