import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import LivestockForm from "@/components/agri/LivestockForm";
import StepIndicator from "@/components/agri/StepIndicator";
import { getDraft, setDraft } from "@/lib/livestockDraft";
import { MALAYSIA_STATES } from "@/lib/agri";

export default function AddLivestock() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [initial, setInitial] = useState(null);
  const [registeredState, setRegisteredState] = useState("");
  const formRef = useRef(null);

  useEffect(() => {
    const draft = getDraft();
    const resolveRegisteredState = () =>
      user?.id
        ? base44.entities.FarmerProfile.filter({ userId: user.id })
            .then((rows) => rows?.[0]?.state || "")
            .catch(() => "")
        : Promise.resolve("");

    resolveRegisteredState().then((state) => {
      setRegisteredState(state);
      const draftState = MALAYSIA_STATES.includes(draft?.state) ? draft.state : state;
      setInitial(draft ? { ...draft, state: draftState, farmLocation: draftState } : (state ? { state, farmLocation: state } : {}));
    });
  }, [user?.id]);

  const handleNext = (data) => {
    setDraft(data);
    navigate("/livestock/add/policy");
  };

  if (initial === null) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Header
        onBack={() => navigate("/livestock")}
        title="Add Livestock"
        description="Create a clear, buyer-friendly listing for one animal."
      />
      <StepIndicator current={1} className="mt-6" />

      <div className="mt-4 pb-16 lg:pb-0">
        <LivestockForm
          ref={formRef}
          initial={initial}
          registeredState={registeredState}
          onSubmit={handleNext}
          submitting={false}
          hideActions
        />
      </div>

      <div className="fixed bottom-[76px] inset-x-0 z-30 lg:static lg:z-auto lg:bg-transparent lg:border-0 lg:px-0 lg:mt-6 bg-background/95 backdrop-blur border-t border-border p-3">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/livestock")} className="flex-1 h-12 rounded-2xl">
            Back
          </Button>
          <Button onClick={() => formRef.current?.submit()} className="flex-1 h-12 rounded-2xl text-base font-semibold">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function Header({ onBack, title, description }) {
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={onBack} aria-label="Back to livestock" className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-muted">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
