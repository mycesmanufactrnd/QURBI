import React from "react";
import BottomNav from "@/components/BottomNav";
import PageTransitionOutlet from "@/components/PageTransitionOutlet";
import Sidebar from "@/components/Sidebar";

// Mobile / tablet: bottom navigation. Desktop (lg+): left sidebar, with the
// page content shifted over by the sidebar's width.
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]">
      <Sidebar />
      <div className="lg:pl-[260px]">
        <PageTransitionOutlet />
      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
