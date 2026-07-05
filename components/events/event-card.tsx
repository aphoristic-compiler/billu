'use client';

import { formatDistanceToNow } from 'date-fns';
import { rsvpEvent, updateEventPoll } from '@/lib/actions/events';
import { broadcastToWing } from '@/lib/actions/push';
import { toast } from '../terminal-toast';
import { useState } from 'react';
import { EditPollDialog } from '../surveys/edit-poll-dialog';

interface EventCardProps {
  event: any;
  currentUserId: string;
}

export function EventCard({ event, currentUserId }: EventCardProps) {
  const userRsvp = event.rsvps?.find((r: any) => r.userId === currentUserId);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);

  const handleRsvp = async (status: 'yes' | 'no' | 'maybe') => {
    try {
      await rsvpEvent(event.id, currentUserId, status);
      toast(`RSVP: ${status.toUpperCase()}`, 'success');
    } catch (err) {
      toast('RSVP_FAILED', 'warning');
    }
  };

  const handlePollVote = async (optionId: string) => {
    if (!event.poll) return;
    try {
      await updateEventPoll(event.id, optionId, currentUserId);
      toast('VOTE_RECORDED', 'success');
    } catch (err) {
      toast('VOTE_FAILED', 'warning');
    }
  };

  const yesCount = event.rsvps?.filter((r: any) => r.status === 'yes').length || 0;
  const maybeCount = event.rsvps?.filter((r: any) => r.status === 'maybe').length || 0;
  const noCount = event.rsvps?.filter((r: any) => r.status === 'no').length || 0;

  return (
    <div className="border border-accent/30 bg-background/50 p-4 font-mono text-xs">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex flex-col">
          <h3 className="text-accent text-sm">{event.title || event.name}</h3>
          <span className="text-secondary text-[10px] uppercase">
            {event.category || event.type}
            {event.creator && ` • BY @${event.creator.username}`}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          {event.creator && event.creator.username === currentUserId && (
            <button
              onClick={async () => {
                try {
                  await broadcastToWing(
                    `🚨 MARGIN CALL: ${event.category || event.type}`,
                    `@${event.creator.username} just scheduled ${event.title || event.name}!`
                  );
                  toast('Event blast sent to wing.');
                } catch (e: any) {
                  toast(e.message || 'Blast failed', 'error');
                }
              }}
              className="text-muted-foreground hover:text-primary transition-colors text-xs"
              title="Blast Notification to Wing"
            >
              [🚀 blast]
            </button>
          )}
        </div>
      </div>

      {event.description && <p className="mb-2 text-tertiary">{event.description}</p>}

      <div className="mb-3 border-t border-accent/10 pt-2 text-tertiary">
        <p>{new Date(event.scheduledAt).toLocaleString()}</p>
        {event.location && <p>📍 {event.location}</p>}
      </div>

      {event.type === 'micro' && event.durationMinutes && (
        <div className="mb-2 text-secondary">{event.durationMinutes}min session</div>
      )}

      {event.polls?.map((poll: any) => (
        <div key={poll.id} className="mb-3 border-t border-accent/10 pt-2">
          <div className="flex justify-between items-center mb-1">
            <p className="text-accent">POLL: {poll.question}</p>
            {event.creator && event.creator.username === currentUserId && (
              <button 
                onClick={() => setEditingPollId(poll.id)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                [edit]
              </button>
            )}
          </div>
          {poll.options?.map((opt: any) => {
            const votes = opt.votes?.length || 0;
            const hasVoted = opt.votes?.some((v: any) => v.userId === currentUserId);
            return (
              <button
                key={opt.id}
                onClick={() => handlePollVote(opt.id)}
                className={`block w-full border border-accent/20 px-2 py-1 text-left transition ${hasVoted ? 'border-accent bg-accent/10' : 'hover:border-accent'}`}
              >
                {opt.label || opt.text} ({votes})
              </button>
            );
          })}
          {editingPollId === poll.id && (
            <EditPollDialog
              isOpen={true}
              onClose={() => setEditingPollId(null)}
              poll={poll}
            />
          )}
        </div>
      ))}

      <div className="border-t border-accent/10 pt-2">
        <div className="mb-2 text-secondary">RSVP: YES {yesCount} | MAYBE {maybeCount} | NO {noCount}</div>
        <div className="flex gap-1">
          <button
            onClick={() => handleRsvp('yes')}
            className={`flex-1 border px-2 py-1 transition ${userRsvp?.status === 'yes' ? 'border-accent bg-accent/10 text-accent' : 'border-accent/30 hover:border-accent'}`}
          >
            YES
          </button>
          <button
            onClick={() => handleRsvp('maybe')}
            className={`flex-1 border px-2 py-1 transition ${userRsvp?.status === 'maybe' ? 'border-accent bg-accent/10 text-accent' : 'border-accent/30 hover:border-accent'}`}
          >
            MAYBE
          </button>
          <button
            onClick={() => handleRsvp('no')}
            className={`flex-1 border px-2 py-1 transition ${userRsvp?.status === 'no' ? 'border-accent bg-accent/10 text-accent' : 'border-accent/30 hover:border-accent'}`}
          >
            NO
          </button>
        </div>
      </div>

      <div className="mt-2 flex gap-2 text-tertiary">
        <span>{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
      </div>
    </div>
  );
}
