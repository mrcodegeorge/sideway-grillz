import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { login } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { setUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { FaUserTag, FaLock } from "react-icons/fa6";

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    username: "",
    pin: "",
  });

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
                className={`py-2 rounded-lg font-bold text-base transition-colors ${
                  val === "clear"
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

        {/* Submit */}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded-lg mt-6 py-3.5 text-lg bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50"
        >
          {loginMutation.isPending ? "Signing In..." : "Clock In / Sign In"}
        </button>
      </form>
    </div>
  );
};

export default Login;
