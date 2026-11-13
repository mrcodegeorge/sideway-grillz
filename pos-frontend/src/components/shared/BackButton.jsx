import React from 'react'
import { FaArrowLeft } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'

const BackButton = () => {

    const navigate = useNavigate();

  return (
    <button onClick={() => navigate(-1)} className='bg-[#025cca] p-2 text-xl font-bold rounded-full text-white '> 
        <FaArrowLeft />
    </button>
  )
}

export default BackButton