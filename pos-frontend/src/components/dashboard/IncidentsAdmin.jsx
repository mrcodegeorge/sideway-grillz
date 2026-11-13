import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaTrash,
  FaTimes,
  FaSearchPlus,
} from "react-icons/fa";
import {
  getIncidents,
  updateIncidentStatus,
  deleteIncident,
} from "../../utils/incidentsStorage";
import { formatDateAndTime } from "../../utils";

const IncidentsAdmin = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [zoomPhoto, setZoomPhoto] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: getIncidents,
  });

  const updateMutation = useMutation({
    mutationFn: updateIncidentStatus,
    onSuccess: () => {
      enqueueSnackbar("Incident review updated!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to update incident.", { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIncident,
    onSuccess: () => {
      enqueueSnackbar("Incident removed.", { variant: "info" });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  const filtered =
    filter === "All"
      ? incidents
      : incidents.filter((item) => item.status === filter);

  const openCount = incidents.filter((i) => i.status === "Open").length;

  return (
    <div className="container mx-auto px-6 md:px-4 pb-24 space-y-5">
      {/* Header & Filter Bar */}
      <div className="bg-[#262626] border border-[#333] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-xl font-bold flex items-center gap-2">
            <FaExclamationTriangle className="text-red-400" />
            Cashier Incident & Quality Reports
          </h2>
          <p className="text-xs text-[#ababab] mt-0.5">
            {openCount} open report{openCount === 1 ? "" : "s"} awaiting admin review
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {["All", "Open", "Under Review", "Resolved"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === st
                  ? "bg-yellow-400 text-gray-900"
                  : "bg-[#1a1a1a] text-[#ababab] hover:text-white border border-[#333]"
                }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Grid */}
      {isLoading ? (
        <div className="bg-[#262626] rounded-xl p-8 text-center text-[#ababab]">
          Loading incident reports...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#262626] border border-[#333] rounded-xl p-8 text-center text-[#ababab]">
          No incident reports in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const currentNote =
              notesDraft[item.id] !== undefined
                ? notesDraft[item.id]
                : item.adminNotes || "";

            return (
              <div
                key={item.id}
                className="bg-[#262626] border border-[#383838] rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Top Meta */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-base">
                          {item.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.severity === "High"
                              ? "bg-red-900/50 text-red-300 border border-red-700/40"
                              : item.severity === "Medium"
                                ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700/40"
                                : "bg-blue-900/50 text-blue-300 border border-blue-700/40"
                            }`}
                        >
                          {item.severity}
                        </span>
                        {item.orderRef && (
                          <span className="bg-[#1a1a1a] text-[#ababab] px-2 py-0.5 rounded text-xs border border-[#333]">
                            Ref: {item.orderRef}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#ababab] mt-1">
                        Reported by{" "}
                        <strong className="text-white">{item.reportedBy}</strong>{" "}
                        · {item.createdAt ? formatDateAndTime(item.createdAt) : "-"}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${item.status === "Resolved"
                          ? "bg-green-950/60 text-green-400 border border-green-800/40"
                          : item.status === "Under Review"
                            ? "bg-blue-950/60 text-blue-400 border border-blue-800/40"
                            : "bg-red-950/60 text-red-400 border border-red-800/40"
                        }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-[#e5e5e5] bg-[#1a1a1a] p-3 rounded-lg border border-[#333]">
                    {item.description}
                  </p>

                  {/* Photo Thumbnail */}
                  {item.photoData && (
                    <div
                      onClick={() => setZoomPhoto(item.photoData)}
                      className="relative group cursor-pointer rounded-lg overflow-hidden border border-[#383838] bg-black"
                    >
                      <img
                        src={item.photoData}
                        alt={item.category}
                        className="w-full max-h-56 object-cover group-hover:opacity-85 transition-opacity"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1.5">
                        <FaSearchPlus size={11} /> Click to enlarge
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin Review Controls */}
                <div className="pt-3 border-t border-[#333] space-y-2">
                  <input
                    type="text"
                    value={currentNote}
                    onChange={(e) =>
                      setNotesDraft((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    placeholder="Add admin review note / action taken..."
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                  />

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: item.id,
                            status: "Under Review",
                            adminNotes: currentNote,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-700/40 hover:bg-blue-600/30"
                      >
                        Mark Under Review
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: item.id,
                            status: "Resolved",
                            adminNotes: currentNote,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600/20 text-green-300 border border-green-700/40 hover:bg-green-600/30 flex items-center gap-1"
                      >
                        <FaCheckCircle size={11} /> Resolve
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-950/30"
                      title="Delete report"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Lightbox */}
      {zoomPhoto && (
        <div
          onClick={() => setZoomPhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div className="relative max-w-3xl w-full">
            <button
              type="button"
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-yellow-400 flex items-center gap-1 text-sm font-bold"
            >
              <FaTimes /> Close
            </button>
            <img
              src={zoomPhoto}
              alt="Enlarged evidence"
              className="w-full max-h-[85vh] object-contain rounded-lg border border-[#444]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentsAdmin;

