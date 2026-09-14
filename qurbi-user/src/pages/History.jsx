import React from "react";
import { Navigate } from "react-router-dom";

// Preserve existing links while keeping all order access on the account-scoped page.
export default function History() {
  return <Navigate to="/orders" replace />;
}
