import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { LogIn, Home } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

const googleBtn =
  "w-full bg-white border border-[#E3C19F] text-black py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm shadow-black/10";
const guestBtn =
  "w-full bg-[#E3C19F]/40 border border-[#E3C19F] text-black py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2";

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get("returnTo") || "/";

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", returnTo);
  };

  const handleContinueHome = () => {
    sessionStorage.removeItem("gh_splash_shown");
    navigate("/");
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Sign in to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-[#41362D] font-bold hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <button onClick={handleGoogle} className={googleBtn + " mb-5"}>
        <GoogleIcon className="w-5 h-5" />
        Sign in with Google
      </button>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">or</span>
        </div>
      </div>

      <button onClick={handleContinueHome} className={guestBtn}>
        <Home className="w-4 h-4" /> Continue to Home
      </button>
    </AuthLayout>
  );
}
