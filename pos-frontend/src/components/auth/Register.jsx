import React, { useState } from "react";
import { register } from "../../https";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaUserTag, FaIdCard, FaPhone, FaLock } from "react-icons/fa6";

const Register = ({ setIsRegister }) => {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    phone: "",
    pin: "",
    role: "waiter",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelection = (selectedRole) => {
    setFormData({ ...formData, role: selectedRole.toLowerCase() });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      enqueueSnackbar("Please enter a username for the employee!", {
        variant: "warning",
      });
      return;
    }
    if (!formData.pin || formData.pin.length < 4) {
      enqueueSnackbar("PIN / Password must be at least 4 digits!", {
        variant: "warning",
      });
      return;
    }

    registerMutation.mutate(formData);
  };

  const registerMutation = useMutation({
    mutationFn: (reqData) => register(reqData),
    onSuccess: (res) => {
      const { data } = res;
      enqueueSnackbar(data.message || "Employee registered successfully!", {
        variant: "success",
      });
      setFormData({
        name: "",
        username: "",
        phone: "",
        pin: "",
        role: "waiter",
      });

      setTimeout(() => {
        setIsRegister(false);
      }, 1500);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Registration failed. Please check the fields.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* Full Name */}
        <div>
          <label className="block text-[#ababab] mb-2 text-sm font-medium">
            Full Name
          </label>
          <div className="flex items-center gap-3 rounded-lg p-3.5 px-4 bg-[#1f1f1f] border border-[#333] focus-within:border-yellow-400">
            <FaIdCard className="text-yellow-400" />
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. John Mensah"
              className="bg-transparent flex-1 text-white focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
            Employee Username (for quick POS login)
          </label>
          <div className="flex items-center gap-3 rounded-lg p-3.5 px-4 bg-[#1f1f1f] border border-[#333] focus-within:border-yellow-400">
            <FaUserTag className="text-yellow-400" />
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g. john, waiter1"
              className="bg-transparent flex-1 text-white focus:outline-none lowercase"
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
            Phone Number
          </label>
          <div className="flex items-center gap-3 rounded-lg p-3.5 px-4 bg-[#1f1f1f] border border-[#333] focus-within:border-yellow-400">
            <FaPhone className="text-yellow-400" />
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g. 0541234567"
              className="bg-transparent flex-1 text-white focus:outline-none"
              required
            />
          </div>
        </div>

        {/* PIN / Password */}
        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
            Employee PIN / Password (min 4 digits)
          </label>
          <div className="flex items-center gap-3 rounded-lg p-3.5 px-4 bg-[#1f1f1f] border border-[#333] focus-within:border-yellow-400">
            <FaLock className="text-yellow-400" />
            <input
              type="password"
              name="pin"
              value={formData.pin}
              onChange={handleChange}
              placeholder="e.g. 1234"
              className="bg-transparent flex-1 text-white focus:outline-none tracking-widest"
              required
            />
          </div>
        </div>

        {/* Role selection */}
        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
            Employee Role
          </label>

          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Waiter", id: "waiter" },
              { label: "Cashier", id: "cashier" },
              { label: "Admin", id: "admin" },
            ].map(({ label, id }) => {
              const isSelected = formData.role === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleRoleSelection(id)}
                  className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all border ${
                    isSelected
                      ? "bg-yellow-400 text-gray-900 border-yellow-400 font-bold shadow-md shadow-yellow-500/20"
                      : "bg-[#1f1f1f] text-[#ababab] border-[#333] hover:border-[#555]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full rounded-lg mt-6 py-3.5 text-lg bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50"
        >
          {registerMutation.isPending ? "Creating Account..." : "Register Employee"}
        </button>
      </form>
    </div>
  );
};

export default Register;
