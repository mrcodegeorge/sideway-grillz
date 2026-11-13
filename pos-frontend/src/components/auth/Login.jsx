import React, { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { login, adminChangeUserPin } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { setUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { FaUserTag, FaLock } from "react-icons/fa6";
import { supabase } from "../../supabase/client";
import { dispatchEmailIfEnabled } from "../../utils/settingsStorage";

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    username: "",
    pin: "",
  });
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryPin, setRecoveryPin] = useState("");
  const [confirmRecoveryPin, setConfirmRecoveryPin] = useState("");
  const [updatingRecovery, setUpdatingRecovery] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setShowRecoveryModal(true);
      }
    });
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const idTrimmed = forgotIdentifier.trim();
    if (!idTrimmed) {
      enqueueSnackbar("Please enter your username or email.", { variant: "warning" });
      return;
    }

    setSendingReset(true);
    try {
      const isRealEmail =
        idTrimmed.includes("@") && !idTrimmed.toLowerCase().endsWith("@sidewaysgrillz.com");

      if (isRealEmail) {
        const { error } = await supabase.auth.resetPasswordForEmail(idTrimmed, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        enqueueSnackbar("Password reset link sent to your email!", { variant: "success" });
      } else {
        await dispatchEmailIfEnabled({
          eventType: "staff",
          subject: `PIN Reset Request — ${idTrimmed}`,
          text: `Staff member "${idTrimmed}" requested a PIN/password reset from the POS login screen. Please reset their PIN under Admin Dashboard -> Users.`,
        });
        enqueueSnackbar(
          "Reset request noted! Contact your Admin to reset your PIN under Dashboard → Users.",
          { variant: "info" }
        );
      }
      setShowForgotModal(false);
      setForgotIdentifier("");
    } catch (err) {
      enqueueSnackbar(err?.message || "Could not process reset request.", {
        variant: "error",
      });
    } finally {
      setSendingReset(false);
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    if (recoveryPin.trim().length < 4) {
      enqueueSnackbar("New PIN/password must be at least 4 characters.", {
        variant: "warning",
      });
      return;
    }
    if (recoveryPin !== confirmRecoveryPin) {
      enqueueSnackbar("PINs do not match.", { variant: "warning" });
      return;
    }
    setUpdatingRecovery(true);
    try {
      await adminChangeUserPin({ newPin: recoveryPin, isSelf: true });
      enqueueSnackbar("PIN/Password updated! You can now sign in.", { variant: "success" });
      setShowRecoveryModal(false);
      setRecoveryPin("");
      setConfirmRecoveryPin("");
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || "Failed to update PIN.", {
        variant: "error",
      });
    } finally {
      setUpdatingRecovery(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNumpad = (num) => {
    if (num === "clear") {
      setFormData({ ...formData, pin: "" });
    } else if (num === "del") {
      setFormData({ ...formData, pin: formData.pin.slice(0, -1) });
    } else {
      if (formData.pin.length < 8) {
        setFormData({ ...formData, pin: formData.pin + num });
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      enqueueSnackbar("Please enter your employee username!", {
        variant: "warning",
      });
      return;
    }
    if (!formData.pin.trim()) {
      enqueueSnackbar("Please enter your PIN or password!", {
        variant: "warning",
      });
      return;
    }
    loginMutation.mutate(formData);
  };

  const loginMutation = useMutation({
    mutationFn: (reqData) => login(reqData),
    onSuccess: (res) => {
      const { data } = res;
      const { _id, name, username, email, phone, role } = data.data;
      dispatch(setUser({ _id, name, username, email, phone, role }));
      enqueueSnackbar(`Welcome back, ${name || username}! (${role})`, {
        variant: "success",
      });
      navigate("/");
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Login failed. Check your username and PIN.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* Username */}
        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
            Employee Username
          </label>
          <div className="flex items-center gap-3 rounded-lg p-4 bg-[#1f1f1f] border border-[#333] focus-within:border-yellow-400">
            <FaUserTag className="text-yellow-400 text-lg" />
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g. kwame, waiter1, admin"
              className="bg-transparent flex-1 text-white focus:outline-none text-base"
              autoComplete="username"
              required
            />
          </div>
        </div>

        {/* PIN / Password */}
        <div>
          <label className="block text-[#ababab] mb-2 mt-4 text-sm font-medium">
            PIN or Password
          </label>
          <div className="flex items-center gap-3 rounded-lg p-4 bg-[#1f1f1f] border border-[#333] focus-within:border-yellow-400">
            <FaLock className="text-yellow-400 text-lg" />
            <input
              type="password"
              name="pin"
              value={formData.pin}
              onChange={handleChange}
              placeholder="Enter PIN / password"
              className="bg-transparent flex-1 text-white focus:outline-none text-base tracking-widest"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {/* Quick Touch Numpad for Waiter PIN */}
        <div className="mt-4 bg-[#141414] p-3 rounded-xl border border-[#2b2b2b]">
          <p className="text-xs text-[#777] mb-2 text-center uppercase tracking-wider font-semibold">
            Quick Touch PIN Pad
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "del"].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleNumpad(val)}
                className={`py-2 rounded-lg font-bold text-base transition-colors ${val === "clear"
                    ? "bg-red-950/40 text-red-400 hover:bg-red-900/60"
                    : val === "del"
                      ? "bg-yellow-950/40 text-yellow-400 hover:bg-yellow-900/60"
                      : "bg-[#242424] text-white hover:bg-[#333]"
                  }`}
              >
                {val === "del" ? "⌫" : val === "clear" ? "C" : val}
              </button>
            ))}
          </div>
        </div>

        {/* Forgot PIN / Password Link */}
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => {
              setForgotIdentifier(formData.username || "");
              setShowForgotModal(true);
            }}
            className="text-xs text-yellow-400 hover:underline font-medium"
          >
            Forgot PIN / Password?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded-lg mt-4 py-3.5 text-lg bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50"
        >
          {loginMutation.isPending ? "Signing In..." : "Clock In / Sign In"}
        </button>
      </form>

      {/* Forgot PIN / Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleForgotSubmit}
            className="bg-[#262626] border border-[#383838] rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-white font-bold text-lg">Reset PIN / Password</h3>
            <p className="text-xs text-[#ababab]">
              Enter your email for a reset link, or enter your POS username to notify your Admin.
            </p>
            <input
              type="text"
              value={forgotIdentifier}
              onChange={(e) => setForgotIdentifier(e.target.value)}
              placeholder="Username or email"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 rounded-lg text-xs text-[#ababab] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingReset}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-xs px-4 py-2 rounded-lg"
              >
                {sendingReset ? "Sending..." : "Request Reset"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Email Recovery Set New PIN Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecoverySubmit}
            className="bg-[#262626] border border-[#383838] rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-white font-bold text-lg">Set New PIN / Password</h3>
            <input
              type="password"
              value={recoveryPin}
              onChange={(e) => setRecoveryPin(e.target.value)}
              placeholder="New PIN / Password (4+ chars)"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
            <input
              type="password"
              value={confirmRecoveryPin}
              onChange={(e) => setConfirmRecoveryPin(e.target.value)}
              placeholder="Confirm new PIN / Password"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
            <button
              type="submit"
              disabled={updatingRecovery}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-sm py-2.5 rounded-lg"
            >
              {updatingRecovery ? "Saving..." : "Update PIN / Password"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Login;
