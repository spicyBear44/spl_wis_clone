import { useEffect, useState } from "react";
import AuthForm from "../components/AuthForm";

const mascotImages = [
  "/images/Image%20%20(1).png",
  "/images/Image%20%20(2).png",
  "/images/Image%20%20(3).png",
  "/images/Image%20%20(4).png",
  "/images/Image%20%20(5).png",
  "/images/Image%20%20(6).png",
  "/images/Image%20%20(7).png"
];

export default function AuthPage({ mode }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveImageIndex((currentIndex) => (currentIndex + 1) % mascotImages.length);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="auth-shell">
      <div className="auth-logo-mark">
        <img src="/images/wiselysplit-leaf-logo.svg" alt="WiselySplit logo" />
        <span>WiselySplit</span>
      </div>
      <div className="brand-block">
        <h1>WiselySplit Those Benjamins</h1>
        <p>Track shared spending, split balances cleanly, and settle up without the mess.</p>
      </div>
      <div className="auth-panel">
        <AuthForm mode={mode} />
        <div className="auth-mascot-card">
          <div className="auth-mascot-carousel" aria-hidden="true">
            {mascotImages.map((imageSrc, index) => (
              <img
                src={imageSrc}
                alt=""
                className={`auth-mascot-image ${index === activeImageIndex ? "active" : ""}`}
                key={imageSrc}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
