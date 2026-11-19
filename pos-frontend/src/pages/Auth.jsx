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
    <div className="flex flex-col lg:flex-row min-h-[100dvh] w-full overflow-x-hidden bg-[#1a1a1a]">
      {/* Left Section (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-cover">
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

      {/* Compact Mobile Hero Banner */}
      <div className="relative lg:hidden w-full h-32 sm:h-40 shrink-0 overflow-hidden">
        <img className="w-full h-full object-cover" src={slide.image} alt="Sideways Grillz" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-black/70 to-black/40" />
        <div className="absolute inset-x-4 bottom-2.5 text-center">
          <p className="text-[11px] sm:text-xs italic text-white/90 line-clamp-2">
            &ldquo;{slide.quote}&rdquo;
          </p>
        </div>
      </div>

      {/* Right Section (Login Form) */}
      <div className="w-full lg:w-1/2 flex-1 bg-[#1a1a1a] px-4 py-5 sm:px-8 sm:py-8 lg:p-10 flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto">
          <div className="flex flex-col items-center gap-1.5 sm:gap-2">
            <img src={logo} alt="Sideways Grillz Logo" className="h-12 w-12 sm:h-16 sm:w-16 object-contain rounded-xl border border-yellow-400/30 p-1 bg-black/40 shadow-lg" />
            <h1 className="text-xl sm:text-2xl font-bold text-yellow-400 tracking-wide">Sideways Grillz</h1>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl text-center mt-4 sm:mt-6 lg:mt-8 font-semibold text-yellow-400 mb-5 sm:mb-7">
            Employee Login
          </h2>

          {/* Login Component */}
          <Login />

          <div className="flex flex-col items-center gap-1.5 mt-5 sm:mt-6 text-center">
            <p className="text-[11px] sm:text-xs text-[#ababab]">
              Need a staff account or PIN reset? Contact your Administrator.
            </p>
            <p className="text-[11px] text-[#777] tracking-wide mt-1">
              Built by <span className="text-yellow-400 font-semibold">Neolifeporium</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
