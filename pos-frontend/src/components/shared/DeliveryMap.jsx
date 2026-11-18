import React from "react";
import { FaExternalLinkAlt, FaMapMarkerAlt, FaMotorcycle, FaStore } from "react-icons/fa";

export const buildGoogleMapsNavUrl = (lat, lng, address = "") => {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return null;
};

const DeliveryMap = ({
  restaurant = null,
  destination = null,
  riderLocation = null,
  heightClass = "h-56",
}) => {
  const activePoint =
    riderLocation?.latitude != null
      ? { lat: riderLocation.latitude, lng: riderLocation.longitude }
      : destination?.lat != null
      ? { lat: destination.lat, lng: destination.lng }
      : restaurant?.lat != null
      ? { lat: restaurant.lat, lng: restaurant.lng }
      : { lat: 5.6037, lng: -0.187 };

  const bboxDelta = 0.025;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
    activePoint.lng - bboxDelta
  }%2C${activePoint.lat - bboxDelta}%2C${activePoint.lng + bboxDelta}%2C${
    activePoint.lat + bboxDelta
  }&layer=mapnik&marker=${activePoint.lat}%2C${activePoint.lng}`;

  const destNavUrl = buildGoogleMapsNavUrl(
    destination?.lat,
    destination?.lng,
    destination?.address
  );
  const restNavUrl = buildGoogleMapsNavUrl(
    restaurant?.lat,
    restaurant?.lng,
    restaurant?.address
  );

  return (
    <div className="bg-[#141414] border border-[#2e2e2e] rounded-xl overflow-hidden">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#2a2a2a] text-xs">
        <div className="flex items-center gap-2">
          <FaMotorcycle className="text-yellow-400" />
          {riderLocation?.latitude != null ? (
            riderLocation.is_live ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Rider Location
              </span>
            ) : (
              <span className="text-amber-400 font-semibold">
                Last Known Location ({new Date(riderLocation.recorded_at).toLocaleTimeString()})
              </span>
            )
          ) : (
            <span className="text-[#888]">Rider GPS Location Unavailable</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {restNavUrl && (
            <a
              href={restNavUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#242424] hover:bg-[#303030] text-[#ccc]"
            >
              <FaStore size={11} />
              <span>Restaurant</span>
              <FaExternalLinkAlt size={9} />
            </a>
          )}
          {destNavUrl && (
            <a
              href={destNavUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-400 hover:bg-yellow-300 text-black font-bold"
            >
              <FaMapMarkerAlt size={11} />
              <span>Navigate</span>
              <FaExternalLinkAlt size={9} />
            </a>
          )}
        </div>
      </div>

      {/* OpenStreetMap Embed with Graceful Fallback */}
      <div className={`relative w-full ${heightClass} bg-[#1a1a1a]`}>
        <iframe
          title="Delivery Map"
          src={osmEmbedUrl}
          className="w-full h-full border-0"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default DeliveryMap;

