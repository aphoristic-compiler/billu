export async function queryMistral(messages: any[], userId: string) {
  const keysEnv = process.env.MISTRAL_API_KEYS || '';
  const keys = keysEnv.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keys.length === 0) {
    throw new Error('MISTRAL_API_KEYS environment variable is not set or empty.');
  }

  // Hash the userId to an index to consistently map users to a primary key
  let userIndex = 0;
  for (let i = 0; i < userId.length; i++) {
    userIndex += userId.charCodeAt(i);
  }
  userIndex = userIndex % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = (userIndex + attempt) % keys.length;
    const apiKey = keys[keyIndex];

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: messages,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Mistral API key at index ${keyIndex} rate limited (429). Rotating to next key...`);
          continue; // Try next key
        }
        const errorText = await response.text();
        throw new Error(`Mistral API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
      
    } catch (error: any) {
      console.warn(`Attempt with key ${keyIndex} failed: ${error.message}`);
      if (attempt === keys.length - 1) {
        throw new Error('All Mistral API keys have been exhausted or failed.');
      }
    }
  }
}
