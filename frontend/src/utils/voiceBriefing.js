/**
 * TerraSense AI Voice Briefing Copilot
 * Uses native Web Speech API (zero latency, zero dependencies, works 100% offline)
 */

let activeUtterance = null;

export const playVoiceBriefing = (simulationData, scenario, areaName, onEnd) => {
  if (!('speechSynthesis' in window)) {
    console.warn('Web Speech API is not supported in this browser.');
    return false;
  }

  // Stop any currently playing audio
  window.speechSynthesis.cancel();

  if (!simulationData || !simulationData.metrics) {
    return false;
  }

  const metrics = simulationData.metrics;
  const cleanArea = areaName ? areaName.replace('.geojson', '').replace('_area', '').replace('_', ' ') : 'the selected study ward';
  
  let scenarioText = 'current baseline conditions';
  if (scenario === 'rcp45') {
    scenarioText = 'a 2-degree warming scenario with a 10 percent rainfall surge';
  } else if (scenario === 'rcp85') {
    scenarioText = 'a severe RCP 8.5 climate scenario with a 20 percent storm surge';
  } else if (scenario === 'rcp45_rain_plus10') {
    scenarioText = 'an elevated monsoon surge scenario';
  }

  const peopleCount = metrics.scenario_people ? metrics.scenario_people.toLocaleString() : '1,500';
  const runoffChange = metrics.peak_runoff_change_pct || '0';
  const heatStress = metrics.heat_stress_level || 'Moderate';
  const topIntervention = simulationData.interventions && simulationData.interventions[0] 
    ? simulationData.interventions[0].name 
    : 'Smart stormwater retention basins';

  const speechScript = `
    Executive Climate Briefing for ${cleanArea}.
    Under ${scenarioText}, peak stormwater runoff increases by ${runoffChange} percent, placing approximately ${peopleCount} citizens at flood risk.
    Thermal vulnerability is currently rated at ${heatStress} level.
    The primary recommended municipal action is ${topIntervention}, providing immediate runoff mitigation.
    Detailed project budgets and civil engineering specifications are ready in your solutions dashboard.
  `.replace(/\s+/g, ' ').trim();

  activeUtterance = new SpeechSynthesisUtterance(speechScript);
  activeUtterance.rate = 1.0;
  activeUtterance.pitch = 1.0;
  activeUtterance.volume = 1.0;

  // Try to pick a natural English voice
  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('English')) && v.lang.startsWith('en'));
  if (naturalVoice) {
    activeUtterance.voice = naturalVoice;
  }

  if (onEnd) {
    activeUtterance.onend = onEnd;
    activeUtterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(activeUtterance);
  return true;
};

export const stopVoiceBriefing = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
};
