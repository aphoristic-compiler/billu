'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { CldUploadWidget } from 'next-cloudinary';
import { getVaultMedia, getQuotes, addQuote, deleteQuote } from '@/lib/actions/vault';
import { getArchivedEvents } from '@/lib/actions/events';
import { toast } from '@/components/terminal-toast';
import { CandlestickButton } from '@/components/candlestick-button';
import Image from 'next/image';

export default function VaultPage() {
  const { user } = useUser();
  const [media, setMedia] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<any[]>([]);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [m, q, ae] = await Promise.all([getVaultMedia(), getQuotes(), getArchivedEvents()]);
      setMedia(m);
      setQuotes(q);
      setArchivedEvents(ae);
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

      {archivedEvents.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-3 text-accent">LIQUIDATED_POSITIONS ({archivedEvents.length})</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {archivedEvents.map((event, i) => {
              const renderEvent = (evt: any, isMicro = false) => {
                const inCount = evt.rsvps?.filter((r: any) => r.status === 'long').length || 0;
                const outCount = evt.rsvps?.filter((r: any) => r.status === 'short').length || 0;
                const totalCost = evt.expenses?.reduce((sum: number, exp: any) => sum + exp.totalAmount, 0) || 0;
                
                return (
                  <div key={evt.id || i} className={`border-l-2 ${isMicro ? 'border-accent/10 ml-4 mt-3' : 'border-accent/20'} pl-3 mb-2 pb-2`}>
                    <p className="font-bold text-secondary text-sm">{evt.title} <span className="text-xs text-muted-foreground ml-2">({evt.category})</span></p>
                    <p className="text-tertiary">
                      {evt.startsAt ? new Date(evt.startsAt).toLocaleDateString() : 'Unknown date'} · @{evt.creator?.username || 'unknown'}
                    </p>
                    
                    {evt.location && <p className="text-tertiary mt-1">📍 {evt.location}</p>}
                    {evt.description && <p className="text-tertiary mt-1 italic">"{evt.description}"</p>}
                    
                    <div className="flex gap-4 mt-2 text-xs">
                      {totalCost > 0 && <span className="text-warning">Total Cost: ₹{totalCost.toLocaleString('en-IN')}</span>}
                    </div>

                    {evt.rsvps && evt.rsvps.length > 0 && (
                      <div className="mt-2 text-xs font-mono space-y-1">
                        <div className="text-profit">IN: {evt.rsvps.filter((r: any) => r.status === 'long').map((r: any) => `@${r.user?.username}`).join(', ') || 'None'}</div>
                        <div className="text-loss">OUT: {evt.rsvps.filter((r: any) => r.status === 'short').map((r: any) => `@${r.user?.username}`).join(', ') || 'None'}</div>
                      </div>
                    )}

                    {evt.expenses && evt.expenses.length > 0 && (
                      <div className="mt-2 p-2 border border-accent/20 bg-background/30 rounded">
                        <p className="text-[10px] uppercase text-muted-foreground mb-1 tracking-widest">expenses</p>
                        {evt.expenses.map((exp: any) => (
                          <div key={exp.id} className="text-xs flex flex-col sm:flex-row sm:justify-between py-1 border-b border-accent/10 last:border-0 gap-1 sm:gap-2">
                            <span className="truncate pr-2 font-medium">{exp.title}</span>
                            <span className="text-warning whitespace-nowrap shrink-0">₹{exp.amount} <span className="text-muted-foreground">(by @{exp.payer?.username})</span></span>
                          </div>
                        ))}
                      </div>
                    )}

                    {evt.vaultMedia && evt.vaultMedia.length > 0 && (
                      <div className="mt-2 p-2 border border-accent/20 bg-background/30 rounded">
                        <p className="text-[10px] uppercase text-muted-foreground mb-1 tracking-widest">media</p>
                        <div className="flex gap-2 overflow-x-auto">
                          {evt.vaultMedia.map((media: any) => (
                            <div key={media.id} className="h-16 w-16 shrink-0 border border-accent/30 overflow-hidden relative group">
                              {media.mediaType === 'image' ? (
                                <Image src={media.cloudinaryUrl} alt="media" fill className="object-cover" />
                              ) : (
                                <video src={media.cloudinaryUrl} className="w-full h-full object-cover" />
                              )}
                              {media.caption && (
                                <div className="absolute inset-0 bg-black/80 hidden group-hover:flex items-center justify-center text-[8px] p-1 text-center">
                                  {media.caption}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evt.microEvents && evt.microEvents.length > 0 && (
                      <div className="mt-3 border-t border-accent/10 pt-2">
                        <p className="text-[10px] uppercase text-muted-foreground mb-1 tracking-widest">nested_events</p>
                        {evt.microEvents.map((me: any) => renderEvent(me, true))}
                      </div>
                    )}
                  </div>
                )
              };

              return renderEvent(event);
            })}
          </div>
        </div>
      )}

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
