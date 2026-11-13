import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  FaCamera,
  FaUpload,
  FaTimes,
  FaExclamationTriangle,
  FaRedo,
} from "react-icons/fa";
import { addIncident } from "../../utils/incidentsStorage";
import { dispatchEmailIfEnabled } from "../../utils/settingsStorage";

const CATEGORIES = [
  "Bad / Spoiled Food",
  "Customer Complaint",
  "Aggravated Behaviour",
  "Other Issue",
];

const SEVERITIES = ["Low", "Medium", "High"];

const compressImageDataUrl = (imgElementOrCanvas, maxWidth = 900) => {
  const width = imgElementOrCanvas.videoWidth || imgElementOrCanvas.width;
  const height = imgElementOrCanvas.videoHeight || imgElementOrCanvas.height;
  const scale = width > maxWidth ? maxWidth / width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElementOrCanvas, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
};

const IncidentReportModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const userData = useSelector((state) => state.user);

  const [category, setCategory] = useState("Bad / Spoiled Food");
  const [severity, setSeverity] = useState("Medium");
  const [orderRef, setOrderRef] = useState("");
  const [description, setDescription] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        enqueueSnackbar("Camera not supported in this browser. Use Upload Photo instead.", {
          variant: "warning",
        });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      enqueueSnackbar("Could not access camera. Please allow camera permission or upload a photo.", {
        variant: "error",
      });
    }
  };

  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const dataUrl = compressImageDataUrl(videoRef.current);
    setPhotoData(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const compressed = compressImageDataUrl(img);
        setPhotoData(compressed);
        stopCamera();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const mutation = useMutation({
    mutationFn: addIncident,
    onSuccess: (created) => {
      enqueueSnackbar("Incident submitted for Admin review!", {
        variant: "success",
      });
      dispatchEmailIfEnabled({
        eventType: "incident",
        subject: `[Alert] ${created.severity} Incident: ${created.category}`,
        text: `Reported by: ${created.reportedBy}\nCategory: ${created.category}\nSeverity: ${created.severity}\nOrder/Table Ref: ${created.orderRef || "N/A"}\n\nDetails:\n${created.description}`,
      });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setCategory("Bad / Spoiled Food");
      setSeverity("Medium");
      setOrderRef("");
      setDescription("");
      setPhotoData("");
      stopCamera();
      onClose();
    },
    onError: () => {
      enqueueSnackbar("Failed to submit incident report.", { variant: "error" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() && !photoData) {
      enqueueSnackbar("Please snap/upload a photo or describe the concern.", {
        variant: "warning",
      });
      return;
    }

    mutation.mutate({
      category,
      severity,
      orderRef,
      description: description.trim() || `${category} reported with photo evidence.`,
      photoData,
      reportedBy: userData?.name || userData?.username || "Cashier",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
      <div className="bg-[#262626] border border-[#383838] rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#383838] pb-3 mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FaExclamationTriangle className="text-red-400" />
            Report Issue / Snap Evidence
          </h2>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-[#ababab] hover:text-white p-1"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs text-[#ababab] mb-1.5 font-medium">
              Concern Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors ${category === cat
                      ? "bg-[#f6b100] text-[#1f1f1f]"
                      : "bg-[#1a1a1a] text-[#ababab] hover:text-white border border-[#333]"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Severity + Order/Table Ref */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#ababab] mb-1.5 font-medium">
                Severity
              </label>
              <div className="grid grid-cols-3 gap-1">
                {SEVERITIES.map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors ${severity === sev
                        ? sev === "High"
                          ? "bg-red-500 text-white"
                          : sev === "Medium"
                            ? "bg-yellow-500 text-[#1f1f1f]"
                            : "bg-blue-500 text-white"
                        : "bg-[#1a1a1a] text-[#ababab] border border-[#333]"
                      }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#ababab] mb-1.5 font-medium">
                Table / Order # (Optional)
              </label>
              <input
                type="text"
                value={orderRef}
                onChange={(e) => setOrderRef(e.target.value)}
                placeholder="e.g. Table 4 or #4821"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#f6b100]"
              />
            </div>
          </div>

          {/* Camera / Photo Capture */}
          <div>
            <label className="block text-xs text-[#ababab] mb-1.5 font-medium">
              Photo Evidence (Optional)
            </label>

            {!cameraActive && !photoData && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#333] border border-[#383838] text-white py-3 rounded-lg text-xs font-semibold transition-colors"
                >
                  <FaCamera className="text-[#f6b100]" />
                  <span>Open Camera & Snap</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#333] border border-[#383838] text-white py-3 rounded-lg text-xs font-semibold transition-colors"
                >
                  <FaUpload className="text-blue-400" />
                  <span>Upload / Take Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {cameraActive && (
              <div className="bg-black rounded-lg overflow-hidden border border-[#383838]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-60 object-cover"
                />
                <div className="flex items-center justify-between p-2 bg-[#1a1a1a]">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="text-xs text-[#ababab] hover:text-white px-3 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSnapPhoto}
                    className="bg-[#f6b100] hover:bg-yellow-500 text-[#1f1f1f] font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <FaCamera /> Snap Photo
                  </button>
                </div>
              </div>
            )}

            {photoData && (
              <div className="relative bg-[#1a1a1a] rounded-lg p-2 border border-[#383838]">
                <img
                  src={photoData}
                  alt="Captured evidence"
                  className="w-full max-h-56 object-contain rounded"
                />
                <button
                  type="button"
                  onClick={() => setPhotoData("")}
                  className="mt-2 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  <FaRedo size={11} /> Remove / Retake Photo
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-[#ababab] mb-1.5 font-medium">
              Details / Notes for Admin
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the food quality issue, customer concern, or incident..."
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f6b100]"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-[#f6b100] hover:bg-yellow-500 text-[#1f1f1f] font-bold py-3 rounded-lg text-sm transition-colors"
          >
            {mutation.isPending ? "Submitting..." : "Submit for Admin Review"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default IncidentReportModal;

