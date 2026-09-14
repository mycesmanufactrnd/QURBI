import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2 } from "lucide-react";
import LivestockForm from "@/components/agri/LivestockForm";

export default function EditLivestock() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [livestock, setLivestock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    base44.entities.Livestock.get(id)
      .then(setLivestock)
      .catch(() => navigate("/livestock", { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      await base44.entities.Livestock.update(id, data);
      navigate(`/livestock/${id}`, { replace: true });
    } catch (err) {
      alert(err.message || "Failed to update listing");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }
  if (!livestock) return null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back to livestock details" className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Edit Livestock</h1>
          <p className="mt-1 text-sm text-muted-foreground">Update listing information and availability.</p>
        </div>
      </div>
      <div className="mt-6">
        <LivestockForm initial={livestock} onSubmit={handleSubmit} submitting={submitting} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
