import React from "react";
import { formatMYR } from "@/lib/agri";

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right break-words min-w-0">
        {value || "—"}
      </span>
    </div>
  );
}

export default function ReviewSummary({ species, breed, price, farmLocation, deliveryMethod, signerName, signedDate }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <h2 className="text-sm font-extrabold tracking-tight mb-1">Review summary</h2>
      <p className="text-[11px] text-muted-foreground mb-2">Confirm the details below before submitting your listing.</p>
      <Row label="Species & breed" value={[species, breed].filter(Boolean).join(" · ")} />
      <Row label="Selling price" value={price !== "" && price != null ? formatMYR(Number(price)) : ""} />
      <Row label="State" value={farmLocation} />
      <Row label="Delivery method" value={deliveryMethod} />
      <Row label="Signer name" value={signerName} />
      <Row label="Signed date" value={signedDate} />
    </div>
  );
}
