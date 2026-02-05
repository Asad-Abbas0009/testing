import { useAuth } from '../contexts/AuthContext'

interface TopBarProps {
  currentTime: Date
}

const TopBar = ({ currentTime }: TopBarProps) => {
  const { logout, username } = useAuth()
  
  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    const milliseconds = date.getMilliseconds().toString().padStart(6, '0')
    return `${hours}:${minutes}:${seconds}.${milliseconds}`
  }

  return (
    <div className="flex h-12 items-center justify-between px-4 bg-gradient-to-br from-slate-800/90 via-slate-900 to-black border-b border-slate-800 shadow-lg shadow-black/30">
      <div className="flex items-center gap-3">
        <img
          src="/image.png"
          alt="SimTom"
          className="h-8 w-auto object-contain"
        />
        <button className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 text-slate-200 text-sm hover:bg-slate-700 transition">
          ⚙️
        </button>
      </div>
      <div className="flex items-center gap-3">
        {username && (
          <span className="text-xs text-slate-400">Logged in as: {username}</span>
        )}
        <button
          onClick={logout}
          className="rounded-md border border-slate-700 bg-slate-800/70 px-3 py-1 text-slate-200 text-sm hover:bg-slate-700 transition"
          title="Logout"
        >
          Logout
        </button>
        <span className="font-mono text-xs sm:text-sm text-slate-200 bg-slate-800/60 px-3 py-1 rounded border border-slate-700 shadow-inner">
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  )
}

export default TopBar

