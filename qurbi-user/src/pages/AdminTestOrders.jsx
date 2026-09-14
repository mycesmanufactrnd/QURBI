import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AppHeader from "@/components/AppHeader";
import { QurbiPageLoader } from "@/components/QurbiLoading";

export default function AdminTestOrders() {
  const { user, authChecked } = useAuth();
  const navigate = useNavigate();
  const [livestock, setLivestock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authChecked) return;
      if (user?.role !== "admin") {
        setLoading(false);
        return;
      }
      try {
        const response = await base44.functions.invoke("fetchLivestock", {});
        if (active) setLivestock(response.data?.livestock || []);
      } catch {
        if (active) setError("Unable to load available livestock.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authChecked, user?.role]);

  const createOrder = async (item) => {
    if (creatingId) return;
    setCreatingId(item.id);
    setError("");
    try {
      const response = await base44.functions.invoke("createTestOrder", {
        livestockId: item.id,
      });
      navigate(`/orders/${encodeURIComponent(response.data.order.id)}`);
    } catch (requestError) {
      setError(
        requestError.data?.error ||
          requestError.message ||
          "Unable to create the test order.",
      );
    } finally {
      setCreatingId("");
    }
  };

  if (!authChecked || loading)
    return <QurbiPageLoader label="Preparing test orders…" />;
  if (user?.role !== "admin")
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-3 p-8">
        <Package className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Administrator access is required.</p>
        <Link to="/" className="text-emerald-600 font-semibold">
          Back to Home
        </Link>
      </div>
    );
  return (
    <div className="qurbi-page pb-12">
      <AppHeader
        title="Create Test Order"
        backTo="/"
        subtitle="No payment — begins in To Ship"
      />
      <main className="qurbi-content">
        <p className="rounded-xl bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-700">
          This is restricted to administrators and intended only for testing
          order tracking. It does not charge payment or change the selected
          livestock’s availability.
        </p>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        {livestock.length === 0 ? (
          <p className="py-12 text-center text-gray-400">
            No available livestock.
          </p>
        ) : (
          livestock.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-white p-4 shadow-sm border border-gray-50 flex items-center gap-3"
            >
              <div className="h-12 w-12 flex-none overflow-hidden rounded-xl bg-emerald-50">
                {(item.coverImage || item.images?.[0]) && (
                  <img
                    src={item.coverImage || item.images[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-800">
                  {item.breed || item.animal || "Livestock"}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  RM{" "}
                  {Number(
                    item.price_per_head || item.price || 0,
                  ).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => createOrder(item)}
                disabled={!!creatingId}
                className="min-h-10 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {creatingId === item.id ? "Creating..." : "Use for test"}
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
