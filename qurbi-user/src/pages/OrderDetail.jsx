import React, { useCallback, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Camera, Check, Package } from "lucide-react";
import { qurbiApi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { useAuthPrompt } from "@/lib/auth-prompt-context";
import { formatOrderDateTime } from "@/lib/order-date";
import ImageLightbox from "@/components/ImageLightbox";
import AppHeader from "@/components/AppHeader";
import PageLoading from "@/components/PageLoading";

const RECEIVABLE_STATUSES = ["in_transit", "shipped", "to_receive", "delivering", "delivered"];

const TRACKING_STAGES = [
  { key: "before", label: "Before", owner: "Farmer" },
  { key: "during", label: "During", owner: "Farmer" },
  { key: "after", label: "After", owner: "Farmer" },
  { key: "received", label: "Received", owner: "You" },
];

const TAB_FOR_STATUS = {
  pending: "to-pay",
  pending_payment: "to-pay",
  to_pay: "to-pay",
  cancelled: "to-pay",
  out_of_stock: "to-pay",
  paid: "to-ship",
  preparing: "to-ship",
  to_ship: "to-ship",
  processing: "to-ship",
  in_transit: "to-receive",
  shipped: "to-receive",
  to_receive: "to-receive",
  delivering: "to-receive",
  completed: "completed",
  delivered: "completed",
  received: "completed",
  return_requested: "return-refund",
  refund_requested: "return-refund",
  return_refund: "return-refund",
  refunded: "return-refund",
};

function LegacyOrderTracking({ order, onPreview }) {
  const tracking = order.tracking_photos || {};

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
      <h2 className="text-gray-900 font-bold">Order tracking</h2>

      <p className="mt-1 text-xs text-gray-400">
        Before → During → After → Received
      </p>

      <div className="mt-4 space-y-3">
        {TRACKING_STAGES.map((stage, index) => {
          const proof = tracking[stage.key];

          const priorComplete = TRACKING_STAGES.slice(0, index).every(
            (prior) => tracking[prior.key]?.image_url,
          );

          const awaitingBuyer =
            stage.key === "received" &&
            !TRACKING_STAGES.slice(0, 3).every(
              (farmerStage) => tracking[farmerStage.key]?.image_url,
            );

          const waitingFor = proof?.image_url
            ? "Complete"
            : awaitingBuyer
              ? "Locked until farmer photos are complete"
              : priorComplete
                ? `Waiting for ${stage.owner}`
                : "Locked";

          return (
            <div key={stage.key} className="flex gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full ${
                  proof?.image_url
                    ? "bg-[#F7EDE2]0 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {proof?.image_url ? <Check className="h-4 w-4" /> : index + 1}
              </div>

              <div className="min-w-0 flex-1 border-b border-gray-50 pb-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-800">
                      {stage.label}
                    </p>

                    <p className="text-xs text-gray-400">
                      Action: {stage.owner}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-semibold text-right ${
                      proof?.image_url ? "text-[#5A493C]" : "text-gray-400"
                    }`}
                  >
                    {waitingFor}
                  </span>
                </div>

                {proof?.image_url && (
                  <button
                    type="button"
                    onClick={() =>
                      onPreview(proof.image_url, `${stage.label} order proof`)
                    }
                    className="mt-2 block h-24 w-24 overflow-hidden rounded-xl bg-gray-100"
                  >
                    <img
                      src={proof.image_url}
                      alt={`${stage.label} order proof`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OrderTracking({ order, onPreview }) {
  const tracking = order.tracking_photos || {};

  const proofs = TRACKING_STAGES.map((stage) => ({
    ...stage,
    image: tracking[stage.key]?.image_url,
  })).filter((proof) => proof.image);

  const [selectedKey, setSelectedKey] = useState(() => proofs[0]?.key || "");

  const selected =
    proofs.find((proof) => proof.key === selectedKey) || proofs[0];

  useEffect(() => {
    if (!proofs.some((proof) => proof.key === selectedKey)) {
      setSelectedKey(proofs[0]?.key || "");
    }
  }, [order.id, selectedKey, proofs]);

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
      <h2 className="text-gray-900 font-bold">Order Photo Proof</h2>

      <p className="mt-1 text-xs text-gray-400">
        Farmer Before, During, After and your Received proof
      </p>

      {selected ? (
        <>
          <button
            type="button"
            onClick={() =>
              onPreview(selected.image, `${selected.label} order proof`)
            }
            className="mt-4 flex h-64 w-full items-center justify-center overflow-hidden rounded-2xl bg-gray-50"
          >
            <img
              src={selected.image}
              alt={`${selected.label} order proof`}
              className="h-full w-full object-contain"
            />
          </button>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {proofs.map((proof) => (
              <button
                type="button"
                key={proof.key}
                onClick={() => setSelectedKey(proof.key)}
                className={`flex-none overflow-hidden rounded-xl border-2 p-0.5 ${
                  selected.key === proof.key
                    ? "border-[#F7EDE2]0"
                    : "border-transparent"
                }`}
              >
                <img
                  src={proof.image}
                  alt={proof.label}
                  className="h-16 w-16 object-cover"
                />

                <span className="block px-1 pb-1 pt-0.5 text-[10px] font-bold text-gray-600">
                  {proof.label}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]
         px-3 py-4 text-sm font-bold text-black">
          No proof photos have been uploaded yet.
        </p>
      )}
    </section>
  );
}

function statusLabel(order) {
  if (order.status === "out_of_stock") return "Out of Stock";

  if (order.status === "cancelled") return "Cancelled";

  if (order.status === "refunded" || order.refund_status === "completed") {
    return "Refund Complete";
  }

  if (
    order.status === "refund_requested" &&
    order.refund_status === "rejected"
  ) {
    return "Refund Rejected";
  }

  if (order.status === "refund_requested") {
    return "Refund Pending Approval";
  }

  return order.status?.replaceAll("_", " ");
}

function RefundRequestSheet({ order, loading, error, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  useEffect(() => {
    setReason("");
    setEvidenceFiles([]);
  }, [order?.id]);

  if (!order) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-black/45 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-7 shadow-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden" />

        <h2 className="text-lg font-bold text-gray-900">Request a refund</h2>

        <p className="mt-1 text-sm text-gray-500">
          Tell us why you are requesting a refund for {order.order_number}.
        </p>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={loading}
          rows={4}
          placeholder="Enter your reason"
          className="mt-4 w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-800 outline-none focus:border-[#A9825F] disabled:bg-gray-50"
        />

        <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#C49A72] bg-[#F7EDE2] px-3 text-center text-sm font-bold text-[#41362D]">
          <Camera className="h-5 w-5" />

          <span className="mt-1">Upload refund photo evidence</span>

          <span className="mt-0.5 text-[11px] font-medium text-[#5A493C]">
            At least one photo is required (up to 5)
          </span>

          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={loading}
            onChange={(event) =>
              setEvidenceFiles(Array.from(event.target.files || []).slice(0, 5))
            }
          />
        </label>

        {evidenceFiles.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-[#41362D]">
            {evidenceFiles.length} photo
            {evidenceFiles.length === 1 ? "" : "s"} selected
          </p>
        )}

        {error && (
          <p className="mt-2 text-sm font-medium text-red-500">{error}</p>
        )}

        <p className="mt-3 text-xs leading-5 text-gray-400">
          Your request will be sent to an administrator for review. A refund is
          not completed until it is approved.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-600 disabled:opacity-50"
          >
            Keep Order
          </button>

          <button
            type="button"
            onClick={() => onSubmit(reason, evidenceFiles)}
            disabled={loading || !reason.trim() || !evidenceFiles.length}
            className="min-h-11 rounded-xl bg-[#F7EDE2]0 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user, isAuthenticated, authChecked } = useAuth();
  const { requestSignIn } = useAuthPrompt();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [refundSheetOpen, setRefundSheetOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [receivedFile, setReceivedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const loadOrder = useCallback(async () => {
    if (!authChecked) return;

    if (!isAuthenticated || !user?.id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const response = await qurbiApi.functions.invoke("fetchMyOrders", {
        orderId,
      });

      setOrder(response.data?.order || null);
    } catch (error) {
      setLoadError(
        error.data?.error ||
          error.message ||
          "We couldn't load this order. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [authChecked, isAuthenticated, orderId, user?.id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const confirmReceipt = async () => {
    if (!order || actionLoading) return;

    if (!order.tracking_photos?.received?.image_url) {
      setActionError(
        "Upload and save a photo showing that you received the order first.",
      );
      return;
    }

    setActionLoading(true);
    setActionError("");

    try {
      const response = await qurbiApi.functions.invoke("confirmMyOrderReceived", {
        orderId: order.id,
      });

      setOrder(
        response.data?.order || {
          ...order,
          status: "completed",
        },
      );

      setMessage("Order received and completed successfully.");
    } catch (error) {
      setActionError(
        error.data?.error ||
          error.message ||
          "We couldn't confirm receipt of this order.",
      );

      await loadOrder();
    } finally {
      setActionLoading(false);
    }
  };

  const saveReceivedProof = async () => {
    if (!order || !receivedFile || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      const { file_url } = await qurbiApi.integrations.Core.UploadFile({
        file: receivedFile,
      });

      const response = await qurbiApi.functions.invoke(
        "saveMyReceivedOrderProof",
        {
          orderId: order.id,
          receivedPhotoUrl: file_url,
        },
      );

      setOrder(response.data?.order || order);
      setReceivedFile(null);
      setMessage("Received proof photo saved.");
    } catch (error) {
      setActionError(
        error.data?.error ||
          error.message ||
          "We couldn't save your received proof photo.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const requestRefund = async (reason, evidenceFiles) => {
    if (!order || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      const files = Array.isArray(evidenceFiles) ? evidenceFiles : [];

      if (!files.length) {
        throw new Error(
          "Upload at least one photo as refund evidence before submitting your request.",
        );
      }

      const evidence = await Promise.all(
        files.map(
          async (file) =>
            (
              await qurbiApi.integrations.Core.UploadFile({
                file,
              })
            ).file_url,
        ),
      );

      const response = await qurbiApi.functions.invoke("requestMyOrderRefund", {
        orderId: order.id,
        reason,
        refundEvidence: evidence,
      });

      setOrder(
        response.data?.order || {
          ...order,
          status: "refund_requested",
          refund_reason: reason,
          refund_evidence: evidence,
          refund_status: "pending_admin_approval",
        },
      );

      setRefundSheetOpen(false);

      setMessage("Your refund request has been sent for admin approval.");
    } catch (error) {
      setActionError(
        error.data?.error ||
          error.message ||
          "We couldn't submit your refund request.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="qurbi-page">
        <AppHeader
          title="Order Details"
          backTo="/orders"
          subtitle="Track your purchase and delivery progress"
        />
        <PageLoading contentOnly message="Loading order details..." />
      </div>
    );
  }

  if (authChecked && !isAuthenticated) {
    return (
      <div className="aisyah-page min-h-screen pb-28">
        <AppHeader title="Order Details" backTo="/orders" subtitle="Track your purchase and delivery progress" />
        <div className="aisyah-content flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Package className="h-12 w-12 text-[#41362D]/35" />
          <p className="text-sm text-[#41362D]/65">Sign in to view this order.</p>
          <button
            type="button"
            onClick={() => requestSignIn({ returnTo: `/orders/${orderId}`, message: "Sign in to view this order and its delivery progress." })}
            className="mt-2 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-6 py-3 text-sm font-bold text-white"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="qurbi-page flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <Package className="h-12 w-12 text-[#41362D]/25" />
        <p className="max-w-sm text-sm text-[#41362D]/65">{loadError}</p>
        <button type="button" onClick={loadOrder} className="qurbi-primary-button">
          Retry
        </button>
        <Link to="/orders" className="text-sm font-bold text-[#6B594A]">
          Back to My Orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4 p-8">
        <Package className="w-12 h-12 text-gray-300" />

        <p className="text-gray-500">Order not found.</p>

        <Link to="/orders" className="text-[#5A493C] font-semibold">
          Back to My Orders
        </Link>
      </div>
    );
  }

  const canConfirmReceipt = RECEIVABLE_STATUSES.includes(order.status);

  const farmerPhotosComplete = ["before", "during", "after"].every(
    (stage) => order.tracking_photos?.[stage]?.image_url,
  );

  const progressImages = Array.isArray(order.progress_images)
    ? order.progress_images.filter(Boolean)
    : [];

  const returnTab =
    searchParams.get("fromTab") || TAB_FOR_STATUS[order.status] || "to-pay";

  const isRefundRejected = order.refund_status?.toLowerCase() === "rejected";

  return (
    <div className="qurbi-page">
      <AppHeader
        title="Order Details"
        backTo={`/orders?tab=${encodeURIComponent(returnTab)}`}
        subtitle={`${order.order_number} · ${formatOrderDateTime(order.created_date)}`}
      />

      {message && (
        <div className="fixed top-5 left-4 right-4 z-50 rounded-xl bg-[#5A493C] px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {message}
        </div>
      )}

      <main className="p-4 space-y-3">
        {actionError && (
          <p className="rounded-xl bg-red-50 px-3 py-3 text-sm font-medium text-red-500">
            {actionError}
          </p>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex justify-between">
          <span className="text-gray-400 text-sm">Status</span>

          <span className="text-right text-sm font-bold capitalize text-white">
            {statusLabel(order)}
          </span>
        </div>

        <OrderTracking
          order={order}
          onPreview={(image, alt) => setPreviewImage({ image, alt })}
        />

        {progressImages.length > 0 && (
          <section className="qurbi-photo-area rounded-2xl p-4 shadow-sm border">
            <h2 className="text-gray-900 font-bold">Order progress</h2>

            <p className="mt-1 text-xs text-gray-400">
              Photos uploaded by the farmer
            </p>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {progressImages.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  onClick={() =>
                    setPreviewImage({
                      image,
                      alt: `Order progress ${index + 1}`,
                    })
                  }
                  className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]"
                >
                  <img
                    src={image}
                    alt={`Order progress ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {(order.status === "refund_requested" ||
          order.status === "refunded") && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <h2 className="text-gray-900 font-bold">Refund request</h2>

            {order.refund_reason && (
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold">Reason: </span>
                {order.refund_reason}
              </p>
            )}

            {order.refund_evidence?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500">
                  Photo evidence
                </p>

                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {order.refund_evidence.map((image, index) => (
                    <button
                      type="button"
                      key={image}
                      onClick={() =>
                        setPreviewImage({
                          image,
                          alt: `Refund evidence ${index + 1}`,
                        })
                      }
                      className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-gray-100"
                    >
                      <img
                        src={image}
                        alt={`Refund evidence ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {order.refund_admin_note && (
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold">Admin note: </span>
                {order.refund_admin_note}
              </p>
            )}

            <p
              className={`mt-2 text-xs font-semibold ${
                isRefundRejected ? "text-red-600" : "text-[#5A493C]"
              }`}
            >
              {statusLabel(order)}
            </p>

            {order.refund_status === "pending_admin_approval" && (
              <p className="mt-2 text-xs text-gray-400">
                Waiting for Admin review.
              </p>
            )}
          </section>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
          <h2 className="text-gray-900 font-bold mb-3">Items</h2>

          {order.items?.map((item, index) => (
            <div
              key={index}
              className="flex justify-between gap-3 py-3 border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-gray-800 font-semibold text-sm">
                  {item.breed} × {item.quantity}
                </p>

                <p className="text-gray-400 text-xs mt-0.5">
                  {item.animal}
                  {item.grade ? ` · Grade ${item.grade}` : ""}
                </p>
              </div>

              <p className="text-white font-bold text-sm whitespace-nowrap">
                RM {item.total?.toLocaleString()}
              </p>
            </div>
          ))}

          <div className="flex justify-between pt-3 mt-1 border-t border-gray-100">
            <span className="text-white font-bold">Total</span>

            <span className="text-white text-lg font-bold">
              RM {order.total?.toLocaleString()}
            </span>
          </div>
        </div>

        {canConfirmReceipt && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <p className="text-sm text-gray-500">
              Only confirm once you have received your order.
            </p>

            {farmerPhotosComplete ? (
              <>
                <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#C49A72] bg-[#F7EDE2] px-3 text-sm font-bold text-[#41362D]">
                  <Camera className="h-4 w-4" />

                  <span>
                    {receivedFile
                      ? receivedFile.name
                      : order.tracking_photos?.received?.image_url
                        ? "Replace received proof photo"
                        : "Upload received proof photo"}
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) =>
                      setReceivedFile(event.target.files?.[0] || null)
                    }
                    disabled={actionLoading}
                  />
                </label>

                {receivedFile && (
                  <button
                    type="button"
                    onClick={saveReceivedProof}
                    disabled={actionLoading}
                    className="mt-3 min-h-11 w-full rounded-xl border border-[#D5B18D] bg-white px-3 text-sm font-bold text-[#41362D] disabled:opacity-50"
                  >
                    {actionLoading ? "Saving..." : "Save received proof photo"}
                  </button>
                )}

                {order.tracking_photos?.received?.image_url && (
                  <p className="mt-2 text-xs font-semibold text-[#5A493C]"> 
                    Received proof saved. You may now confirm receipt.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                Waiting for the farmer to upload Before, During, and After
                photos.
              </p>
            )}

            {actionError && (
              <p className="mt-2 text-sm font-medium text-red-500">
                {actionError}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActionError("");
                  setRefundSheetOpen(true);
                }}
                disabled={actionLoading}
                className="min-h-11 rounded-xl border border-red-100 px-3 text-sm font-bold text-red-500 disabled:opacity-50"
              >
                Return / Refund
              </button>

              <button
                type="button"
                onClick={confirmReceipt}
                disabled={
                  actionLoading ||
                  !farmerPhotosComplete ||
                  !order.tracking_photos?.received?.image_url
                }
                className="min-h-11 rounded-xl  px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {actionLoading ? "Updating..." : "Approve Receive"}
              </button>
            </div>
          </section>
        )}
      </main>

      <RefundRequestSheet
        order={refundSheetOpen ? order : null}
        loading={actionLoading}
        error={actionError}
        onClose={() => {
          setActionError("");
          setRefundSheetOpen(false);
        }}
        onSubmit={requestRefund}
      />

      <ImageLightbox
        image={previewImage?.image}
        alt={previewImage?.alt}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
