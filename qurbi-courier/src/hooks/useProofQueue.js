import { useCallback, useEffect, useState } from "react";
import { proofQueue } from "@/lib/proofSubmission";

/** Live view of the offline proof queue: counts, and the rejected items to show. */
export function useProofQueue() {
  const [state, setState] = useState({ pending: 0, failed: 0, failedItems: [] });

  const refresh = useCallback(async () => {
    const items = await proofQueue.list();
    const failedItems = items.filter((item) => item.state === "failed");
    setState({
      pending: items.filter((item) => item.state === "pending").length,
      failed: failedItems.length,
      failedItems,
    });
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    return proofQueue.subscribe(() => { refresh().catch(() => {}); });
  }, [refresh]);

  return { ...state, dismiss: (id) => proofQueue.dismiss(id) };
}
