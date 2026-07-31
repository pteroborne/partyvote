// FL Studio & Cinema Grade Web Audio DSP Engine for PartyVote
// Pristine, Distortion-Free THX Deep Note (Ultra-Snappy 0.25s Buildup, 1.5s Total Duration)

let audioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!audioCtx) {
		const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
		if (AudioContextClass) {
			audioCtx = new AudioContextClass();
			setupMasterBus(audioCtx);
		}
	}
	if (audioCtx && audioCtx.state === 'suspended') {
		audioCtx.resume().catch(() => {});
	}
	return audioCtx;
}

/** Pristine Studio Master Bus: Clean Dynamics Compression */
function setupMasterBus(ctx: AudioContext) {
	try {
		masterCompressor = ctx.createDynamicsCompressor();
		masterCompressor.threshold.setValueAtTime(-6, ctx.currentTime);
		masterCompressor.knee.setValueAtTime(6, ctx.currentTime);
		masterCompressor.ratio.setValueAtTime(4, ctx.currentTime);
		masterCompressor.attack.setValueAtTime(0.005, ctx.currentTime);
		masterCompressor.release.setValueAtTime(0.1, ctx.currentTime);

		masterCompressor.connect(ctx.destination);
	} catch (e) {
		// Fallback
	}
}

function getMasterInput(): AudioNode {
	const ctx = getAudioContext();
	if (masterCompressor) return masterCompressor;
	return ctx ? ctx.destination : (null as any);
}

// =========================================================================
// TACTILE DRUM & SYNTH INTERACTION SOUNDS
// =========================================================================

/** Punchy Trap-Style 808 Snap & Sub Click */
export function playTapSound() {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const out = getMasterInput();

		const bufferSize = ctx.sampleRate * 0.02;
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
		}
		const noise = ctx.createBufferSource();
		noise.buffer = buffer;

		const noiseFilter = ctx.createBiquadFilter();
		noiseFilter.type = 'highpass';
		noiseFilter.frequency.value = 2200;

		const noiseGain = ctx.createGain();
		noiseGain.gain.setValueAtTime(0.25, now);
		noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

		noise.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(out);

		const kick = ctx.createOscillator();
		const kickGain = ctx.createGain();

		kick.type = 'triangle';
		kick.frequency.setValueAtTime(180, now);
		kick.frequency.exponentialRampToValueAtTime(40, now + 0.04);

		kickGain.gain.setValueAtTime(0.3, now);
		kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

		kick.connect(kickGain);
		kickGain.connect(out);

		noise.start(now);
		kick.start(now);
		kick.stop(now + 0.045);
	} catch (e) {
		// Audio blocked
	}
}

/** Crisp High-Res FM Synth Pluck for Hovers */
export function playHoverSound() {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const out = getMasterInput();

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = 'sine';
		osc.frequency.setValueAtTime(987.77, now);
		osc.frequency.exponentialRampToValueAtTime(493.88, now + 0.025);

		gain.gain.setValueAtTime(0.06, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

		osc.connect(gain);
		gain.connect(out);

		osc.start(now);
		osc.stop(now + 0.03);
	} catch (e) {
		// Audio blocked
	}
}

/** Heavy 808 Sub-Drop Riser for Step Transitions */
export function playStepSound() {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const out = getMasterInput();

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(120, now);
		osc.frequency.exponentialRampToValueAtTime(480, now + 0.15);

		gain.gain.setValueAtTime(0.12, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

		const sub = ctx.createOscillator();
		const subGain = ctx.createGain();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(140, now);
		sub.frequency.exponentialRampToValueAtTime(30, now + 0.16);

		subGain.gain.setValueAtTime(0.3, now);
		subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

		osc.connect(gain);
		sub.connect(subGain);
		gain.connect(out);
		subGain.connect(out);

		osc.start(now);
		sub.start(now);
		osc.stop(now + 0.16);
		sub.stop(now + 0.18);
	} catch (e) {
		// Audio blocked
	}
}

// =========================================================================
// ULTRA-SNAPPY HIGH-FIDELITY THX DEEP NOTE (0.25s Buildup, 1.5s Total Duration)
// =========================================================================

/**
 * Ultra-Snappy 12-Voice THX Deep Note Synthesizer
 * - Super fast 0.25s pitch buildup
 * - Warm low-pass filter capped at 1400Hz (no harsh distortion)
 * - 28Hz sub-bass impact
 * - Clean 1.5s total duration
 */
export function playTHXDeepNote() {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const out = getMasterInput();

		// Lowpass Filter Sweep (Fast 0.25s cutoff sweep)
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(300, now);
		filter.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
		filter.Q.setValueAtTime(1.0, now);

		const masterGain = ctx.createGain();
		masterGain.gain.setValueAtTime(0.001, now);
		masterGain.gain.linearRampToValueAtTime(0.45, now + 0.2);  // 0.2s entrance
		masterGain.gain.setValueAtTime(0.45, now + 1.0);           // Hold until 1.0s
		masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5); // Smooth 1.5s total fade

		filter.connect(masterGain);
		masterGain.connect(out);

		// Clean Harmonic Frequencies (Warm D-Major Sub Chord)
		const targetPitches = [
			36.71, 36.71, 36.71,   // Pure D1 sub-bass
			73.42, 73.42, 73.42,   // Warm D2 bass
			146.83, 146.83,        // D3 mid-bass
			220.0, 220.0,          // A3 fifth
			293.66, 293.66         // D4 octave
		];

		const numVoices = targetPitches.length;

		for (let i = 0; i < numVoices; i++) {
			const osc = ctx.createOscillator();
			const voiceGain = ctx.createGain();

			osc.type = i < 6 ? 'sine' : 'triangle';

			const startFreq = 100 + Math.random() * 100;
			const targetFreq = targetPitches[i];

			osc.frequency.setValueAtTime(startFreq, now);
			// ULTRA FAST 0.25s pitch glide sweep!
			osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.25);

			voiceGain.gain.value = 0.6 / numVoices;

			osc.connect(voiceGain);
			voiceGain.connect(filter);

			osc.start(now);
			osc.stop(now + 1.52);
		}

		// Clean 28Hz Sub-Bass Sine Generator
		const subImpact = ctx.createOscillator();
		const subImpactGain = ctx.createGain();
		subImpact.type = 'sine';
		subImpact.frequency.setValueAtTime(65.0, now);
		subImpact.frequency.exponentialRampToValueAtTime(28.0, now + 0.25);

		subImpactGain.gain.setValueAtTime(0.001, now);
		subImpactGain.gain.linearRampToValueAtTime(0.55, now + 0.2);
		subImpactGain.gain.setValueAtTime(0.55, now + 1.0);
		subImpactGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

		subImpact.connect(subImpactGain);
		subImpactGain.connect(out);

		subImpact.start(now);
		subImpact.stop(now + 1.52);

	} catch (e) {
		// Audio blocked
	}
}

/** Standard winner sound & transition sound use Ultra-Snappy THX Deep Note */
export function playWinnerSound() {
	playTHXDeepNote();
}

export function playTransitionSound(_wipeType: string) {
	playTHXDeepNote();
}
