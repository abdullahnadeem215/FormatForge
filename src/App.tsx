import React, { useState, useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import TextToSpeech from './pages/TextToSpeech';
import BackgroundRemover from './pages/BackgroundRemover';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useLocation, 
  Navigate 
} from 'react-router-dom';
import { 
  Image as ImageIcon, 
  History, 
  User, 
  Menu, 
  X,
  Zap,
  Mic,
  Wand2,
  QrCode,
  FileText,
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useStorage } from './hooks/useStorage';
import { LoadingScreen } from './components/LoadingScreen';

// Pages
import Home from './pages/Home';
import HistoryPage from './pages/History';
import Profile from './pages/Profile';
import ImageConverter from './pages/converters/ImageConverter';
import MediaConverter from './pages/converters/MediaConverter';
import QRCodePage from './pages/QRCode';
import PDFTools from './pages/PDFTools';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { userId } = useStorage();

  useEffect(() => {
    const hideSplash = async () => {
      await SplashScreen.hide();
    };
    hideSplash();
  }, []);

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={() => setIsLoading(false)} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-bg-deep text-white flex">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface border border-border rounded-lg"
        >
          {isSidebarOpen ? <X /> : <Menu />}
        </button>

        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-bg-deep border-r border-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="h-full flex flex-col p-6 lg:p-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="p-2 bg-accent-grad rounded-lg shrink-0">
                <Zap size={20} className="text-white" fill="currentColor" />
              </div>
              <span className="text-lg lg:text-xl font-black italic tracking-tighter text-white whitespace-nowrap">
                FORMATFORGE <span className="bg-accent-grad bg-clip-text text-transparent not-italic font-bold">PRO</span>
              </span>
            </div>

            <nav className="flex-1 space-y-1">
              <SidebarLink to="/" icon={<ImageIcon className="w-4 h-4" />} label="Dashboard" onClick={() => setIsSidebarOpen(false)} />
              <SidebarLink to="/history" icon={<History className="w-4 h-4" />} label="History" onClick={() => setIsSidebarOpen(false)} />
              <SidebarLink to="/profile" icon={<User className="w-4 h-4" />} label="Profile" onClick={() => setIsSidebarOpen(false)} />
              <SidebarLink to="/text-to-speech" icon={<Mic className="w-4 h-4" />} label="Text to Speech" onClick={() => setIsSidebarOpen(false)} />
              <SidebarLink to="/bg-remover" icon={<Wand2 className="w-4 h-4" />} label="BG Remover" onClick={() => setIsSidebarOpen(false)} />
              <SidebarLink to="/qr-code" icon={<QrCode className="w-4 h-4" />} label="QR Code" onClick={() => setIsSidebarOpen(false)} />
              <SidebarLink to="/pdf-tools" icon={<FileText className="w-4 h-4" />} label="PDF Tools" onClick={() => setIsSidebarOpen(false)} />
            </nav>

            <div className="pt-6 border-t border-border">
              <div className="mt-4 text-[10px] text-white/20 text-center">Made by ABDULLAH, HASSAAN and HAMAAD</div>
              <div className="mt-2 text-[8px] text-white/10 text-center uppercase tracking-widest">{userId}</div>
            </div>
          </div>
        </aside>

        <main className="flex-1 relative overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6 lg:p-10">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/convert/image" element={<ImageConverter />} />
                <Route path="/convert/audio" element={<MediaConverter />} />
                <Route path="/convert/video-to-audio" element={<MediaConverter />} />
                <Route path="/text-to-speech" element={<TextToSpeech />} />
                <Route path="/bg-remover" element={<BackgroundRemover />} />
                <Route path="/qr-code" element={<QRCodePage />} />
                <Route path="/pdf-tools" element={<PDFTools />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AnimatePresence>
          </div>
          
          <footer className="p-12 text-center text-gray-600 text-sm">
            Made by ABDULLAH, HASSAAN and HAMAAD
          </footer>
        </main>
      </div>
    </Router>
  );
}

function SidebarLink({ to, icon, label, onClick }: { to: string, icon: React.ReactNode, label: string, onClick: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 py-3 transition-all duration-200 text-sm",
        isActive 
          ? "text-white font-semibold" 
          : "text-text-dim hover:text-white"
      )}
    >
      {isActive && <div className="w-1 h-1 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc] mr-1" />}
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default App;
