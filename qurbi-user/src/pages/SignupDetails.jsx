import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, Check, ArrowRight } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAuth } from "@/lib/AuthContext";
import AuthLayout from "@/components/AuthLayout";

const inputCls = "w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-3 py-3 text-gray-900 placeholder-gray-300 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all";
const primaryBtn = "w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200 disabled:opacity-60";

export default function SignupDetails() {
  const { profile, updateProfile, addAddress } = useUserProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: profile.name || user?.full_name || "",
    email: profile.email || user?.email || "",
    phone: profile.phone || "",
    address: "",
  });
  const [saved, setSaved] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = () => {
    updateProfile({ name: form.name, email: form.email, phone: form.phone });
    if (form.address.trim()) {
      addAddress({ label: "Home", street: form.address.trim(), name: form.name, phone: form.phone, isDefault: true });
    }
    setSaved(true);
    setTimeout(() => navigate("/"), 800);
  };

  const handleSkip = () => navigate("/");

  return (
    <AuthLayout
      icon={User}
      title="Complete your profile"
      subtitle="You can fill this in now or skip and do it later"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-gray-500 text-xs font-semibold">Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input value={form.name} onChange={set("name")} placeholder="Your full name" className={inputCls} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-gray-500 text-xs font-semibold">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input value={form.email} onChange={set("email")} type="email" placeholder="you@example.com" className={inputCls} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-gray-500 text-xs font-semibold">Phone number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input value={form.phone} onChange={set("phone")} type="tel" placeholder="012-345 6789" className={inputCls} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-gray-500 text-xs font-semibold">Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input value={form.address} onChange={set("address")} placeholder="Street, city, state" className={inputCls} />
          </div>
        </div>

        <button onClick={handleSave} className={primaryBtn + " mt-1"}>
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : <>Save & continue <ArrowRight className="w-4 h-4" /></>}
        </button>
        <button onClick={handleSkip} className="w-full bg-gray-50 text-gray-600 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all">
          Skip for now
        </button>
      </div>
    </AuthLayout>
  );
}