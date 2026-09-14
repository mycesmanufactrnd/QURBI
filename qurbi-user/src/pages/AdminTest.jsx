import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FlaskConical, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AppHeader from "@/components/AppHeader";
import { QurbiPageLoader } from "@/components/QurbiLoading";

export default function AdminTest() {
  const { user, authChecked } = useAuth();
  const navigate = useNavigate();
  const [livestock, setLivestock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!authChecked) return undefined;
    if (user?.role !== "admin") {
      setLoading(false);
      return undefined;
    }

    base44.functions
      .invoke("fetchLivestock", {})
      .then((response) => {
        if (active) setLivestock(response.data?.livestock || []);
      })
      .catch(() => {
        if (active) setError("Unable to load available livestock.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authChecked, user?.role]);

  const createShippingTest = async (item) => {
    if (creatingId) return;
    setCreatingId(item.id);
    setError("");
    try {
      const response = await base44.functions.invoke("createTestOrder", {
        livestockId: item.id,
      });
      const orderId = response.data?.order?.id;
      if (!orderId) throw new Error("The test order was not created.");
      navigate(`/orders/${encodeURIComponent(orderId)}`);
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

  if (!authChecked || loading) {
    return <QurbiPageLoader label="Preparing the shipping test…" />;
  }

  if (user?.role !== "admin") {
    return (
      <main className="qurbi-page flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <Package className="h-12 w-12 text-[#41362D]/25" />
        <p className="font-semibold text-[#41362D]/65">
          Administrator access is required.
        </p>
        <Link to="/" className="font-bold text-[#6B594A]">
          Back to Home
        </Link>
      </main>
    );
  }

  return (
    <div className="qurbi-page min-h-screen pb-12">
      <AppHeader
        title="Shipping Flow Test"
        subtitle="Create an admin-only To Ship order without opening Stripe."
        backTo="/"
      />
      <main className="qurbi-content">
        <section className="rounded-3xl border border-[#41362D]/20 bg-white/55 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white">
              <FlaskConical className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-[#41362D]">Payment bypass</h2>
              <p className="mt-1 text-xs leading-5 text-[#41362D]/65">
                Available only on this admin test page. The resulting order
                starts in To Ship; normal cart, checkout and Stripe flows are
                unchanged.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {livestock.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#41362D]/55">
            No available livestock for a test order.
          </p>
        ) : (
          <div className="space-y-3">
            {livestock.map((item) => {
              const image = item.coverImage || item.images?.[0];
              return (
                <article
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#41362D]/15 bg-white/60 p-3 shadow-sm"
                >
                  <div className="h-14 w-14 flex-none overflow-hidden rounded-xl bg-[#E3C19F]/35">
                    {image && (
                      <img
                        src={image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#41362D]">
                      {item.breed || item.animal || "Livestock"}
                    </p>
                    <p className="mt-1 text-xs text-[#41362D]/55">
                      RM{" "}
                      {Number(
                        item.price_per_head || item.price || 0,
                      ).toLocaleString("en-MY")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => createShippingTest(item)}
                    disabled={Boolean(creatingId)}
                    className="min-h-11 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-3 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {creatingId === item.id ? "Creating…" : "Test To Ship"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
