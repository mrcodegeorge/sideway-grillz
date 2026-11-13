import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { enqueueSnackbar } from "notistack";
import {
  FaUserPlus,
  FaUsers,
  FaKey,
  FaUserSlash,
  FaUserCheck,
  FaTimes,
} from "react-icons/fa";
import {
  getAllUsers,
  adminCreateUser,
  adminUpdateUserRole,
  adminToggleUserActive,
  adminChangeUserPin,
} from "../../https/index";

const ROLES = ["waiter", "cashier", "admin"];

const UsersAdmin = () => {
  const queryClient = useQueryClient();
  const currentUser = useSelector((state) => state.user);
  const currentUserId = currentUser?._id || currentUser?.id;

  // Create user form state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("waiter");
  const [pin, setPin] = useState("");

  // Change PIN modal state
  const [pinTargetUser, setPinTargetUser] = useState(null);
  const [newPin, setNewPin] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: getAllUsers,
  });

  const createMutation = useMutation({
    mutationFn: adminCreateUser,
    onSuccess: () => {
      enqueueSnackbar("Staff account created!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setName("");
      setUsername("");
      setPhone("");
      setRole("waiter");
      setPin("");
    },
    onError: (err) => {
      enqueueSnackbar(
        err?.response?.data?.message || "Failed to create staff account.",
        { variant: "error" }
      );
    },
  });

  const roleMutation = useMutation({
    mutationFn: adminUpdateUserRole,
    onSuccess: () => {
      enqueueSnackbar("User role updated!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => {
      enqueueSnackbar(
        err?.response?.data?.message || "Failed to update role.",
        { variant: "error" }
      );
    },
  });

  const activeMutation = useMutation({
    mutationFn: adminToggleUserActive,
    onSuccess: (res) => {
      enqueueSnackbar(
        res.isActive ? "Account activated!" : "Account deactivated!",
        { variant: res.isActive ? "success" : "info" }
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => {
      enqueueSnackbar(
        err?.response?.data?.message || "Failed to update account status.",
        { variant: "error" }
      );
    },
  });

  const pinMutation = useMutation({
    mutationFn: adminChangeUserPin,
    onSuccess: () => {
      enqueueSnackbar("User PIN updated successfully!", { variant: "success" });
      setPinTargetUser(null);
      setNewPin("");
    },
    onError: (err) => {
      enqueueSnackbar(
        err?.response?.data?.message || "Failed to update PIN.",
        { variant: "error" }
      );
    },
  });

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      enqueueSnackbar("Please enter full name and username.", {
        variant: "warning",
      });
      return;
    }
    if (!pin || pin.trim().length < 4) {
      enqueueSnackbar("PIN must be at least 4 digits/characters.", {
        variant: "warning",
      });
      return;
    }
    createMutation.mutate({ name, username, phone, role, pin });
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!pinTargetUser) return;
    if (!newPin || newPin.trim().length < 4) {
      enqueueSnackbar("New PIN must be at least 4 digits/characters.", {
        variant: "warning",
      });
      return;
    }
    pinMutation.mutate({
      userId: pinTargetUser.id,
      newPin,
      isSelf: pinTargetUser.id === currentUserId,
    });
  };

  return (
    <div className="container mx-auto px-6 md:px-4 pb-24 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create New User Form */}
      <form
        onSubmit={handleCreateUser}
        className="bg-[#262626] border border-[#333] rounded-xl p-5 space-y-3 h-fit"
      >
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <FaUserPlus className="text-yellow-400" /> Create Staff Account
        </h2>

        <div>
          <label className="block text-xs text-[#ababab] mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ama Mensah"
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="block text-xs text-[#ababab] mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. ama_cashier"
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="block text-xs text-[#ababab] mb-1">
            Phone (Optional)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0241234567"
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white capitalize focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#ababab] mb-1">
              Login PIN (4+ digits)
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2.5 rounded-lg text-sm transition-colors mt-2"
        >
          {createMutation.isPending ? "Creating..." : "Create Staff User"}
        </button>
      </form>

      {/* Staff Accounts Table */}
      <div className="lg:col-span-2 bg-[#262626] border border-[#333] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <FaUsers className="text-yellow-400" /> Staff & Roles ({users.length})
          </h2>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#ababab]">Loading staff accounts...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-[#ababab]">No staff accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#f5f5f5]">
              <thead className="bg-[#1a1a1a] text-[#ababab] text-xs uppercase">
                <tr>
                  <th className="p-3">Staff</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-[#333] hover:bg-[#2f2f2f]"
                    >
                      <td className="p-3">
                        <div className="font-semibold text-white">
                          {u.name}{" "}
                          {isSelf && (
                            <span className="text-[10px] text-yellow-400 ml-1">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#ababab]">
                          @{u.username}
                          {u.phone ? ` · ${u.phone}` : ""}
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            roleMutation.mutate({
                              userId: u.id,
                              role: e.target.value,
                            })
                          }
                          className="bg-[#1a1a1a] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white capitalize focus:outline-none disabled:opacity-60"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            u.isActive
                              ? "bg-green-950/60 text-green-400 border border-green-800/40"
                              : "bg-red-950/60 text-red-400 border border-red-800/40"
                          }`}
                        >
                          {u.isActive ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPinTargetUser(u);
                              setNewPin("");
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-blue-600/20 text-blue-400 border border-blue-700/40 text-xs font-semibold"
                            title="Change User PIN"
                          >
                            <FaKey size={11} />
                            <span>PIN</span>
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() =>
                                activeMutation.mutate({
                                  userId: u.id,
                                  isActive: !u.isActive,
                                })
                              }
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                                u.isActive
                                  ? "bg-[#1a1a1a] hover:bg-red-600/20 text-red-400 border-red-700/40"
                                  : "bg-[#1a1a1a] hover:bg-green-600/20 text-green-400 border-green-700/40"
                              }`}
                              title={
                                u.isActive
                                  ? "Deactivate Account"
                                  : "Activate Account"
                              }
                            >
                              {u.isActive ? (
                                <>
                                  <FaUserSlash size={11} />
                                  <span>Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <FaUserCheck size={11} />
                                  <span>Activate</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change PIN Modal */}
      {pinTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handlePinSubmit}
            className="bg-[#262626] border border-[#383838] rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#333] pb-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FaKey className="text-yellow-400" />
                Reset PIN — {pinTargetUser.name}
              </h3>
              <button
                type="button"
                onClick={() => setPinTargetUser(null)}
                className="text-[#ababab] hover:text-white"
              >
                <FaTimes />
              </button>
            </div>

            <div>
              <label className="block text-xs text-[#ababab] mb-1">
                New PIN (at least 4 digits/characters)
              </label>
              <input
                type="password"
                autoFocus
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter new PIN"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
              />
            </div>

            <button
              type="submit"
              disabled={pinMutation.isPending}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-2.5 rounded-lg text-sm"
            >
              {pinMutation.isPending ? "Updating..." : "Save New PIN"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default UsersAdmin;

