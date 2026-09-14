import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { UserPlus, Home } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

const googleBtn = "w-full bg-white border border-gray-200 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all";
const guestBtn = "flex w-full items-center justify-center gap-2 rounded-xl border border-[#E3C19F] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] py-3 text-sm font-bold text-black transition-all active:scale-95";

export default function Register() {
  const navigate = useNavigate();

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  const handleContinueHome = () => {
    sessionStorage.removeItem("gh_splash_shown");
    navigate("/");
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-600 font-semibold hover:underline">Sign in</Link>
        </>
      }
    >
      <button onClick={handleGoogle} className={googleBtn + " mb-5"}>
        <GoogleIcon className="w-5 h-5" />
        Sign up with Google
      </button>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">or</span></div>
      </div>

      <button onClick={handleContinueHome} className={guestBtn}>
        <Home className="w-4 h-4" /> Continue to Home
      </button>
    </AuthLayout>
  );
}
