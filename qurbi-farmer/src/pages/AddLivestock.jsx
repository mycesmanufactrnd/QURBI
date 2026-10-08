import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { qurbi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, Loader2 } from "lucide-react";
import LivestockForm from "@/components/agri/LivestockForm";
import { getDraft, setDraft } from "@/lib/livestockDraft";
import { MALAYSIA_STATES } from "@/lib/agri";

export default function AddLivestock() {
  const navigate = useNavigate();
  const { t } = useTranslation("livestock");
  const { user } = useAuth();
  const [initial, setInitial] = useState(null);
  const [registeredState, setRegisteredState] = useState("");

  useEffect(() => {
    const draft = getDraft();
    const resolveRegisteredState = () =>
      user?.id
        ? qurbi.entities.FarmerProfile.filter({ userId: user.id })
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
        title={t("add.title")}
        description={t("add.description")}
        backLabel={t("add.backAria")}
      />
      <div className="mt-4">
        <LivestockForm
          initial={initial}
          registeredState={registeredState}
          onSubmit={handleNext}
          submitting={false}
          submitLabel={t("add.next")}
        />
      </div>
    </div>
  );
}

function Header({ onBack, title, description, backLabel }) {
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={onBack} aria-label={backLabel} className="soft-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-muted">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
