'use client';

import { formatDistanceToNow } from 'date-fns';
import { rsvpEvent, updateEventPoll } from '@/lib/actions/events';
import { toast } from '../terminal-toast';

interface EventCardProps {
  event: any;
  currentUserId: string;
}

export function EventCard({ event, currentUserId }: EventCardProps) {
  const userRsvp = event.rsvps?.find((r: any) => r.userId === currentUserId);

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
        <h3 className="text-accent">{event.name}</h3>
        <span className="text-secondary">{event.type}</span>
      </div>

      {event.description && <p className="mb-2 text-tertiary">{event.description}</p>}

      <div className="mb-3 border-t border-accent/10 pt-2 text-tertiary">
        <p>{new Date(event.scheduledAt).toLocaleString()}</p>
        {event.location && <p>📍 {event.location}</p>}
      </div>

      {event.type === 'micro' && event.durationMinutes && (
        <div className="mb-2 text-secondary">{event.durationMinutes}min session</div>
      )}

      {event.poll && (
        <div className="mb-3 border-t border-accent/10 pt-2">
          <p className="mb-1 text-accent">POLL: {event.poll.question}</p>
          {event.poll.options?.map((opt: any) => {
            const votes = event.pollVotes?.filter((v: any) => v.optionId === opt.id).length || 0;
            const hasVoted = event.pollVotes?.some((v: any) => v.optionId === opt.id && v.userId === currentUserId);
            return (
              <button
                key={opt.id}
                onClick={() => handlePollVote(opt.id)}
                className={`block w-full border border-accent/20 px-2 py-1 text-left transition ${hasVoted ? 'border-accent bg-accent/10' : 'hover:border-accent'}`}
              >
                {opt.text} ({votes})
              </button>
            );
          })}
        </div>
      )}

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
