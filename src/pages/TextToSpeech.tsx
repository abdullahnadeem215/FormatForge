import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Download, Share2, Loader2 } from 'lucide-react';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

const TextToSpeech: React.FC = () => {
  const [text, setText] = useState('');
  const { convert, isLoading, error, outputPath } = useTextToSpeech();

  const handleConvert = async () => {
    if (!text.trim()) {
      alert('Please enter some text');
      return;
    }
    await convert(text, 'en'); // Always 'en'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-500/20 rounded-xl">
          <Mic className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Text to Speech</h1>
          <p className="text-text-dim text-sm">Convert any text to speech – 100% offline (English only)</p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Text to Convert</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-3 bg-bg-deep border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={8}
            placeholder="Enter English text to convert to speech..."
          />
          <div className="text-right text-xs text-text-dim mt-1">
            {text.length} characters
          </div>
        </div>

        <button
          onClick={handleConvert}
          disabled={isLoading || !text.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Convert to Speech
            </>
          )}
        </button>

        {outputPath && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
          >
            <p className="text-green-400 text-sm mb-3">✅ Speech generated successfully!</p>
          </motion.div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TextToSpeech;
