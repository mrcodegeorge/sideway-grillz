import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../supabase/client";
import {
  getDeliveryCollections,
  getDeliveryIncidents,
  getDeliverySettings,
  getDeliveryTasks,
  getDeliveryZones,
  getRiders,
  getRiderSettlements,
} from "../../../https/deliveryApi";
import DeliveryOverview from "./DeliveryOverview";
import DispatchBoard from "./DispatchBoard";
import RidersAdmin from "./RidersAdmin";
import DeliveryZonesAdmin from "./DeliveryZonesAdmin";
import DeliveryFinanceAdmin from "./DeliveryFinanceAdmin";
import DeliveryReportsAdmin from "./DeliveryReportsAdmin";
import DeliverySettingsAdmin from "./DeliverySettingsAdmin";

const SUB_TABS = [
  "Overview",
  "Dispatch Board",
  "Riders",
  "Delivery Zones",
  "Collections & Settlements",
  "Reports & Incidents",
  "Settings",
];

const DeliveryManagement = () => {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState("Overview");
  const [dateFilter, setDateFilter] = useState("today");

  const { data: tasks = [], refetch: refetchTasks, isFetching } = useQuery({
    queryKey: ["delivery-tasks"],
    queryFn: () => getDeliveryTasks(),
  });
  const { data: riders = [] } = useQuery({
    queryKey: ["delivery-riders"],
    queryFn: getRiders,
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: getDeliveryZones,
  });
  const { data: collections = [] } = useQuery({
    queryKey: ["delivery-collections"],
    queryFn: () => getDeliveryCollections(),
  });
  const { data: settlements = [] } = useQuery({
    queryKey: ["rider-settlements"],
    queryFn: () => getRiderSettlements(),
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ["delivery-incidents"],
    queryFn: getDeliveryIncidents,
  });
  const { data: settings } = useQuery({
    queryKey: ["delivery-settings"],
    queryFn: getDeliverySettings,
  });

  // Selective Supabase Realtime subscription for live dispatch updates
  useEffect(() => {
    const channel = supabase
      .channel("delivery-dispatch-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_tasks" },
        () => queryClient.invalidateQueries({ queryKey: ["delivery-tasks"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "riders" },
        () => queryClient.invalidateQueries({ queryKey: ["delivery-riders"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-4 py-2 space-y-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2a2a2a] pb-3">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              subTab === t
                ? "bg-yellow-400 text-black"
                : "bg-[#1a1a1a] text-[#ababab] border border-[#2e2e2e] hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === "Overview" && (
        <DeliveryOverview
          tasks={tasks}
          riders={riders}
          collections={collections}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          onRefresh={() => refetchTasks()}
          isFetching={isFetching}
        />
      )}
      {subTab === "Dispatch Board" && (
        <DispatchBoard tasks={tasks} riders={riders} zones={zones} settings={settings} />
      )}
      {subTab === "Riders" && <RidersAdmin riders={riders} tasks={tasks} />}
      {subTab === "Delivery Zones" && <DeliveryZonesAdmin zones={zones} />}
      {subTab === "Collections & Settlements" && (
        <DeliveryFinanceAdmin collections={collections} settlements={settlements} />
      )}
      {subTab === "Reports & Incidents" && (
        <DeliveryReportsAdmin
          tasks={tasks}
          riders={riders}
          zones={zones}
          collections={collections}
          settlements={settlements}
          incidents={incidents}
        />
      )}
      {subTab === "Settings" && <DeliverySettingsAdmin settings={settings} />}
    </div>
  );
};

export default DeliveryManagement;

