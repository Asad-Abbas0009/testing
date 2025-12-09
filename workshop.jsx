import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DatePills from "../components/DatePills.jsx";
import { getSlots } from "../api/client.js";
import amniocentesisImg from "../assets/WorkshopImages/amniocentesis.jpg";
import amnioCvsImg from "../assets/WorkshopImages/amniocvs.jpeg";
import bullEyeImg from "../assets/WorkshopImages/BullsEyeNew.webp";
import ultrasoundSimulatorImg from "../assets/WorkshopImages/ultrasoundsimulatorvintek.jpg";
import laproscopicSimulatorImg from "../assets/WorkshopImages/vintekworkshop1.jpg";
import hysteroscopeImg from "../assets/WorkshopImages/Hysteroscope.png";
import endotrainersImg from "../assets/WorkshopImages/endotrainers.jpg";
import pphImg from "../assets/WorkshopImages/PPH___.jpg";
import pph_Img from "../assets/WorkshopImages/PPH.jpg";
import shoImg from "../assets/WorkshopImages/shoulderdystocia.jpg";
import fetalDistressCaesareanImg from "../assets/WorkshopImages/FetalDistress_CaesareanDelivery.jpg";
import colposcopeImg from "../assets/WorkshopImages/Colposcope.jpg";
import usgSimulatorImg from "../assets/WorkshopImages/USG Simulator.png";
import lapsimImg from "../assets/WorkshopImages/Picture1.png";
import roboticSimulatorImg from "../assets/WorkshopImages/roboticSimulator.png";
import virtualRealityImg from "../assets/WorkshopImages/VirtualReality.jpg";
import fetalTherapyImg from "../assets/WorkshopImages/fetaltherapysimulators.png";

// Company Logos
import oneSimLogo from '../assets/Comapny-Logos/One-Sim-Logo.png';
import vintekLogo from '../assets/Comapny-Logos/Vintek Logo.png';
import geLogo from '../assets/Comapny-Logos/GE Logo.jpg';
import storzLogo from '../assets/Comapny-Logos/Storz Logo.jpg';
import laerdalLogo from '../assets/Comapny-Logos/Laerdal Logo.jpg';

function cx(...a){ return a.filter(Boolean).join(" "); }
function f12(hhmm="00:00"){
  const [h,m]=(hhmm||"00:00").split(":").map(Number);
  const am=h<12?"AM":"PM";
  const h12=((h+11)%12)+1;
  return `${h12}:${String(m).padStart(2,"0")} ${am}`;
}
const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toLocalISO(d = new Date()){
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60_000);
  return local.toISOString().slice(0,10);
}
function addDaysISO(iso, d){
  const [y,m,dd] = iso.split("-").map(Number);
  const base = new Date(y, (m-1), dd);
  base.setDate(base.getDate() + d);
  return toLocalISO(base);
}
function dateOptionsAround(iso){
  return Array.from({ length: 7 }).map((_, i) => {
    const d = addDaysISO(iso, i - 3);
    const obj = new Date(d + "T00:00:00");
    return { iso:d, day:DAY[obj.getDay()], dateNum:obj.getDate() };
  });
}

function isPastSlot(dateISO, startTime, endTime){
  const [y,m,d] = dateISO.split("-").map(Number);
  const [endHh, endMm] = (endTime||"00:00").split(":").map(Number);
  const slotEndDateTime = new Date(y, (m-1), d, endHh, endMm, 0, 0);
  const now = new Date();
  return slotEndDateTime.getTime() < now.getTime();
}

const companyData = {
  "1": { 
    title: "Endotrainers",
    logo: endotrainersImg,
    workshops: [
      { id: 1, name: "Station 1", color: "bg-blue-500", image: endotrainersImg, centerId: "c1" },
      { id: 2, name: "Station 2", color: "bg-green-500", image: endotrainersImg, centerId: "c2" },
      { id: 3, name: "Station 3", color: "bg-orange-500", image: endotrainersImg, centerId: "c3" },
      { id: 4, name: "Station 4", color: "bg-pink-500", image: endotrainersImg, centerId: "c4" },
      { id: 5, name: "Station 5", color: "bg-cyan-500", image: endotrainersImg, centerId: "c5" },
      { id: 6, name: "Station 6", color: "bg-red-500", image: endotrainersImg, centerId: "c6" },
      { id: 7, name: "Station 7", color: "bg-violet-600", image: endotrainersImg, centerId: "c7" },
      { id: 8, name: "Station 8", color: "bg-rose-500", image: endotrainersImg, centerId: "c8" },
      { id: 9, name: "Station 9", color: "bg-amber-600", image: endotrainersImg, centerId: "c9" },
      { id: 10, name: "Station 10", color: "bg-indigo-600", image: endotrainersImg, centerId: "c10" }
    ]
  },

  "2": { 
    title: "Lapsim",
    logo: lapsimImg,
    workshops: [
      { id: 1, name: "Station 1", color: "bg-blue-500", image: lapsimImg, centerId: "c11" }
    ]
  },

  "3": { 
    title: "Robotics",
    logo: roboticSimulatorImg,
    workshops: [
      { id: 1, name: "Station 1", color: "bg-blue-500", image: roboticSimulatorImg, centerId: "c12" }
    ]
  },

  "4": { 
    title: "Hysteroscope",
    logo: hysteroscopeImg,
    workshops: [
      { id: 1, name: "Hysteroscopy - Polyp model", color: "bg-blue-500", image: hysteroscopeImg, centerId: "c13" },
      { id: 2, name: "Hysteroscopy -Sub mucosal fibroid", color: "bg-green-500", image: hysteroscopeImg, centerId: "c14" },
      { id: 3, name: "Station 3", color: "bg-orange-500", image: hysteroscopeImg, centerId: "c15" },
      { id: 4, name: "Station 4", color: "bg-pink-500", image: hysteroscopeImg, centerId: "c16" },
      { id: 5, name: "Station 5", color: "bg-cyan-500", image: hysteroscopeImg, centerId: "c17" },
      { id: 6, name: "Station 6", color: "bg-red-500", image: hysteroscopeImg, centerId: "c18" },
      { id: 7, name: "Station 7", color: "bg-red-500", image: hysteroscopeImg, centerId: "c40" }
    ]
  },

  "5": { 
    title: "Colposcope",
    logo: colposcopeImg,
    workshops: [
      { id: 1, name: "Station 1", color: "bg-blue-500", image: colposcopeImg, centerId: "c19" },
      { id: 2, name: "Station 2", color: "bg-green-500", image: colposcopeImg, centerId: "c20" }
    ]
  },

  "6": { 
    title: "Fetal Ultrasound Imaging Simulators",
    logo: usgSimulatorImg,
    workshops: [
      { id: 1, name: "NT Scan", color: "bg-blue-500", image: usgSimulatorImg, centerId: "c21" },
      { id: 2, name: "Biometry", color: "bg-blue-500", image: usgSimulatorImg, centerId: "c41" },
      { id: 3, name: "Dopplers", color: "bg-blue-500", image: usgSimulatorImg, centerId: "c42" },
    ]
  },

  "7": { 
    title: "Labour Ward Simulators",
    logo: pphImg,
    workshops: [
      { id: 1, name: "PPH", color: "bg-blue-500", image: pph_Img, centerId: "c22" },
      { id: 2, name: "Shoulder dystocia", color: "bg-green-500", image: shoImg, centerId: "c23" },
      { id: 3, name: "Eclampsia", color: "bg-orange-500", image: pphImg, centerId: "c24" },
      { id: 4, name: "Amniotic fluid embolism", color: "bg-pink-500", image: pphImg, centerId: "c25" },
      { id: 5, name: "Postpartum collapse", color: "bg-cyan-500", image: pphImg, centerId: "c26" },
      { id: 6, name: "Birthing", color: "bg-red-500", image: pphImg, centerId: "c27" }
    ]
  },

  "8": { 
    title: "Virtual Reality Simulators",
    logo: virtualRealityImg,
    workshops: [
      { id: 1, name: "Fetal distress", color: "bg-blue-500", image: virtualRealityImg, centerId: "c28" },
      { id: 2, name: "Caesarean delivery", color: "bg-green-500", image: virtualRealityImg, centerId: "c29" }
    ]
  },

  "9": { 
    title: "Fetal Therapy Simulators",
    logo: fetalTherapyImg,
    workshops: [
      { id: 1, name: "Amniocentesis", color: "bg-blue-500", image: fetalTherapyImg, centerId: "c30" },
      { id: 2, name: "Chorionic villus sampling", color: "bg-green-500", image: fetalTherapyImg, centerId: "c31" },
      { id: 3, name: "Bull's eye (reaching the target in fetus)", color: "bg-orange-500", image: fetalTherapyImg, centerId: "c32" },
      { id: 4, name: "Intrauterine transfusion", color: "bg-pink-500", image: fetalTherapyImg, centerId: "c33" },
      { id: 5, name: "Scar ectopic injection", color: "bg-cyan-500", image: fetalTherapyImg, centerId: "c34" },
      { id: 6, name: "Radiofrequency ablation", color: "bg-red-500", image: fetalTherapyImg, centerId: "c35" }
    ]
  },
  "10": { 
    title: "BLS",
    logo: fetalTherapyImg,
    workshops: [
      { id: 1, name: "Basic Life  Support", color: "bg-blue-500", image: fetalTherapyImg, centerId: "c37" },
    ]
  },
  "11": { 
    title: "NRP",
    logo: fetalTherapyImg,
    workshops: [
      { id: 1, name: "Term infant", color: "bg-blue-500", image: fetalTherapyImg, centerId: "c38" },
      { id: 2, name: "Preterm infant", color: "bg-green-500", image: fetalTherapyImg, centerId: "c39" },
    ]
  }
};

//Asad
const CENTERS = [
  // 🎯 Endotrainers Stations
  { id: "c1",  title: "Station 1",                            color: "bg-blue-500",   venue: "J&J" },
  { id: "c2",  title: "Station 2",                            color: "bg-green-500",  venue: "J&J" },
  { id: "c3",  title: "Station 3",                            color: "bg-orange-500", venue: "J&J" },
  { id: "c4",  title: "Station 4",                            color: "bg-pink-500",   venue: "J&J" },
  { id: "c5",  title: "Station 5",                            color: "bg-cyan-500",   venue: "J&J" },
  { id: "c6",  title: "Station 6",                            color: "bg-red-500",    venue: "J&J" },
  { id: "c7",  title: "Station 7",                            color: "bg-violet-600", venue: "J&J" },
  { id: "c8",  title: "Station 8",                            color: "bg-rose-500",   venue: "J&J" },
  { id: "c9",  title: "Station 9",                            color: "bg-amber-600",  venue: "J&J" },
  { id: "c10", title: "Station 10",                           color: "bg-indigo-600", venue: "J&J" },

  // 🎮 Lapsim Station
  { id: "c11", title: "Station 1",                            color: "bg-blue-500",   venue: "Vintek" },

  // 🤖 Robotics Station
  { id: "c12", title: "Station 1",                            color: "bg-blue-500",   venue: "Vintek" },

  // 🔬 Hysteroscope Stations
  { id: "c13", title: "Hysteroscopy - Polyp model",                            color: "bg-blue-500",   venue: "One Simulation" },
  { id: "c14", title: "Hysteroscopy -Sub mucosal fibroid",                            color: "bg-green-500",  venue: "One Simulation" },
  { id: "c15", title: "Station 3",                            color: "bg-orange-500", venue: "Karl Storz" },
  { id: "c16", title: "Station 4",                            color: "bg-pink-500",   venue: "Karl Storz" },
  { id: "c17", title: "Station 5",                            color: "bg-cyan-500",   venue: "Karl Storz" },
  { id: "c18", title: "Station 6",                            color: "bg-red-500",    venue: "Haeger" },
  { id: "c40", title: "Station 7",                            color: "bg-cyan-500",   venue: "Haeger" },

  // 🔬 Colposcope Stations
  { id: "c19", title: "Station 1",                            color: "bg-blue-500",   venue: "Borze" },
  { id: "c20", title: "Station 2",                            color: "bg-green-500",  venue: "Borze" },

  // 🩺 Fetal Ultrasound Station
  { id: "c21", title: "NT Scan",                            color: "bg-blue-500",   venue: "Vintek" },
  { id: "c41", title: "Biometry",                            color: "bg-blue-500",   venue: "GE" },
  { id: "c42", title: "Dopplers",                            color: "bg-blue-500",   venue: "DSS" },

  // 🤰 Birthing Simulators Stations
  { id: "c22", title: "PPH",                                  color: "bg-blue-500",   venue: "Laerdal" },
  { id: "c23", title: "Shoulder dystocia",                    color: "bg-green-500",  venue: "Laerdal" },
  { id: "c24", title: "Eclampsia",                            color: "bg-orange-500", venue: "Laerdal" },
  { id: "c25", title: "Amniotic fluid embolism",              color: "bg-pink-500",   venue: "Laerdal" },
  { id: "c26", title: "Postpartum collapse",                  color: "bg-cyan-500",   venue: "Laerdal" },
  { id: "c27", title: "Twin Birthing",                        color: "bg-red-500",    venue: "DSS" },

  // 🥽 Virtual Reality Stations
  { id: "c28", title: "Fetal distress",                       color: "bg-blue-500",   venue: "Laerdal" },
  { id: "c29", title: "Caesarean delivery",                   color: "bg-green-500",  venue: "Laeedal" },

  // 🧬 Fetal Therapy Simulator Stations
  { id: "c30", title: "Amniocentesis",                              color: "bg-blue-500",   venue: "One Simulation" },
  { id: "c31", title: "Chorionic villus sampling",                  color: "bg-green-500",  venue: "One Simulation" },
  { id: "c32", title: "Bull's eye (reaching the target in fetus)",  color: "bg-orange-500", venue: "One Simulation" },
  { id: "c33", title: "Intrauterine transfusion",                   color: "bg-pink-500",   venue: "One Simulation" },
  { id: "c34", title: "Scar ectopic injection",                     color: "bg-cyan-500",   venue: "One Simulation" },
  { id: "c35", title: "Radiofrequency ablation",                    color: "bg-red-500",    venue: "One Simulation" },
  { id: "c37", title: "Basic Life Support",                         color: "bg-cyan-500",   venue: "AIIMS" },
  { id: "c38", title: "Term infant",                                color: "bg-cyan-500",   venue: "Dr Bisht" },
  { id: "c39", title: "Preterm infant",                              color: "bg-cyan-500",   venue: "Dr Bisht" },
          
];


export default function WorkshopSlots(){
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const date = params.get("date") || toLocalISO(new Date());
  const movieId = params.get("movieId") || "1";
  const [data, setData] = useState({}); // { c1:[...], c2:[...], ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHurryUp, setShowHurryUp] = useState(false);

  const companyName = companyData[movieId]?.title || "Workshop";
  const companyLogo = companyData[movieId]?.logo || null;
  const companyWorkshops = companyData[movieId]?.workshops || [];

  const dates = useMemo(() => dateOptionsAround(date), [date]);

  // Auto-scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Show hurry up popup after 5-7 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHurryUp(true);
    }, Math.random() * 2000 + 5000); // Random between 5-7 seconds

    return () => clearTimeout(timer);
  }, []);

  // Remove auto hide - popup will only hide on dismiss click

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const perCenter = {};
        for (const c of CENTERS) {
          try {
            const res = await getSlots(c.id, date);
            perCenter[c.id] = Array.isArray(res?.slots) ? res.slots : [];
          } catch {
            perCenter[c.id] = [];
          }
        }
        if (!alive) return;
        setData(perCenter);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load showtimes");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [date]);

  function gotoDate(iso){
    const next = new URLSearchParams(params);
    next.set("date", iso);
    setParams(next, { replace:true });
  }

  function goBack(){ 
    navigate(-1); 
  }

function openSeats(slot, workshop){
  // Resolve center info (works if workshop.centerId present, or if workshop already has venue)
  const center = CENTERS.find(c => c.id === (workshop.centerId ?? workshop.center_id));
  const venue = workshop.venue || center?.venue || '';

  const q = new URLSearchParams({
    slotId: String(slot.id),
    start: String(slot.start ?? ""),
    end: String(slot.end ?? ""),
    price: String(slot.price ?? ""),
    date,
    workshopId: String(workshop.centerId ?? ""),
    workshopTitle: String(workshop.title ?? workshop.name ?? companyName),
    companyName: String(companyName),
    movieId: String(movieId),
    venue: String(venue)
  }).toString();
  navigate(`/select-seats?${q}`);
}


  return (
    <div className="min-h-screen bg-white">
      {/* Hurry Up Popup */}
      {showHurryUp && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto z-50">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 md:p-4 max-w-xs mx-auto sm:mx-0">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Hurry Up!</h4>
                <p className="text-xs text-gray-600 mb-2">
                  Seats are filling up fast. Book now!
                </p>
                <button
                  onClick={() => setShowHurryUp(false)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Dismiss
                </button>
              </div>
              
              <button
                onClick={() => setShowHurryUp(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-2 sm:px-4 py-3">
          {/* Mobile: Stacked layout */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <button onClick={goBack} className="rounded p-2 text-gray-700 hover:bg-gray-100" aria-label="Back">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 h-16 rounded bg-black border border-gray-700 grid place-items-center px-3">
                <span className="font-semibold text-sm text-white truncate">{companyName}</span>
              </div>
            </div>
            <div className="h-10 rounded bg-cyan-800 text-white grid place-items-center px-3">
              <span className="text-xs sm:text-sm font-semibold text-center">Date and time selection for workshop</span>
            </div>
          </div>

          {/* Desktop: Horizontal layout */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={goBack} className="mr-1 rounded px-2 py-1 text-gray-700 hover:bg-gray-100" aria-label="Back">‹</button>
            <div className="h-16 w-64 rounded bg-black border border-gray-700 grid place-items-center px-4">
              <span className="font-semibold text-white">{companyName}</span>
            </div>
            <div className="flex-1 h-10 min-w-[280px] ml-3 rounded bg-cyan-800 text-white grid place-items-center text-sm font-semibold">
              Date and time selection for workshop 
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-2 sm:px-4 pb-4">
          <DatePills options={dates} activeISO={date} onChange={gotoDate} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-2 sm:px-4 py-3 md:py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3 md:space-y-4">
            {Array.from({ length: 4 }).map((_,i)=>(
              <div key={i} className="rounded-xl border border-gray-200 p-3 md:p-4 flex flex-col sm:flex-row gap-3 md:gap-4">
                <div className="w-full sm:w-72 md:w-80 rounded-xl bg-white border shadow-md flex flex-col overflow-hidden">
                  <div className="h-40 sm:h-48 bg-gray-200 animate-pulse" />
                  <div className="px-4 py-3 space-y-2">
                    <div className="h-5 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-3 flex flex-wrap gap-2 md:gap-3">
                    {Array.from({ length: 10 }).map((_,j)=>(
                      <div key={j} className="h-8 sm:h-10 w-24 sm:w-28 rounded-lg bg-gray-200 animate-pulse" />
                    ))}
                  </div>
                  <div className="h-3 w-44 rounded bg-gray-200 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {companyWorkshops.map(workshop => {
              // Find corresponding CENTERS data for backend slots
// new — robust lookup by centerId then fallback to title
const center = CENTERS.find(c => c.id === (workshop.centerId ?? workshop.center_id))
            || CENTERS.find(c => c.title === workshop.name);
const slots = center ? (data[center.id] || []) : [];

              
              return (
                <section key={workshop.id} className="mb-3 md:mb-4 rounded-xl border border-gray-200">
                  <div className="p-3 md:p-4 flex flex-col sm:flex-row gap-3 md:gap-4">
                    {/* Left workshop card with image placeholder */}
                    <div className="shrink-0 w-full sm:w-72 md:w-80 rounded-xl overflow-hidden bg-white border shadow-md flex flex-col">
                      {/* Image section */}
                      <div className="w-full h-40 sm:h-48 relative flex-shrink-0 bg-gray-50">
                        {workshop.image ? (
                          <img 
                            src={workshop.image} 
                            alt={workshop.name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className={cx(
                            "w-full h-full grid place-items-center text-white text-sm font-medium",
                            workshop.color
                          )}>
                            Workshop Image
                          </div>
                        )}
                      </div>
                      
                      {/* Workshop details */}
                      <div className="px-4 py-3 bg-white flex-grow flex flex-col justify-center">
                        <div className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                          {workshop.name}
                        </div>
                      </div>
                    </div>

                    {/* Time chips */}
                    <div className="flex-1">
                      {slots.length ? (
                        <div className="flex flex-wrap gap-2">
                          {slots
                            .filter((slot) => {
                              // Filter out times after 6:00 PM (18:00)
                              const [startHour] = (slot.start || "00:00").split(":").map(Number);
                              const isAfter6PM = startHour >= 18;
                              
                              return !isAfter6PM; // Only show times before 6:00 PM (show all past slots too)
                            })
                            .map((slot) => {
                              // Check if slot is in the past (based on end time)
                              const isPastTimeSlot = isPastSlot(date, slot.start, slot.end);
                              
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={isPastTimeSlot ? undefined : () => openSeats(slot, {...workshop, centerId: center?.id, title: workshop.name})}
                                  disabled={isPastTimeSlot}
                                  className={cx(
                                    "relative rounded-lg border px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition",
                                    isPastTimeSlot 
                                      ? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                                      : "hover:shadow-sm focus-visible:ring-2 focus-visible:ring-black bg-white border-emerald-600"
                                  )}
                                  title={isPastTimeSlot ? "This time slot has passed" : "Select this time"}
                                >
                                  <div className="leading-none">
                                    {f12(slot.start)} – {f12(slot.end)}
                                  </div>
                                </button>
                              );
                            })}
                          {/* Commented out times after 6:00 PM - can be uncommented later */}
                          {/* {slots
                            .filter((slot) => {
                              const [startHour] = (slot.start || "00:00").split(":").map(Number);
                              return startHour >= 18; // Times after 6:00 PM
                            })
                            .map((slot) => (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => openSeats(slot, {...workshop, centerId: center?.id, title: workshop.name})}
                              className={cx(
                                "relative rounded-lg border px-4 py-2 text-sm font-medium transition",
                                "hover:shadow-sm focus-visible:ring-2 focus-visible:ring-black",
                                "bg-white border-emerald-600"
                              )}
                              title="Select this time"
                            >
                              <div className="leading-none">
                                {f12(slot.start)} – {f12(slot.end)}
                              </div>
                            </button>
                          ))} */}
                        </div>
                      ) : (
                        <div className="text-xs sm:text-sm text-gray-600 py-2 sm:py-3">No showtimes on this date.</div>
                      )}

                      {/* <div className="mt-2 text-xs text-gray-500">
                        Cancellation available
                      </div> */}
                    </div>
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
