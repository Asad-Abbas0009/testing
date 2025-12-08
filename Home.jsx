import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import Footer from '../components/Footer';
import ScrollToTop from '../components/ScrollToTop';
import blsImg from '../assets/WorkshopImages/bls.jpeg';
import nrpImg from '../assets/WorkshopImages/nrp.jpeg';

import amniocentesisImg from '../assets/WorkshopImages/amniocentesis.jpg';
import amnioCvsImg from '../assets/WorkshopImages/amniocvs.jpeg';
import bullEyeImg from '../assets/WorkshopImages/BullsEyeNew.webp';
import laproscopicSimulatorImg from '../assets/WorkshopImages/vintekworkshop1.jpg';
import hysteroscopeImg from '../assets/WorkshopImages/Hysteroscope.png';
import endotrainersImg from '../assets/WorkshopImages/endotrainers.jpg';
import pphImg from '../assets/WorkshopImages/PPH___.jpg';
import colposcopeImg from '../assets/WorkshopImages/Colposcope.jpg';
import usgSimulatorImg from '../assets/WorkshopImages/USG Simulator.png';
import lapsimImg from '../assets/WorkshopImages/Picture1.png';
import roboticsSimulatorImg from '../assets/WorkshopImages/roboticSimulator.png';
import virtualRealityImg from '../assets/WorkshopImages/VirtualReality.jpg';
import fetalTherapyImg from '../assets/WorkshopImages/fetaltherapysimulators.png';

// Use Vite env var for API base, fallback to localhost:4001
const API_BASE = "https://onesimulation.site";

const Home = () => {
  const navigate = useNavigate();

  // Auto-scroll to top when component mounts (instant scroll for immediate effect)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Companies - Manually ordered
  const companies = useMemo(() => ([
    {
      id: 1,
      title: "Endotrainers",
      category: "Healthcare",
      rating: "4.5",
      image: null,
      fallbackBg: "bg-gradient-to-br from-green-200 to-emerald-100",
      logo: endotrainersImg,
      workshops: [
        "Realistic practice for specific laparoscopic procedures"
      ]
    },
    {
      id: 2,
      title: "Lapsim",
      category: "Healthcare Simulation Company",
      image: null,
      fallbackBg: "bg-gradient-to-br from-blue-400 to-cyan-300",
      logo: lapsimImg,
      workshops: [
        "High fidelity simulator with tactile feedback, detailed graphics; includes pre-set modules from basic to advanced laparoscopic procedures."
      ]
    },
    {
      id: 3,
      title: "Robotics",
      category: "Medical Training",
      rating: "4.8",
      image: null,
      fallbackBg: "bg-yellow-400",
      logo: roboticsSimulatorImg,
      workshops: [
        "High fidelity simulator with tactile feedback, detailed graphics; includes pre-set modules from basic to advanced laparoscopic procedures."
      ]
    },
    {
      id: 4,
      title: "Hysteroscope",
      category: "Endoscopy & Surgical Equipment",
      rating: "4.7",
      image: null,
      fallbackBg: "bg-teal-400",
      logo: hysteroscopeImg,
      workshops: [
        "For learning hysteroscopy skills, eg, navigation of hysteroscope, improves hand eye coordination"
      ]
    },
    {
      id: 5,
      title: "Colposcope",
      category: "Healthcare Products",
      rating: "4.6",
      image: null,
      fallbackBg: "bg-red-400",
      logo: colposcopeImg,
      workshops: [
        "Simulation for colposcopy"
      ]
    },
    {
      id: 6,
      title: "Fetal Ultrasound Imaging Simulators",
      category: "Healthcare Technology",
      rating: "4.2",
      image: null,
      fallbackBg: "bg-green-400",
      logo: usgSimulatorImg,
      workshops: [
        "Real life simulation for fetal scanning NT scan Fetal Biometry"
      ]
    },
    {
      id: 7,
      title: "Birthing Simulators",
      category: "Healthcare Simulation",
      rating: "4.7",
      image: null,
      fallbackBg: "bg-purple-400",
      logo: pphImg,
      workshops: [
        "A training tool used by medical professionals to practice childbirth and related procedures"
      ]
    },
    {
      id: 8,
      title: "Virtual Reality Simulators",
      category: "Medical Equipment & Training",
      rating: "4.6",
      image: null,
      fallbackBg: "bg-pink-400",
      logo: virtualRealityImg,
      workshops: [
        "Practice stepwise management virtually"
      ]
    },
    {
      id: 9,
      title: "Fetal Interventions Simulators",
      category: "Resuscitation Training & Emergency Care",
      rating: "4.9",
      image: null,
      fallbackBg: "bg-indigo-400",
      logo: fetalTherapyImg,
      workshops: [
        "Get real like experience of USG guided procedures"
      ]
    },
    {
      id: 10,
      title: "Basic Life Support",
      category: "Resuscitation Training & Emergency Care",
      rating: "4.9",
      image: null,
      fallbackBg: "bg-indigo-400",
      logo: blsImg,
      workshops: [
        "Get real like experience of USG guided procedures"
      ]
    },
    {
      id: 11,
      title: "Neonatal Resuscitation",
      category: "Resuscitation Training & Emergency Care",
      rating: "4.9",
      image: null,
      fallbackBg: "bg-indigo-400",
      logo: nrpImg,
      workshops: [
        "Get real like experience of USG guided procedures"
      ]
    },
    // {
    //   id: 10,
    //   title: "NN Recusc",
    //   category: "Neonatal Resuscitation",
    //   rating: "4.5",
    //   image: null,
    //   fallbackBg: "bg-teal-400",
    //   logo: null,
    //   workshops: []
    // },
    // {
    //   id: 9,
    //   title: "Hysteroscopy",
    //   category: "Gynecological Procedures",
    //   rating: "4.4",
    //   image: null,
    //   fallbackBg: "bg-pink-400",
    //   logo: null,
    //   workshops: []
    // },
    // {
    //   id: 10,
    //   title: "Colposcopy",
    //   category: "Cervical Examination",
    //   rating: "4.6",
    //   image: null,
    //   fallbackBg: "bg-orange-400",
    //   logo: null,
    //   workshops: []
    // }
  ]), []);

  // Local helper for today's date in YYYY-MM-DD
  const todayLocalString = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // ---------- Top workshops: fetch from backend ----------
  const [workshops, setWorkshops] = useState([]);      // items to display in the grid
  const [sameDayWorkshops, setSameDayWorkshops] = useState([]); // if any for today
  const [loadingWorkshops, setLoadingWorkshops] = useState(true);
  const [workshopsError, setWorkshopsError] = useState(null);

  // useEffect(() => {
  //   const ac = new AbortController();
  //   setLoadingWorkshops(true);
  //   setWorkshopsError(null);

  //   const fetchWorkshops = async () => {
  //     try {
  //       // 1) Try same-day available workshops (use API_BASE)
  //       const res = await fetch(`${API_BASE}/api/workshops/sameday?date=${todayLocalString}&available=true&limit=5`, {
  //         method: 'GET',
  //         headers: { Accept: 'application/json' },
  //         signal: ac.signal
  //       });

  //       if (!res.ok) throw new Error(`sameday status ${res.status}`);

  //       const data = await res.json();
  //       if (Array.isArray(data) && data.length > 0) {
  //         setSameDayWorkshops(data);
  //         setWorkshops(data);
  //         setLoadingWorkshops(false);
  //         return;
  //       }
        

  //       // 2) Fallback -> fetch top overall
  //       const res2 = await fetch(`${API_BASE}/api/workshops/top?limit=5`, {
  //         method: 'GET',
  //         headers: { Accept: 'application/json' },
  //         signal: ac.signal
  //       });
  //       if (!res2.ok) throw new Error(`top status ${res2.status}`);
  //       const topData = await res2.json();
  //       setSameDayWorkshops([]);
  //       setWorkshops(Array.isArray(topData) ? topData : []);
  //       setLoadingWorkshops(false);
  //       console.log(topData + " - No same-day workshops found, falling back to top overall.");
  //     } catch (err) {
  //       if (ac.signal.aborted) return;
  //       console.error("Workshops fetch error:", err);
  //       setWorkshopsError(err.message || 'Failed to load workshops');
  //       setLoadingWorkshops(false);
  //     }
  //   };

  //   fetchWorkshops();
  //   return () => ac.abort();
  // }, [todayLocalString]);


useEffect(() => {
  const ac = new AbortController();
  setLoadingWorkshops(true);
  setWorkshopsError(null);

  const fetchWorkshops = async () => {
    try {
      console.log("🔍 Fetching same-day workshops...");

      // 1️⃣ Try same-day available workshops
      const res = await fetch(
        `${API_BASE}/api/workshops/sameday?date=${todayLocalString}&available=true&limit=5`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: ac.signal
        }
      );

      console.log("✅ Same-day response status:", res.status);

      if (!res.ok) throw new Error(`sameday status ${res.status}`);

      const data = await res.json();
      console.log("📦 Same-day data received:", JSON.stringify(data, null, 2));

      if (Array.isArray(data) && data.length > 0) {
        setSameDayWorkshops(data);
        setWorkshops(data);
        setLoadingWorkshops(false);
        console.log("✅ Loaded same-day workshops:", data);
        return;
      }

      // 2️⃣ Fallback → fetch top overall
      console.log("⚠️ No same-day workshops found, fetching top overall...");
      const res2 = await fetch(`${API_BASE}/api/workshops/top?limit=5`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: ac.signal
      });

      console.log("✅ Top response status:", res2.status);
      if (!res2.ok) throw new Error(`top status ${res2.status}`);

      const topData = await res2.json();
      console.log("📦 Top workshops data:", JSON.stringify(topData, null, 2));

      setSameDayWorkshops([]);
      setWorkshops(Array.isArray(topData) ? topData : []);
      setLoadingWorkshops(false);

      console.log("ℹ️ Fallback data used:", topData);
    } catch (err) {
      if (ac.signal.aborted) return;
      console.error("❌ Workshops fetch error:", err);
      setWorkshopsError(err.message || 'Failed to load workshops');
      setLoadingWorkshops(false);
    }
  };

  fetchWorkshops();
  return () => ac.abort();
}, [todayLocalString]);





  // // ---------- Static fallback topWorkshops (kept for reference; not used if backend returns) ----------
  // const staticTopWorkshops = useMemo(() => ([
  //   {
  //     id: 1,
  //     name: "Amniocentesis",
  //     company: "One Simulation",
  //     companyId: 1,
  //     color: "bg-gradient-to-br from-blue-500 to-blue-700",
  //     image: amniocentesisImg
  //   },
  //   {
  //     id: 2,
  //     name: "Ultrasound Simulator",
  //     company: "Endotrainers",
  //     companyId: 2,
  //     color: "bg-gradient-to-br from-green-500 to-green-700",
  //     image: usgSimulatorImg
  //   },
  //   {
  //     id: 3,
  //     name: "CVS",
  //     company: "One Simulation",
  //     companyId: 1,
  //     color: "bg-gradient-to-br from-green-500 to-green-700",
  //     image: amnioCvsImg
  //   },
  //   {
  //     id: 4,
  //     name: "Bull's Eye (Hit the target)",
  //     company: "One Simulation",
  //     companyId: 1,
  //     color: "bg-gradient-to-br from-purple-500 to-purple-700",
  //     image: bullEyeImg
  //   },
  //   {
  //     id: 5,
  //     name: "Laproscopic Simulator",
  //     company: "Endotrainers",
  //     companyId: 2,
  //     color: "bg-gradient-to-br from-orange-500 to-orange-700",
  //     image: laproscopicSimulatorImg
  //   },
  //   {
  //     id: 6,
  //     name: "Hysteroscope",
  //     company: "One Simulation",
  //     companyId: 1,
  //     color: "bg-gradient-to-br from-amber-500 to-amber-700",
  //     image: hysteroscopeImg
  //   },
  //   {
  //     id: 7,
  //     name: "PPH",
  //     company: "LAerdal",
  //     companyId: 5,
  //     color: "bg-gradient-to-br from-red-500 to-red-700",
  //     image: pphImg
  //   },
  //   {
  //     id: 8,
  //     name: "Endotrainers",
  //     company: "J&J",
  //     companyId: 6,
  //     color: "bg-gradient-to-br from-cyan-500 to-cyan-700",
  //     image: endotrainersImg
  //   },
  //       {
  //     id: 10,
  //     name: "Endotrainers",
  //     company: "J&J",
  //     companyId: 6,
  //     color: "bg-gradient-to-br from-cyan-500 to-cyan-700",
  //     image: endotrainersImg
  //   },
  //     {
  //     id: 11,
  //     name: "Endotrainers",
  //     company: "J&J",
  //     companyId: 6,
  //     color: "bg-gradient-to-br from-cyan-500 to-cyan-700",
  //     image: endotrainersImg
  //   }
  // ]), []);

  // Map workshop.id -> company id per your rules
const mapWorkshopToCompany = useCallback((workshopId) => {
  if (workshopId >= 1 && workshopId <= 6) return 1;     // One Simulation (c1-c6)
  if (workshopId >= 7 && workshopId <= 9) return 2;     // Vintek (c7-c9)
  if (workshopId === 10) return 3;                      // GE (c10)
  if (workshopId === 11) return 4;                      // DSS (c11)
  if (workshopId >= 12 && workshopId <= 18) return 5;  // Laerdal (c12-c18)
  if (workshopId === 19) return 6;                      // J&J (c19)
  if (workshopId === 20) return 7;                      // AIIMS (c20)
  if (workshopId === 21) return 5;                      // Laerdal - PPH (c21)
  if (workshopId === 22) return 5;                      // Laerdal - Shoulder Dystocia (c22)
  if (workshopId === 23) return 5;                      // Laerdal - Eclampsia (c23)
  if (workshopId === 24) return 5;                      // Laerdal - Amniotic fluid embolism (c24)
  if (workshopId === 25) return 5;                      // Laerdal - Postpartum Collapse (c25)
  if (workshopId === 26) return 5;                      // Laerdal - Fetal Distress (c26)
  if (workshopId === 27) return 5;                      // Laerdal - Caesarean Delivery (c27)
  if (workshopId === 28) return 4;                      // DSS - Twin Birthing (c28)
  if (workshopId === 29) return 2;                      // Vintek - Lapsim (c29)
  if (workshopId === 30) return 2;                      // Vintek - Amniocentasis (c30)
  if (workshopId === 31) return 1;                      // One Simulation - Intrauterine Transfusion (c31)
  if (workshopId === 32) return 1;                      // One Simulation - Radiofrequency Ablation (c32)
  if (workshopId === 33) return 1;                      // One Simulation - Hysteroscope (c33)
  if (workshopId === 34) return 8;                      // Karl Storz - Hysteroscope (c34)
  if (workshopId === 35) return 9;                      // Borze - Hysteroscope (c35)
  if (workshopId === 36) return 9;                      // Borze - Colposcope (c36)
  if (workshopId === 37) return 10;  
  if (workshopId === 38) return 11;  
  if (workshopId === 39) return 11;  
  if (workshopId === 40) return 4;  
  if (workshopId === 41) return 6;  
  if (workshopId === 42) return 6;    
  return 1; // fallback
}, []);


  // ---------- Handlers ----------
  const handleCardClick = useCallback((movieId) => {
    // Direct navigation to workshop slots page with movieId
    const params = new URLSearchParams({
      movieId: String(movieId),
      date: todayLocalString
    });
    navigate(`/select-slot?${params.toString()}`);
  }, [navigate, todayLocalString]);

  const handleWorkshopClick = useCallback((companyId) => {
    // Direct navigation to workshop slots page with companyId
    const params = new URLSearchParams({
      movieId: String(companyId),
      date: todayLocalString
    });
    navigate(`/select-slot?${params.toString()}`);
  }, [navigate, todayLocalString]);

  const handleKeyActivate = (e, fn) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  // Helper to resolve image src from backend item or fallback to static
  const getImageSrc = (w) => {
    // backend returns imageUrl (may be empty or just base URL)
    if (w?.imageUrl && !w.imageUrl.endsWith('4000') && !w.imageUrl.endsWith('4000/')) {
      return w.imageUrl;
    }
    if (w?.image) return w.image;
    return null; // return null if no image
  };

  // Helper to check if workshop has a valid image
  const hasValidImage = (workshop) => {
    // Check if imageUrl exists and is not just the base URL
    const hasImageUrl = workshop?.imageUrl && 
                        !workshop.imageUrl.endsWith('4000') && 
                        !workshop.imageUrl.endsWith('4000/');
    return Boolean(hasImageUrl || workshop?.image);
  };

  // Helper to get gradient colors based on workshop id
  const getGradientColors = (workshopId) => {
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-pink-500 to-rose-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-indigo-500 to-blue-600',
      'from-yellow-500 to-orange-600',
      'from-purple-500 to-pink-600',
      'from-cyan-500 to-blue-600',
    ];
    return gradients[(workshopId - 1) % gradients.length];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <HeroSection />
      
      {/* Taglines Section */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-purple-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
            Step Into the Future of Medical Training – Only at <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">AICOG 2026</span>
          </h2>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-yellow-400 mb-8">
            First-Ever Mega Simulation Workshops – Experience. Engage. Excel.
          </h3>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mx-auto"></div>
        </div>
      </div>
      
      {/* Popular Picks Section (fetched from backend) - Temporarily Commented */}
      {false && (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 md:w-7 md:h-7 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Popular Picks
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {sameDayWorkshops.length > 0
                    ? `Showing workshops scheduled for today — ${todayLocalString}`
                    : (loadingWorkshops ? 'Loading...' : (workshopsError ? 'Failed to load workshops' : 'Most booked workshops - Book your spot now!'))}
                </p>
              </div>
            </div>
          </div>

          {loadingWorkshops ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-xl h-44" />
              ))}
            </div>
          ) : workshopsError ? (
            <div className="text-red-600">Error: {workshopsError}</div>
          ) : workshops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 max-w-md text-center shadow-lg">
                <svg className="w-20 h-20 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Workshops Available</h3>
                <p className="text-gray-600 mb-4">
                  {sameDayWorkshops.length === 0 
                    ? "No workshops are scheduled for today. Check back later or explore our simulators below!" 
                    : "All workshops are fully booked. Check back later for availability!"}
                </p>
                <button
                  onClick={() => document.getElementById('companies-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-md"
                >
                  <span>Explore Simulators</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {workshops.map((workshop) => {
                // derive displayName by stripping any " — date time" suffix (backend returns "Name — YYYY-MM-DD HH:MM")
                const displayName = typeof workshop.name === 'string' ? workshop.name.split(' — ')[0] : workshop.name;

                return (
                <button
                  key={workshop.id}
                  type="button"
                  onClick={() => handleWorkshopClick(mapWorkshopToCompany(workshop.id))}
                  className="group relative bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 border border-gray-100 text-left"
                  aria-label={`Open workshop ${displayName}`}
                >
                  <div className="h-32 sm:h-40 relative overflow-hidden">
                    {hasValidImage(workshop) ? (
                      <>
                        <img
                          src={getImageSrc(workshop)}
                          alt={`${displayName} — ${workshop.company}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </>
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getGradientColors(workshop.id)} flex items-center justify-center p-4 group-hover:scale-110 transition-transform duration-500`}>
                        <h3 className="text-white text-base sm:text-lg font-bold text-center leading-tight">
                          {displayName}
                        </h3>
                      </div>
                    )}

                    {/* Bookings badge */}
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-md flex items-center gap-1">
                      <svg className="w-3 h-3 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span className="text-xs font-bold text-gray-700">{workshop.bookings ?? 0}</span>
                    </div>
                  </div>

                  <div className="p-3 md:p-4 bg-white">
                    <h3 className="font-bold text-sm md:text-base text-gray-900 mb-1 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2 leading-tight">
                      {displayName}
                    </h3>
                    
                    {/* Book Now */}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center text-xs text-blue-600 font-semibold group-hover:text-purple-600 transition-colors duration-300">
                        <span>Book Now</span>
                        <svg className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <span className="text-xs text-gray-500">{workshop.bookings ?? 0} booked</span>
                    </div>
                  </div>
                </button>
              )})}
            </div>
          )}
        </section>
      </div>
      )}
      
      {/* Simulators Section */}
      <div id="companies-section" className="max-w-7xl mx-auto px-4 py-8">
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Simulators</h2>
          </div>
          
          <div className="relative">
            {/* Grid View - All Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {companies.map((company) => (
                <div 
                  key={company.id} 
                  className="group relative bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-500 cursor-pointer transform hover:scale-105 hover:-translate-y-2 border border-gray-100"
                  onClick={() => handleCardClick(company.id)}
                >
                  {/* Glow effect behind card */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Image section with premium styling - FIXED HEIGHT */} 
                  <div className="relative w-full h-48 sm:h-64 overflow-hidden">
                    {/* Background gradient pattern - Same blue-cyan gradient for all */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-300"></div>
                    
                    {/* Dark overlay for depth */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-black/30"></div>
                    
                    {/* Decorative circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                    
                    {/* Logo container - Fixed size box for uniform appearance */}
                    {company.logo ? (
                      <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-10">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-[200px] h-32 sm:h-40 flex items-center justify-center group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300">
                          <img 
                            src={company.logo} 
                            alt={`${company.title} Logo`} 
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-10">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 w-full max-w-[200px] h-32 sm:h-40 flex items-center justify-center group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300">
                          <span className="text-gray-900 text-lg sm:text-xl font-bold text-center">{company.title}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Content section with premium styling - FIXED HEIGHT */}
                  <div className="p-3 sm:p-4 bg-gradient-to-b from-white to-gray-50 h-48 sm:h-52 flex flex-col">
                    
                    {/* Company Title */}
                    <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 text-center group-hover:text-blue-600 transition-colors duration-300">
                      {company.title}
                    </h3>
                    
                    {/* Workshops List - Show only 3 */}
                    {company.workshops && company.workshops.length > 0 ? (
                      <div className="w-full flex-1 flex flex-col">
                        <div className="space-y-2">
                          {company.workshops.slice(0, 3).map((workshop, index) => (
                            <div 
                              key={index} 
                              className="flex items-start text-xs text-gray-700 hover:text-blue-600 transition-colors"
                            >
                              <svg className="w-3 h-3 mr-2 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="flex-1">{workshop}</span>
                            </div>
                          ))}
                          {company.workshops.length > 3 && (
                            <div className="text-xs text-gray-500 text-center pt-1">
                              +{company.workshops.length - 3} more workshops
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex-1 flex items-center justify-center">
                        <p className="text-xs text-gray-500 italic">No workshops available</p>
                      </div>
                    )}
                    
                    {/* Premium action indicator */}
                    <div className="flex items-center justify-center text-xs sm:text-sm text-blue-600 font-semibold group-hover:text-purple-600 transition-colors duration-300 pt-3 border-t border-gray-200 mt-auto">
                      <span>Explore Workshops</span>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
              </div>
          </div>
        </section>

        
      </div>
      
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Home;
