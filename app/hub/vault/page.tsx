'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { CldUploadWidget } from 'next-cloudinary';
import { getVaultMedia, getQuotes, addQuote, deleteQuote } from '@/lib/actions/vault';
import { getArchivedEventsWithDetails } from '@/lib/actions/events';
import { getArchivedStandalonePolls } from '@/lib/actions/polls';
import { getArchivedMatches } from '@/lib/actions/matches';
import { toast } from '@/components/terminal-toast';
import { CandlestickButton } from '@/components/candlestick-button';
import Image from 'next/image';

export default function VaultPage() {
  const { user } = useUser();
  const [media, setMedia] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<any[]>([]);
  const [archivedPolls, setArchivedPolls] = useState<any[]>([]);
  const [archivedMatches, setArchivedMatches] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'events' | 'trips' | 'polls' | 'games'>('events');
  
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [m, q, ae, ap, am] = await Promise.all([
        getVaultMedia(), 
        getQuotes(), 
        getArchivedEventsWithDetails(),
        getArchivedStandalonePolls(),
        getArchivedMatches()
      ]);
      setMedia(m);
      setQuotes(q);
      setArchivedEvents(ae);
      setArchivedPolls(ap);
      setArchivedMatches(am);
    };
    load();
  }, []);

  const filteredEvents = useMemo(() => {
    return archivedEvents.filter(e => e.category !== 'trip' && e.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [archivedEvents, searchQuery]);

  const filteredTrips = useMemo(() => {
    return archivedEvents.filter(e => e.category === 'trip' && e.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [archivedEvents, searchQuery]);

  const filteredPolls = useMemo(() => {
    return archivedPolls.filter(p => p.question.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [archivedPolls, searchQuery]);

  const filteredMatches = useMemo(() => {
    return archivedMatches.filter(m => m.game.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [archivedMatches, searchQuery]);

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

  const renderEvent = (evt: any, isMicro = false) => {
    const inCount = evt.rsvps?.filter((r: any) => r.status === 'long').length || 0;
    const outCount = evt.rsvps?.filter((r: any) => r.status === 'short').length || 0;
    const totalCost = evt.expenses?.reduce((sum: number, exp: any) => sum + exp.totalAmount, 0) || 0;
    
    return (
      <div key={evt.id} className={`border-l-2 ${isMicro ? 'border-accent/10 ml-4 mt-3' : 'border-accent/20'} pl-3 mb-2 pb-2`}>
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
                <span className="text-warning whitespace-nowrap shrink-0">₹{exp.totalAmount} <span className="text-muted-foreground">(by @{exp.payer?.username})</span></span>
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
    );
  };

  const renderPoll = (poll: any) => (
    <div key={poll.id} className="border border-accent/20 bg-background/50 p-3 rounded mb-3">
      <p className="font-bold text-secondary text-sm mb-1">{poll.question}</p>
      <p className="text-[10px] text-muted-foreground mb-3">Created by @{poll.creator?.username}</p>
      <div className="space-y-1">
        {poll.options.map((opt: any) => (
          <div key={opt.id} className="flex justify-between text-xs bg-muted/10 p-1 px-2 rounded">
            <span>{opt.label}</span>
            <span className="text-accent">{opt.votes?.length || 0} votes</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMatch = (match: any) => (
    <div key={match.id} className="border border-accent/20 bg-background/50 p-3 rounded mb-3">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-profit flex items-center gap-2">
          {match.game.icon} {match.game.name}
        </span>
        <span className="text-xs text-muted-foreground">{new Date(match.playedAt).toLocaleDateString()}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Participants: {match.participants.map((p: any) => `@${p.user?.username}`).join(', ')}
      </div>
      {match.notes && <div className="mt-2 text-xs italic text-tertiary">"{match.notes}"</div>}
    </div>
  );

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="border border-accent/30 bg-background/50 p-4">
        <h2 className="mb-3 text-accent">MEMORIAL_VAULT</h2>
        <p className="text-secondary mb-3">Preserve memories and moments from the Saturo Wing</p>

        <CldUploadWidget
          signatureEndpoint="/api/sign-cloudinary-params"
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

      <div className="border border-accent/30 bg-background/50 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-accent">ARCHIVES</h3>
          <input 
            type="text" 
            placeholder="Search archives..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-accent/30 bg-background px-2 py-1 text-xs focus:outline-none focus:border-accent text-foreground w-1/2"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-4 border-b border-accent/20 pb-2">
          {['events', 'trips', 'polls', 'games'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1 uppercase text-[10px] ${activeTab === tab ? 'bg-accent/20 text-accent font-bold' : 'text-muted-foreground hover:text-secondary'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="max-h-[500px] overflow-y-auto pr-2">
          {activeTab === 'events' && (
            filteredEvents.length > 0 ? filteredEvents.map(e => renderEvent(e)) : <p className="text-muted-foreground italic">No events found.</p>
          )}
          {activeTab === 'trips' && (
            filteredTrips.length > 0 ? filteredTrips.map(e => renderEvent(e)) : <p className="text-muted-foreground italic">No trips found.</p>
          )}
          {activeTab === 'polls' && (
            filteredPolls.length > 0 ? filteredPolls.map(p => renderPoll(p)) : <p className="text-muted-foreground italic">No standalone polls found.</p>
          )}
          {activeTab === 'games' && (
            filteredMatches.length > 0 ? filteredMatches.map(m => renderMatch(m)) : <p className="text-muted-foreground italic">No games found.</p>
          )}
        </div>
      </div>

      {media.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-3 text-accent">MEDIA_GALLERY ({media.length})</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 max-h-96 overflow-y-auto">
            {media.map((item, i) => (
              <div key={i} className="border border-accent/20 overflow-hidden aspect-square relative">
                {item.mediaType === 'image' ? (
                  <Image
                    src={item.cloudinaryUrl}
                    alt="Vault memory"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <video
                    src={item.cloudinaryUrl}
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
                <p className="text-accent italic">{`"${quote.quote}"`}</p>
                <div className="flex items-center justify-between text-tertiary">
                  <span className="text-xs">{new Date(quote.createdAt).toLocaleDateString()}</span>
                  {quote.addedBy === user.id && (
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
