import React, { useState, useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import TableCard from "../components/tables/TableCard";
import { tables } from "../constants";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTables } from "../https";

const Tables = () => {
  const [status, setStatus] = useState("all");

    useEffect(() => {
      document.title = "POS | Tables"
    }, [])

  const { data: resData, isError } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      return await getTables();
    },
    placeholderData: keepPreviousData,
  });

  if(isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" })
  }

  console.log(resData);

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] lg:h-[calc(100vh-5rem)] lg:overflow-hidden pb-24 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 lg:px-10 py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-xl sm:text-2xl font-bold tracking-wider">
            Tables
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setStatus("all")}
            className={`text-[#ababab] text-sm sm:text-lg ${
              status === "all" && "bg-[#383838] text-white"
            } rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 font-semibold cursor-pointer`}
          >
            All
          </button>
          <button
            onClick={() => setStatus("booked")}
            className={`text-[#ababab] text-sm sm:text-lg ${
              status === "booked" && "bg-[#383838] text-white"
            } rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 font-semibold cursor-pointer`}
          >
            Booked
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 px-4 sm:px-8 lg:px-16 py-4 lg:h-[calc(100vh-13rem)] overflow-y-auto scrollbar-hide">
        {resData?.data.data.map((table) => {
          return (
            <TableCard
              id={table._id}
              name={table.tableNo}
              status={table.status}
              initials={table?.currentOrder?.customerDetails.name}
              seats={table.seats}
            />
          );
        })}
      </div>

      <BottomNav />
    </section>
  );
};

export default Tables;
