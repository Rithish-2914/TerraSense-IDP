const fs = require('fs');
const path = require('path');
const ngrok = require('@ngrok/ngrok');

function getEnvToken() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('NGROK_AUTHTOKEN=')) {
        return trimmed.substring('NGROK_AUTHTOKEN='.length).trim();
      }
    }
  }
  return process.env.NGROK_AUTHTOKEN || '';
}

async function startTunnel() {
  const token = getEnvToken();
  console.log('Starting Ngrok tunnel to localhost:5000...');
  try {
    const listener = await ngrok.forward({
      addr: 'http://127.0.0.1:5000',
      authtoken: token,
    });
    const url = listener.url();
    console.log('====================================================');
    console.log('🚀 NGROK TUNNEL ONLINE:');
    console.log(`🔗 Backend URL:      ${url}`);
    console.log(`📞 Voice Webhook:    ${url}/api/emergency/voice-webhook`);
    console.log('====================================================');

    setInterval(() => {}, 1000 * 60 * 60);

    process.on('SIGINT', async () => {
      console.log('Closing Ngrok tunnel...');
      await listener.close();
      process.exit(0);
    });
  } catch (err) {
    console.error('Failed to start ngrok tunnel:', err);
    process.exit(1);
  }
}

startTunnel();
