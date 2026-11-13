import React, { useEffect, useState } from "react";
import restaurantImg from "../assets/images/restaurant-img.jpg";
import butterChickenImg from "../assets/images/butter-chicken-4.jpg";
import biryaniImg from "../assets/images/hyderabadibiryani.jpg";
import paneerTikkaImg from "../assets/images/paneer-tika.webp";
import masalaDosaImg from "../assets/images/masala-dosa.jpg";
import roganJoshImg from "../assets/images/rogan-josh.jpg";
import choleBhatureImg from "../assets/images/chole-bhature.jpg";
import gulabJamunImg from "../assets/images/gulab-jamun.webp";
import logo from "../assets/images/logo.png";
import Login from "../components/auth/Login";

const LOGIN_SLIDES = [
  {
    image: restaurantImg,
    quote:
      "Serve customers the best food with prompt and friendly service in a welcoming atmosphere, and they’ll keep coming back.",
    author: "Founder of Sideways Grillz",
  },
  {
    image: butterChickenImg,
    quote:
      "Great food brings people together; great hospitality keeps them at the table.",
    author: "Sideways Grillz Kitchen",
  },
  {
    image: biryaniImg,
    quote:
      "Every plate that leaves the grill carries our pride, flavor, and care.",
    author: "Sideways Grillz",
  },
  {
    image: paneerTikkaImg,
    quote:
      "Consistency in taste and warmth in service turn first-time guests into family.",
    author: "Sideways Grillz Team",
  },
  {
    image: masalaDosaImg,
    quote:
      "Speed at the counter, precision in the kitchen, and a smile at every table.",
    author: "Sideways Grillz",
  },
  {
    image: roganJoshImg,
    quote:
      "Memorable dining starts the moment a guest walks through our doors.",
    author: "Sideways Grillz Hospitality",
  },
  {
    image: choleBhatureImg,
    quote:
      "Fresh ingredients, bold spices, and service you can count on every shift.",
    author: "Sideways Grillz Kitchen",
  },
  {
    image: gulabJamunImg,
    quote:
      "End every meal on a sweet note—little details make the biggest impression.",
    author: "Sideways Grillz",
  },
];

const getNextLoginSlide = () => {
  try {
    const lastIdx = Number(localStorage.getItem("sideways_login_img_idx"));
    const nextIdx = Number.isNaN(lastIdx)
      ? Math.floor(Math.random() * LOGIN_SLIDES.length)
      : (lastIdx + 1) % LOGIN_SLIDES.length;
    localStorage.setItem("sideways_login_img_idx", String(nextIdx));
    return LOGIN_SLIDES[nextIdx];
  } catch {
    return LOGIN_SLIDES[0];
  }
};

const Auth = () => {
  const [slide] = useState(getNextLoginSlide);

  useEffect(() => {
    document.title = "Sideways Grillz | Auth"
  }, [])

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Section */}
      <div className="w-1/2 relative flex items-center justify-center bg-cover">
        {/* BG Image */}
        <img className="w-full h-full object-cover transition-opacity duration-500" src={slide.image} alt="Sideways Grillz" />

        {/* Black Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-80"></div>

        {/* Quote at bottom */}
        <blockquote className="absolute bottom-10 px-8 mb-10 text-2xl italic text-white">
          "{slide.quote}"
          <br />
          <span className="block mt-4 text-yellow-400">- {slide.author}</span>
        </blockquote>
      </div>

      {/* Right Section */}
      <div className="w-1/2 min-h-screen bg-[#1a1a1a] p-10">
        <div className="flex flex-col items-center gap-2">
          <img src={logo} alt="Sideways Grillz Logo" className="h-16 w-16 object-contain rounded-xl border border-yellow-400/30 p-1 bg-black/40 shadow-lg" />
          <h1 className="text-2xl font-bold text-yellow-400 tracking-wide">Sideways Grillz</h1>
        </div>

        <h2 className="text-4xl text-center mt-10 font-semibold text-yellow-400 mb-10">
          Employee Login
        </h2>

        {/* Login Component */}
        <Login />

        <div className="flex flex-col items-center gap-2 mt-6">
          <p className="text-xs text-[#ababab]">
            Need a staff account or PIN reset? Contact your Administrator.
          </p>
          <p className="text-[11px] text-[#777] tracking-wide mt-2">
            Built by <span className="text-yellow-400 font-semibold">Neolifeporium</span>
          </p>
        </div>


      </div>
    </div>
  );
};

export default Auth;
