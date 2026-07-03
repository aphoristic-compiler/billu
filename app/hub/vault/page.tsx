'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { CldUploadWidget } from 'next-cloudinary';
import { getVaultMedia, getQuotes, addQuote, deleteQuote } from '@/lib/actions/vault';
import { toast } from '@/components/terminal-toast';
import { CandlestickButton } from '@/components/candlestick-button';
import Image from 'next/image';

export default function VaultPage() {
  const { user } = useUser();
  const [media, setMedia] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [m, q] = await Promise.all([getVaultMedia(), getQuotes()]);
      setMedia(m);
      setQuotes(q);
    };
    load();
  }, []);

  if (!user) return null;

  const handleUploadSuccess = async () => {
    toast('UPLOAD_COMPLETE', 'success');
    const m = await getVaultMedia();
    setMedia(m);
  };

  const handleAddQuote = async () => {
    if (!quoteText.trim()) return;
    setLoadingQuote(true);
    try {
      await addQuote(quoteText);
      toast('QUOTE_ADDED', 'success');
      const q = await getQuotes();
      setQuotes(q);
      setQuoteText('');
      setShowQuoteForm(false);
    } catch (err) {
      toast('QUOTE_FAILED', 'warning');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleDeleteQuote = async (id: string) => {
    try {
      await deleteQuote(id);
      toast('QUOTE_DELETED', 'success');
      const q = await getQuotes();
      setQuotes(q);
    } catch (err) {
      toast('DELETE_FAILED', 'warning');
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="border border-accent/30 bg-background/50 p-4">
        <h2 className="mb-3 text-accent">MEMORIAL_VAULT</h2>
        <p className="text-secondary mb-3">Preserve memories and moments from the Saturo Wing</p>

        <CldUploadWidget
          uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? `preset_${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}` : undefined}
          onSuccess={handleUploadSuccess}
        >
          {({ open }) => (
            <button
              onClick={() => open()}
              className="w-full border border-accent/30 bg-background px-3 py-2 text-secondary hover:border-accent hover:text-accent"
            >
              + UPLOAD_PHOTO
            </button>
          )}
        </CldUploadWidget>
      </div>

      {media.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-3 text-accent">MEDIA_GALLERY ({media.length})</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 max-h-96 overflow-y-auto">
            {media.map((item, i) => (
              <div key={i} className="border border-accent/20 overflow-hidden aspect-square">
                {item.type === 'image' ? (
                  <Image
                    src={item.url}
                    alt="Vault memory"
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    controls
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowQuoteForm(!showQuoteForm)}
        className="w-full border border-accent/30 bg-background/50 p-2 text-secondary hover:border-accent hover:text-accent"
      >
        {showQuoteForm ? '[−] QUOTES_WALL' : '[+] QUOTES_WALL'} ({quotes.length})
      </button>

      {showQuoteForm && (
        <div className="border border-accent/30 bg-background/50 p-4 space-y-2">
          <label className="block text-secondary">ADD_QUOTE</label>
          <textarea
            value={quoteText}
            onChange={e => setQuoteText(e.target.value)}
            className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground placeholder-tertiary focus:border-accent focus:outline-none"
            rows={2}
            placeholder="Enter a memorable quote..."
          />
          <CandlestickButton
            onClick={handleAddQuote}
            isLoading={loadingQuote}
            disabled={!quoteText.trim()}
            className="w-full"
          >
            {loadingQuote ? 'ADDING...' : 'ADD_QUOTE'}
          </CandlestickButton>
        </div>
      )}

      {quotes.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">QUOTES_TICKER</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {quotes.map((quote, i) => (
              <div key={i} className="border-l-2 border-accent/30 pl-2 py-1">
                <p className="text-accent italic">{`"${quote.text}"`}</p>
                <div className="flex items-center justify-between text-tertiary">
                  <span className="text-xs">{new Date(quote.createdAt).toLocaleDateString()}</span>
                  {quote.userId === user.id && (
                    <button
                      onClick={() => handleDeleteQuote(quote.id)}
                      className="text-secondary hover:text-warning"
                    >
                      [DEL]
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
