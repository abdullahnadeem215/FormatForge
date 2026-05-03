import React from 'react';
import { motion } from 'motion/react';
import { Zap, Shield, User as UserIcon, Calendar, Crown } from 'lucide-react';
import { useStorage } from '../hooks/useStorage';

export default function Profile() {
  const { userId } = useStorage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto space-y-12"
    >
      <header className="text-center space-y-6">
        <div className="relative inline-block">
          <div className="w-32 h-32 rounded-full bg-accent-grad flex items-center justify-center text-4xl font-bold">
            {userId[0]?.toUpperCase() || 'U'}
          </div>
          <div className="absolute -bottom-2 -right-2 p-2 bg-accent-grad rounded-full shadow-lg">
            <Crown className="w-5 h-5 text-white" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-light tracking-tight">Local User</h1>
          <p className="text-text-dim text-xs font-mono">{userId}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <div className="p-8 bg-surface border border-border rounded-[24px] space-y-8">
          <h3 className="text-lg font-semibold border-b border-border pb-4">Local Context</h3>
          
          <div className="space-y-6">
            <DetailItem 
              icon={<UserIcon className="w-5 h-5 text-purple-400" />} 
              label="Local Identity" 
              value={userId} 
            />
            <DetailItem 
              icon={<Shield className="w-5 h-5 text-purple-400" />} 
              label="Trust Status" 
              value="Privacy Shield Enabled" 
            />
            <DetailItem 
              icon={<Calendar className="w-5 h-5 text-purple-400" />} 
              label="Device Linked" 
              value="Active" 
            />
            <DetailItem 
              icon={<Zap className="w-5 h-5 text-purple-400" />} 
              label="Feature Set" 
              value="Professional Suite unlocked" 
            />
          </div>
        </div>

        <div className="p-8 bg-purple-500/5 border border-purple-500/20 rounded-[24px] text-center space-y-4">
          <h3 className="text-lg font-semibold">Privacy First</h3>
          <p className="text-text-dim text-sm">
            FormatForge Pro now operates entirely on your device. Your data, conversions, and metadata never leave this browser.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="p-3 bg-white/5 rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-text-dim font-bold uppercase tracking-widest">{label}</p>
        <p className="text-base font-medium">{value}</p>
      </div>
    </div>
  );
}
