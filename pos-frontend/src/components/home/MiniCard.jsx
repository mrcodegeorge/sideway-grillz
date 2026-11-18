import React from 'react'

const MiniCard = ({ title, icon, number, footerNum }) => {
  return (
    <div className='bg-[#1a1a1a] py-4 sm:py-5 px-4 sm:px-5 rounded-lg w-full sm:w-[50%]'>
      <div className='flex items-start justify-between gap-2'>
        <h1 className='text-[#f5f5f5] text-base sm:text-lg font-semibold tracking-wide'>{title}</h1>
        <button className={`${title === "Total Earnings" ? "bg-[#02ca3a]" : "bg-[#f6b100]"} p-2.5 sm:p-3 rounded-lg text-[#f5f5f5] text-xl sm:text-2xl shrink-0`}>{icon}</button>
      </div>
      <div>
        <h1 className='text-[#f5f5f5] text-2xl sm:text-4xl font-bold mt-4 sm:mt-5'>{
          title === "Total Earnings" ? `GH₵ ${number}` : number}</h1>
        <h1 className='text-[#f5f5f5] text-sm sm:text-lg mt-2'><span className='text-[#02ca3a]'>{footerNum}%</span> than yesterday</h1>
      </div>
    </div>
  )
}

export default MiniCard