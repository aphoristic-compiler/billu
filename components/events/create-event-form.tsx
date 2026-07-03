'use client';

import { useState } from 'react';
import { createEvent, blastWhatsApp } from '@/lib/actions/events';
import { toast } from '../terminal-toast';
import { CandlestickButton } from '../candlestick-button';

export function CreateEventForm() {
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'social',
    scheduledAt: '',
    location: '',
    durationMinutes: 60,
    pollQuestion: '',
    pollOptions: ['', ''],
    blastWhatsApp: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pollData =
        formData.pollQuestion && formData.pollOptions.every(o => o.trim())
          ? { question: formData.pollQuestion, options: formData.pollOptions.filter(o => o.trim()).map(text => ({ text })) }
          : null;

      const eventId = await createEvent({
        name: formData.name,
        description: formData.description,
        type: formData.type as any,
        scheduledAt: new Date(formData.scheduledAt),
        location: formData.location || null,
        durationMinutes: formData.type === 'micro' ? formData.durationMinutes : null,
        poll: pollData,
      });

      if (formData.blastWhatsApp) {
        await blastWhatsApp(
          eventId,
          `Wing event: ${formData.name}\n${new Date(formData.scheduledAt).toLocaleString()}\n${formData.description || ''}`
        );
      }

      toast('EVENT_CREATED', 'success');
      setFormData({
        name: '',
        description: '',
        type: 'social',
        scheduledAt: '',
        location: '',
        durationMinutes: 60,
        pollQuestion: '',
        pollOptions: ['', ''],
        blastWhatsApp: false,
      });
    } catch (err) {
      toast('CREATE_FAILED', 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-accent/30 bg-background/50 p-4 font-mono text-xs">
      <h3 className="mb-3 text-accent">CREATE_EVENT</h3>

      <div className="mb-2">
        <label className="block text-secondary">NAME</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground placeholder-tertiary focus:border-accent focus:outline-none"
          placeholder="Event name"
          required
        />
      </div>

      <div className="mb-2">
        <label className="block text-secondary">DESCRIPTION</label>
        <textarea
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground placeholder-tertiary focus:border-accent focus:outline-none"
          placeholder="Optional"
          rows={2}
        />
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-secondary">TYPE</label>
          <select
            value={formData.type}
            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
            className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
          >
            <option value="social">Social</option>
            <option value="sport">Sport</option>
            <option value="micro">Micro</option>
            <option value="other">Other</option>
          </select>
        </div>

        {formData.type === 'micro' && (
          <div>
            <label className="block text-secondary">DURATION (MIN)</label>
            <input
              type="number"
              value={formData.durationMinutes}
              onChange={e => setFormData(prev => ({ ...prev, durationMinutes: parseInt(e.target.value) }))}
              className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
              min="5"
              max="120"
            />
          </div>
        )}
      </div>

      <div className="mb-2">
        <label className="block text-secondary">SCHEDULED</label>
        <input
          type="datetime-local"
          value={formData.scheduledAt}
          onChange={e => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
          className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
          required
        />
      </div>

      <div className="mb-2">
        <label className="block text-secondary">LOCATION</label>
        <input
          type="text"
          value={formData.location}
          onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
          className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground placeholder-tertiary focus:border-accent focus:outline-none"
          placeholder="Optional"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mb-2 text-secondary hover:text-accent"
      >
        {showAdvanced ? '[−] ADVANCED' : '[+] ADVANCED'}
      </button>

      {showAdvanced && (
        <div className="mb-2 border-t border-accent/10 pt-2">
          <label className="block text-secondary">POLL_QUESTION</label>
          <input
            type="text"
            value={formData.pollQuestion}
            onChange={e => setFormData(prev => ({ ...prev, pollQuestion: e.target.value }))}
            className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground placeholder-tertiary focus:border-accent focus:outline-none"
            placeholder="Optional poll"
          />

          {formData.pollQuestion && (
            <div className="mt-2">
              <label className="block text-secondary">OPTIONS</label>
              {formData.pollOptions.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  value={opt}
                  onChange={e => {
                    const newOpts = [...formData.pollOptions];
                    newOpts[i] = e.target.value;
                    setFormData(prev => ({ ...prev, pollOptions: newOpts }));
                  }}
                  className="mb-1 w-full border border-accent/30 bg-background px-2 py-1 text-foreground placeholder-tertiary focus:border-accent focus:outline-none"
                  placeholder={`Option ${i + 1}`}
                />
              ))}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pollOptions: [...prev.pollOptions, ''] }))}
                className="text-tertiary hover:text-secondary"
              >
                + Add option
              </button>
            </div>
          )}

          <label className="mt-2 flex items-center gap-2 text-secondary">
            <input
              type="checkbox"
              checked={formData.blastWhatsApp}
              onChange={e => setFormData(prev => ({ ...prev, blastWhatsApp: e.target.checked }))}
              className="accent-accent"
            />
            BLAST_WHATSAPP
          </label>
        </div>
      )}

      <CandlestickButton
        onClick={handleSubmit}
        disabled={loading || !formData.name || !formData.scheduledAt}
        isLoading={loading}
        className="w-full"
      >
        {loading ? 'CREATING...' : 'CREATE_EVENT'}
      </CandlestickButton>
    </form>
  );
}
