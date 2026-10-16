import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

const MAX_STORED_IDS = 100;

function storageKey(userId) {
  return `qurbi:farmer-notification-popups:${userId}`;
}

function readShownIds(userId) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(userId)) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function saveShownIds(userId, ids) {
  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(Array.from(ids).slice(-MAX_STORED_IDS)),
    );
  } catch {
    // A blocked localStorage must not stop notifications from loading.
  }
}

export default function NotificationPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const knownIdsRef = useRef(new Set());
  const shownIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    initializedRef.current = false;
    knownIdsRef.current = new Set();
    shownIdsRef.current = readShownIds(user.id);

    const showNotification = (notification) => {
      shownIdsRef.current.add(notification.id);
      saveShownIds(user.id, shownIdsRef.current);

      toast({
        title: notification.title || "New notification",
        description: notification.message || "You have a new update.",
        duration: 8000,
        action: notification.targetUrl || notification.orderId || notification.livestockId ? (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-muted"
            onClick={() => navigate(
              notification.targetUrl ||
                (notification.orderId
                  ? `/orders/${notification.orderId}`
                  : `/livestock/${notification.livestockId}`),
            )}
          >
            View
          </button>
        ) : undefined,
      });
    };

    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const rows = await qurbi.entities.FarmerNotification.list("-created_date", 50);
        if (!active) return;

        const isInitialLoad = !initializedRef.current;
        const notifications = rows || [];

        notifications
          .filter((notification) => {
            if (notification.isRead || shownIdsRef.current.has(notification.id)) return false;
            if (!isInitialLoad) return !knownIdsRef.current.has(notification.id);
            return true;
          })
          .slice(0, 3)
          .reverse()
          .forEach(showNotification);

        if (isInitialLoad) {
          notifications.forEach((notification) =>
            shownIdsRef.current.add(notification.id),
          );
          saveShownIds(user.id, shownIdsRef.current);
        }

        knownIdsRef.current = new Set(notifications.map((notification) => notification.id));
        initializedRef.current = true;
      } catch {
        // Bell/inbox remains usable if a background refresh temporarily fails.
      } finally {
        loadingRef.current = false;
      }
    };

    load();
    const unsubscribe = qurbi.entities.FarmerNotification.subscribe(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate, user?.id]);

  return null;
}
