import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ScrollToTop from '../components/ScrollToTop';
import vision1 from '../assets/AboutOneSim/vision1.png';
import vision2 from '../assets/AboutOneSim/vision2.png';
import ourSolution1 from '../assets/AboutOneSim/oursolution1.png';
import ourSolution2 from '../assets/AboutOneSim/oursolution2.png';
import ourSolution3 from '../assets/AboutOneSim/oursolution3.png';
import ourFlagship1 from '../assets/AboutOneSim/ourflagsjip1.png';
import ourFlagship2 from '../assets/AboutOneSim/ourflagship2.png';
import ourFlagship3 from '../assets/AboutOneSim/ourflagship3.png';
import ourFlagship4 from '../assets/AboutOneSim/ourflagship4.png';
import ctmrisimulator from '../assets/AboutOneSim/ctmrisimulator.png';
import fetaltherapydiagnosticintervention from '../assets/AboutOneSim/fetaltherapydiagnosticintervention.png';
import fetaltherapyfetoscopicintervention from '../assets/AboutOneSim/Fetal Therapy FetoscopicIntervention.png';
import obsgynaeNursingCare from '../assets/AboutOneSim/ObsGynae&NursingCare .png';
import usgguidedsmallpartssimulators from '../assets/AboutOneSim/USGGuidedSmallPartsSimulators.png';
import musculoskeletalinterventionsimulators from '../assets/AboutOneSim/MusculoskeletalInterventionSimulators.png';
import babyMannequin from '../assets/AboutOneSim/BabyMannequin.png';
import boneBiopsyModel from '../assets/AboutOneSim/BoneBiopsyModel.png';
import suturePads from '../assets/AboutOneSim/SuturePads.png';
import hollowVessel from '../assets/AboutOneSim/HollowVessel.png';
import prostateBiopsy from '../assets/AboutOneSim/ProstateBiopsy.png';
import faceSimulatorDerma from '../assets/AboutOneSim/FaceSimulator-Derma.png';


const MovieDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedFormat, setSelectedFormat] = useState('2D');
  const [selectedLanguage, setSelectedLanguage] = useState('Hindi');

  // Auto-scroll to top when component mounts or ID changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  // Sample movie data - in a real app, this would come from an API
  const movieData = {
    1: {
      title: "One Simulation",
      rating: "7.7/10",
      votes: "22.6K Votes",
      duration: "2h 16m",
      genres: ["Comedy", "Drama", "Romantic"],
      certification: "UA13+",
      releaseDate: "29 Aug, 2025",
      posterGradient: "from-blue-400 via-cyan-400 to-teal-300",
      backgroundGradient: "from-pink-900 via-purple-900 to-indigo-900",
      trailerCount: 2,
      about: " We are a start-up focusing to create a healthcare ecosystem, where our simulators contribute not only to the competence but also to the compassion and dedication of those entrusted with patient wellbeing. We take pride in crafting immersive learning experiences that bridges the gap between theory and practice",
      description: "Dinesh Vijan presents Param Sundari, a love story directed by Tushar Jalota.",
      formats: ["2D"],
      languages: ["Hindi", "Tamil", "Telugu"],
      offer: "Buy 1 get 1 free ticket*",
      image: null // Using gradient like other companies
    },
    2: {
      title: "Vintek Medical Corporation",
      rating: "8.2/10",
      votes: "18.3K Votes",
      duration: "2h 30m",
      genres: ["Healthcare", "Medical Technology", "Simulation"],
      certification: "UA16+",
      releaseDate: "15 Sep, 2025",
      posterGradient: "from-green-400 via-blue-500 to-purple-600",
      backgroundGradient: "from-green-900 via-teal-900 to-blue-900",
      trailerCount: 3,
      about: "For more than a decade, our mission has been focused on empowering healthcare professionals by enabling access to the latest tools and technology, thereby helping them deliver the best of care. We are committed to advancing medical education and training through innovative simulation solutions that enhance clinical skills and improve patient outcomes.",
      description: "Leading provider of medical simulation technology and training solutions.",
      formats: ["2D", "3D", "IMAX"],
      languages: ["Hindi", "English", "Tamil"],
      offer: "Special weekend pricing",
      image: null // Add image path when available
    },
    3: {
      title: "GE",
      rating: "7.9/10",
      votes: "15.7K Votes",
      duration: "2h 8m",
      genres: ["Healthcare Technology", "Medical Imaging", "Innovation"],
      certification: "UA13+",
      releaseDate: "10 Oct, 2025",
      posterGradient: "from-indigo-400 via-purple-500 to-pink-500",
      backgroundGradient: "from-indigo-900 via-purple-900 to-pink-900",
      trailerCount: 1,
      about: "GE Healthcare is a leading global medical technology and digital solutions innovator. We enable clinicians to make faster, more informed decisions through intelligent devices, data analytics, applications and services, supported by our Edison intelligence platform. We operate at the center of an ecosystem working toward precision health, digitizing healthcare, helping drive productivity and improve outcomes for patients, providers, health systems and researchers around the world.",
      description: "Transforming healthcare through innovative medical technology and digital solutions.",
      formats: ["2D", "3D"],
      languages: ["Hindi", "Bengali", "English"],
      offer: "Early bird discount available",
      image: null // Add image path when available
    },
    4: {
      title: "DSS",
      rating: "8.5/10",
      votes: "25.1K Votes",
      duration: "2h 45m",
      genres: ["Healthcare Simulation", "Medical Training", "Innovation"],
      certification: "UA16+",
      releaseDate: "20 Nov, 2025",
      posterGradient: "from-blue-400 via-cyan-500 to-teal-600",
      backgroundGradient: "from-blue-900 via-cyan-900 to-teal-900",
      trailerCount: 4,
      about: "DSS is a leading provider of healthcare simulation solutions, dedicated to advancing medical education through innovative training technologies. We offer comprehensive simulation programs designed to enhance clinical skills, improve patient safety, and foster excellence in healthcare delivery. Our state-of-the-art simulators provide realistic training environments for medical professionals.",
      description: "Advanced healthcare simulation solutions for medical training excellence.",
      formats: ["2D", "3D", "IMAX"],
      languages: ["Hindi", "English", "Tamil", "Telugu"],
      offer: "Premium experience discount",
      image: null // Add image path when available
    },
    5: {
      title: "LAerdal",
      rating: "8.8/10",
      votes: "30.5K Votes",
      duration: "2h 20m",
      genres: ["Medical Training", "Emergency Care", "Patient Safety"],
      certification: "UA13+",
      releaseDate: "05 Dec, 2025",
      posterGradient: "from-yellow-400 via-orange-500 to-red-500",
      backgroundGradient: "from-yellow-900 via-orange-900 to-red-900",
      trailerCount: 2,
      about: "Laerdal is a global leader in healthcare education and patient safety solutions. For over 60 years, we have been committed to helping save lives through better training, therapy, and emergency medical services. Our comprehensive range of medical training products, including manikins, task trainers, and simulation solutions, are trusted by healthcare professionals worldwide to improve patient outcomes.",
      description: "World-renowned medical training and patient safety solutions provider.",
      formats: ["2D"],
      offer: "Musical special pricing",
      image: null // Add image path when available
    },
    6: {
      title: "J&J",
      rating: "8.8/10",
      votes: "35.2K Votes",
      duration: "2h 55m",
      genres: ["Healthcare Products", "Medical Devices", "Innovation"],
      certification: "A",
      releaseDate: "15 Jan, 2026",
      posterGradient: "from-purple-400 via-fuchsia-500 to-pink-600",
      backgroundGradient: "from-purple-900 via-fuchsia-900 to-pink-900",
      trailerCount: 5,
      about: "Johnson & Johnson is a global healthcare leader with a diverse portfolio of pharmaceutical, medical device, and consumer health products. We are committed to advancing healthcare through innovation, science, and compassion. Our medical devices division provides cutting-edge solutions for surgical procedures, orthopedics, and cardiovascular care, helping healthcare professionals deliver better patient outcomes.",
      description: "Global healthcare leader in pharmaceuticals, medical devices, and consumer health.",
      formats: ["2D", "3D", "IMAX", "4DX"],
      languages: ["Hindi", "English", "Tamil", "Telugu", "Malayalam"],
      offer: "Limited edition collectibles",
      image: null // Add image path when available
    },
    7: {
      title: "AIIMS",
      rating: "9.2/10",
      votes: "40.8K Votes",
      duration: "3h 15m",
      genres: ["Resuscitation Training", "Emergency Care", "Life-Saving Skills"],
      certification: "UA16+",
      releaseDate: "01 Feb, 2026",
      posterGradient: "from-indigo-400 via-blue-500 to-purple-600",
      backgroundGradient: "from-indigo-900 via-blue-900 to-purple-900",
      trailerCount: 3,
      about: "Comprehensive Resuscitation Training Centre (CRTC) at AIIMS is a premier institution dedicated to advancing resuscitation training and emergency medical care. We provide comprehensive training programs in Basic Cardiopulmonary Life Support (BLS), Advanced Cardiac Life Support (ACLS), and emergency response protocols. Our expert-led courses equip healthcare professionals with critical life-saving skills, ensuring they are prepared to handle cardiac emergencies and other life-threatening situations with confidence and competence.",
      description: "Premier resuscitation training center at AIIMS for life-saving emergency care excellence.",
      formats: ["2D", "3D"],
      languages: ["Hindi", "English"],
      offer: "Institutional discount available",
      image: null // Add image path when available
    },
    8: {
      title: "Karl Storz",
      rating: "8.0/10",
      votes: "18.3K Votes",
      duration: "2h 10m",
      genres: ["Endoscopy", "Surgical Equipment", "Medical Technology"],
      certification: "UA13+",
      releaseDate: "15 Feb, 2026",
      posterGradient: "from-teal-400 via-cyan-500 to-blue-500",
      backgroundGradient: "from-teal-900 via-cyan-900 to-blue-900",
      trailerCount: 2,
      about: "Karl Storz is a global leader in endoscopy and surgical equipment, providing innovative medical technology solutions for healthcare professionals. We specialize in advanced visualization systems, surgical instruments, and integrated OR solutions. Our cutting-edge hysteroscopy equipment and training programs empower medical professionals to deliver exceptional patient care with precision and safety.",
      description: "Leading provider of endoscopy equipment and surgical technology solutions.",
      formats: ["2D"],
      languages: ["Hindi", "English", "Tamil"],
      offer: "Medical equipment training package discount",
      image: null // Add image path when available
    },
    9: {
      title: "Borze",
      rating: "7.8/10",
      votes: "16.5K Votes",
      duration: "2h 5m",
      genres: ["Gynecological Procedures", "Minimally Invasive", "Women's Health"],
      certification: "UA16+",
      releaseDate: "01 Mar, 2026",
      posterGradient: "from-pink-400 via-rose-500 to-red-500",
      backgroundGradient: "from-pink-900 via-rose-900 to-red-900",
      trailerCount: 2,
      about: "Borze is a leading provider of advanced medical equipment and training solutions for gynecological procedures. We specialize in state-of-the-art hysteroscopy and colposcopy equipment, offering comprehensive training programs for healthcare professionals. Our innovative technology and expert-led workshops empower medical practitioners to deliver precise diagnoses and exceptional patient care in women's health.",
      description: "Advanced hysteroscopy training for minimally invasive gynecological procedures.",
      formats: ["2D", "3D"],
      languages: ["Hindi", "English"],
      offer: "Gynecology specialist discount",
      image: null // Add image path when available
    },
    10: {
      title: "Colposcopy",
      rating: "7.9/10",
      votes: "17.2K Votes",
      duration: "2h 15m",
      genres: ["Cervical Examination", "Women's Health", "Cancer Screening"],
      certification: "UA16+",
      releaseDate: "15 Mar, 2026",
      posterGradient: "from-orange-400 via-amber-500 to-yellow-500",
      backgroundGradient: "from-orange-900 via-amber-900 to-yellow-900",
      trailerCount: 2,
      about: "Our Colposcopy training center provides specialized education in cervical examination and cancer screening procedures. We offer comprehensive training programs that combine theoretical knowledge with practical skills in colposcopy techniques. Our expert-led workshops help healthcare professionals improve diagnostic accuracy and patient care in women's health, with a focus on early detection and prevention of cervical cancer.",
      description: "Specialized colposcopy training for cervical examination and cancer screening.",
      formats: ["2D"],
      languages: ["Hindi", "English", "Bengali"],
      offer: "Screening program discount",
      image: null // Add image path when available
    }
  };

  const movie = movieData[id] || movieData[1];

  const handleBookTickets = () => {
    navigate(`/select-slot?movieId=${id}&format=${selectedFormat}&language=${selectedLanguage}`);
  };

  

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative min-h-[400px] md:h-[450px] lg:h-[550px] overflow-hidden">
        {/* Premium Background with Multiple Layers */}
        <div className="absolute inset-0">
          {/* Base gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${movie.backgroundGradient}`}></div>
          
          {/* Primary gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#01c2cc]  to-[#7a2de7]"></div>
          
          {/* Secondary overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
          
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-pulse"></div>
        </div>

        {/* Premium Decorative Elements - Hidden on mobile */}
        <div className="absolute inset-0 hidden md:block">
          {/* Floating geometric shapes */}
          <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-40 right-32 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl animate-bounce"></div>
          <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-purple-400/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-20 right-20 w-28 h-28 bg-cyan-400/20 rounded-full blur-2xl animate-bounce" style={{animationDelay: '1s'}}></div>
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }}></div>
          
          {/* Light rays effect */}
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent transform rotate-12"></div>
          <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-blue-300/30 to-transparent transform -rotate-12"></div>
        </div>

       

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 md:py-0 md:h-full">
          <div className="flex flex-col md:flex-row md:items-center md:h-full gap-6 md:gap-0">
            {/* Movie Poster */}
            <div className="flex-shrink-0 mx-auto md:mx-0 md:mr-8 lg:mr-12">
              <div className="relative group">
                {/* Premium poster container with multiple effects */}
                <div className="relative">
                  {/* Glow effect behind poster */}
                  <div className={`absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500`}></div>
                  
                  {/* Main poster */}
                  <div 
                    className={`relative w-48 h-72 sm:w-56 sm:h-80 md:w-64 md:h-96 lg:w-72 lg:h-[28rem] ${movie.image ? 'bg-white/95 backdrop-blur-sm' : `bg-gradient-to-br ${movie.posterGradient}`} rounded-2xl shadow-2xl flex items-center justify-center border border-white/20 group-hover:scale-105 transition-all duration-500`}
                  >
                    {movie.image ? (
                      <img 
                        src={movie.image} 
                        alt={`${movie.title} Logo`}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <div className="text-center text-white">
                        <div className="text-lg font-semibold px-4">{movie.title}</div>
                      </div>
                    )}
                    
                    {/* Premium overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-2xl"></div>
                  </div>
                  
                  {/* Premium corner decorations */}
                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-80"></div>
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-gradient-to-br from-pink-400 to-cyan-500 rounded-full opacity-80"></div>
                </div>
                
                {/* Trailer Button */}
                {/* <div className="absolute bottom-4 left-4 right-4">
                  <button className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-colors duration-200">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    <span>Trailers ({movie.trailerCount})</span>
                  </button>
                </div> */}

                {/* Offxer Banner */}
                {/* {movie.offer && (
                  <div className="absolute -top-2 -left-2 bg-pink-500 text-white px-3 py-1 rounded-md text-sm font-semibold transform -rotate-3">
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      <span>{movie.offer}</span>
                    </div>
                  </div>
                )} */}
                
                <div className="absolute bottom-16 left-4 right-4 text-center">
                  {/* <p className="text-white text-sm">In cinemas</p> */}
                </div>
              </div>
            </div>

            {/* Movie Details */}
            <div className="flex-1 text-white text-center md:text-left">
              <div className="max-w-2xl mx-auto md:mx-0">
                {/* Premium Title with gradient text */}
                <div className="mb-4 md:mb-6">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black mb-2 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent leading-tight">
                    {movie.title}
                  </h1>
                  <div className="w-20 md:w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mx-auto md:mx-0"></div>
                </div>
                
                {/* Rating and Share */}
                {/* <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span className="font-semibold">{movie.rating}</span>
                    <span className="text-gray-300">({movie.votes})</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  
                  <button 
                    onClick={handleShare}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    <span>Share</span>
                  </button>
                  
                  <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors duration-200">
                    Rate now
                  </button>
                </div> */}

                {/* Format and Language Tags */}
                {/* <div className="flex flex-wrap gap-2 mb-4">
                  {movie.formats.map((format) => (
                    <span key={format} className="bg-gray-700 text-white px-3 py-1 rounded text-sm">
                      {format}
                    </span>
                  ))}
                  {movie.languages.map((language) => (
                    <span key={language} className="bg-gray-700 text-white px-3 py-1 rounded text-sm">
                      {language}
                    </span>
                  ))}
                </div> */}

                {/* Movie Info */}
                {/* <p className="text-lg text-gray-300 mb-6">
                  {movie.duration} • {movie.genres.join(", ")} • {movie.certification} • {movie.releaseDate}
                </p> */}

                {/* Premium Book Slots Button */}
                <div className="mt-6 md:mt-8">
                  <button 
                    onClick={handleBookTickets}
                    className="group relative inline-flex items-center justify-center px-6 sm:px-8 md:px-12 py-3 md:py-4 text-base md:text-lg font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl md:rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 overflow-hidden w-full sm:w-auto"
                  >
                    {/* Button background animation */}
                    
                    {/* Button content */}
                    <span className="relative z-10 flex items-center space-x-2">
                     
                      <span>Book Workshop Slots</span>
                    </span>
                    
                    {/* Shine effect */}
                    <div className="absolute inset-0 -top-2 -left-2 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 group-hover:translate-x-full transition-transform duration-700"></div>
                  </button>
                  
                  {/* Additional premium text */}
                  <p className="mt-3 md:mt-4 text-xs md:text-sm text-white/80 font-medium">
                    ✨ Limited seats available • Secure your spot now
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
          {/* About the Movie */}
          <section className="mb-8 md:mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">About the Company</h2>
            <p className="text-gray-700 text-base md:text-lg mb-4">{movie.about}</p>
            {/* <p className="text-gray-600">{movie.description}</p> */}
          </section>

          {/* Our Flagship | Simulators - Only for One Simulation */}
          {id === "1" && (
            <section className="mb-8 md:mb-12">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 md:mb-8 text-center">Our Flagship | Simulators</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Fetal Therapy Simulator */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={ourFlagship1} 
                      alt="Fetal Therapy Simulator" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="text-sm md:text-base lg:text-lg font-bold text-gray-900 mb-1 md:mb-2">Fetal Therapy Simulator</h3>
                    <p className="text-gray-700 text-xs md:text-sm">
                      Diagnostic & Fetoscopic procedures with realistic Tissue mimic
                    </p>
                  </div>
                </div>

                {/* CT/MRI Simulator */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={ourFlagship2} 
                      alt="CT/MRI Simulator" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="text-sm md:text-base lg:text-lg font-bold text-gray-900 mb-1 md:mb-2">CT/MRI Simulator</h3>
                    <p className="text-gray-700 text-xs md:text-sm">
                      Complete CT & MRI environments for radiography & Biopsy training.
                    </p>
                  </div>
                </div>

                {/* Obs/Gynae Simulator */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={ourFlagship3} 
                      alt="Obs/Gynae Simulator" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="text-sm md:text-base lg:text-lg font-bold text-gray-900 mb-1 md:mb-2">Obs/Gynae Simulator</h3>
                    <p className="text-gray-700 text-xs md:text-sm">
                      Vaginal Delivery, Nursing, obstetrics & gynecology training with lifelike responses.
                    </p>
                  </div>
                </div>

                {/* Skill Series Simulator */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={ourFlagship4} 
                      alt="Skill Series Simulator" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="text-sm md:text-base lg:text-lg font-bold text-gray-900 mb-1 md:mb-2">Skill Series Simulator</h3>
                    <p className="text-gray-700 text-xs md:text-sm">
                      Face, prostate, bone, and suture models with authentic textures.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Our Solutions - Only for One Simulation */}
          {id === "1" && (
            <section className="mb-8 md:mb-12">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 md:mb-8 text-center">ONE SIM | Solutions</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {/* CT & MRI Simulator */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={ctmrisimulator} 
                      alt="CT & MRI Simulator" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">CT & MRI Simulator</h3>
                  </div>
                </div>

                {/* Fetal Therapy Diagnostic Intervention */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={fetaltherapydiagnosticintervention} 
                      alt="Fetal Therapy Diagnostic Intervention" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Fetal Therapy Diagnostic Intervention</h3>
                  </div>
                </div>

                {/* Fetal Therapy Fetoscopic Intervention */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={fetaltherapyfetoscopicintervention} 
                      alt="Fetal Therapy Fetoscopic Intervention" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Fetal Therapy Fetoscopic Intervention</h3>
                  </div>
                </div>

                {/* Obs Gynae & Nursing Care */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={obsgynaeNursingCare} 
                      alt="Obs Gynae & Nursing Care" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Obs Gynae & Nursing Care</h3>
                  </div>
                </div>

                {/* USG Guided Small Parts Simulators */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={usgguidedsmallpartssimulators} 
                      alt="USG Guided Small Parts Simulators" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">USG Guided Small Parts Simulators</h3>
                  </div>
                </div>

                {/* Musculoskeletal Intervention Simulators */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={musculoskeletalinterventionsimulators} 
                      alt="Musculoskeletal Intervention Simulators" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Musculoskeletal Intervention Simulators</h3>
                  </div>
                </div>

                {/* Baby Mannequin */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={babyMannequin} 
                      alt="Baby Mannequin" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Baby Mannequin</h3>
                  </div>
                </div>

                {/* Bone Biopsy Model */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={boneBiopsyModel} 
                      alt="Bone Biopsy Model" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Bone Biopsy Model</h3>
                  </div>
                </div>

                {/* Suture Pads */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={suturePads} 
                      alt="Suture Pads" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Suture Pads</h3>
                  </div>
                </div>

                {/* Hollow Vessel */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={hollowVessel} 
                      alt="Hollow Vessel" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Hollow Vessel</h3>
                  </div>
                </div>

                {/* Prostate Biopsy */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={prostateBiopsy} 
                      alt="Prostate Biopsy" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Prostate Biopsy</h3>
                  </div>
                </div>

                {/* Face Simulator - Derma */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={faceSimulatorDerma} 
                      alt="Face Simulator - Derma" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 md:p-3">
                    <h3 className="text-xs md:text-sm font-bold text-gray-900 text-center leading-tight">Face Simulator - Derma</h3>
                  </div>
                </div>
              </div>
            </section>
          )}

          

         

          {/* You might also like */}
          {/* <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">You might also like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((item) => {
                const relatedMovie = movieData[item] || movieData[1];
                return (
                  <div key={item} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105"
                       onClick={() => navigate(`/movie/${item}`)}>
                    <div className={`w-full h-64 bg-gradient-to-br ${relatedMovie.posterGradient} flex items-center justify-center`}>
                      <div className="text-center text-white">
                        <div className="text-4xl font-bold opacity-30 mb-2">🎬</div>
                        <span className="text-sm font-semibold px-2">{relatedMovie.title}</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{relatedMovie.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">{relatedMovie.genres.join(', ')} • {relatedMovie.rating}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section> */}
        </div>
      </div>

      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default MovieDetails;
